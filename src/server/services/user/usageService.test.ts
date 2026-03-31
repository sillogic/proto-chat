// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from '@/server/services/credit';

import { UserUsageService } from './usageService';

vi.mock('@/server/services/credit', () => ({
  CreditService: vi.fn(),
}));

describe('UserUsageService', () => {
  const mockUserId = 'user-123';

  // ---- Chain builder helpers ----

  /** select().from().where() → terminal at where() */
  const whereChain = (result: any[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  });

  /**
   * select().from().leftJoin().where().orderBy().limit().offset()
   * Terminal at offset()
   */
  const offsetChain = (result: any[]) => ({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(result),
            }),
          }),
        }),
      }),
    }),
  });

  /**
   * select().from().leftJoin().where().orderBy()
   * Terminal at orderBy()
   */
  const leftJoinOrderByChain = (result: any[]) => ({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  });

  /**
   * select().from().where().orderBy()
   * Terminal at orderBy()
   */
  const whereOrderByChain = (result: any[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  });

  const createMockDb = (
    config: {
      userExtensions?: any;
      subscriptionPlans?: any;
      userBalances?: any;
      userTransactionsMany?: any[];
      selectChains?: ReturnType<typeof whereChain>[];
    } = {},
  ) => {
    const chains = config.selectChains ?? [];
    let chainIndex = 0;

    const mockSelect = vi.fn().mockImplementation(() => {
      const chain = chains[chainIndex++] ?? whereChain([]);
      return chain;
    });

    return {
      select: mockSelect,
      query: {
        userExtensions: {
          findFirst: vi.fn().mockResolvedValue(config.userExtensions ?? null),
        },
        subscriptionPlans: {
          findFirst: vi.fn().mockResolvedValue(config.subscriptionPlans ?? null),
        },
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(config.userBalances ?? null),
        },
        userTransactions: {
          findMany: vi.fn().mockResolvedValue(config.userTransactionsMany ?? []),
        },
      },
    } as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CreditService).mockImplementation(
      () => ({ hasEnoughCredits: vi.fn().mockResolvedValue(true) }) as any,
    );
  });

  // -------------------------
  // checkTokenLimit
  // -------------------------
  describe('checkTokenLimit', () => {
    it('should not throw when user has enough credits', async () => {
      const service = new UserUsageService(createMockDb(), mockUserId);

      await expect(service.checkTokenLimit()).resolves.toBeUndefined();
    });

    it('should throw FORBIDDEN TRPCError when user has insufficient credits', async () => {
      vi.mocked(CreditService).mockImplementation(
        () => ({ hasEnoughCredits: vi.fn().mockResolvedValue(false) }) as any,
      );
      const service = new UserUsageService(createMockDb(), mockUserId);

      await expect(service.checkTokenLimit()).rejects.toThrow(TRPCError);
    });

    it('should throw with FORBIDDEN code and credits message', async () => {
      vi.mocked(CreditService).mockImplementation(
        () => ({ hasEnoughCredits: vi.fn().mockResolvedValue(false) }) as any,
      );
      const service = new UserUsageService(createMockDb(), mockUserId);

      let caught: any;
      try {
        await service.checkTokenLimit();
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(TRPCError);
      expect(caught.code).toBe('FORBIDDEN');
      expect(caught.message).toContain('Insufficient credits');
    });
  });

  // -------------------------
  // checkFileStorageLimit
  // -------------------------
  describe('checkFileStorageLimit', () => {
    it('should not throw when storage usage is within default limit', async () => {
      // Default 512MB; usage 100MB
      const mockDb = createMockDb({
        userExtensions: null,
        subscriptionPlans: null,
        selectChains: [whereChain([{ totalSize: 100 * 1024 * 1024 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkFileStorageLimit(0)).resolves.toBeUndefined();
    });

    it('should not throw when usage plus incoming is under plan limit', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-1', currentPlan: 'pro' },
        subscriptionPlans: { storageLimit: 1024 },
        selectChains: [whereChain([{ totalSize: 500 * 1024 * 1024 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      // 500MB used + 100MB incoming < 1024MB limit
      await expect(service.checkFileStorageLimit(100 * 1024 * 1024)).resolves.toBeUndefined();
    });

    it('should throw FORBIDDEN when storage exceeds limit', async () => {
      // 512MB default limit; current usage 512MB, even +1 byte exceeds limit
      const mockDb = createMockDb({
        userExtensions: null,
        subscriptionPlans: null,
        selectChains: [whereChain([{ totalSize: 512 * 1024 * 1024 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkFileStorageLimit(1)).rejects.toThrow(TRPCError);
    });

    it('should include storage limit MB in the error message', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: null, currentPlan: 'basic' },
        subscriptionPlans: { storageLimit: 256 },
        selectChains: [whereChain([{ totalSize: 300 * 1024 * 1024 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      let caught: any;
      try {
        await service.checkFileStorageLimit(0);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(TRPCError);
      expect(caught.code).toBe('FORBIDDEN');
      expect(caught.message).toContain('256MB');
    });

    it('should use planId to look up plan when available', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-gold', currentPlan: 'free' },
        subscriptionPlans: { storageLimit: 2048 },
        selectChains: [whereChain([{ totalSize: 0 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkFileStorageLimit(0)).resolves.toBeUndefined();
      expect(mockDb.query.subscriptionPlans.findFirst).toHaveBeenCalledOnce();
    });
  });

  // -------------------------
  // checkVectorStorageLimit
  // -------------------------
  describe('checkVectorStorageLimit', () => {
    it('should return early when vectorLimit is 0', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-1' },
        subscriptionPlans: { vectorLimit: 0 },
        selectChains: [],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkVectorStorageLimit(100)).resolves.toBeUndefined();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return early when userExt has no planId', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: null },
        selectChains: [],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkVectorStorageLimit(0)).resolves.toBeUndefined();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should not throw when vector count is within limit', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-1' },
        subscriptionPlans: { vectorLimit: 1000 },
        selectChains: [whereChain([{ count: 500 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      await expect(service.checkVectorStorageLimit(100)).resolves.toBeUndefined();
    });

    it('should throw FORBIDDEN when vector count exceeds limit', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-1' },
        subscriptionPlans: { vectorLimit: 1000 },
        selectChains: [whereChain([{ count: 950 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      // 950 existing + 100 incoming > 1000 limit
      await expect(service.checkVectorStorageLimit(100)).rejects.toThrow(TRPCError);
    });

    it('should include vector limit in the error message', async () => {
      const mockDb = createMockDb({
        userExtensions: { planId: 'plan-1' },
        subscriptionPlans: { vectorLimit: 500 },
        selectChains: [whereChain([{ count: 500 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      let caught: any;
      try {
        await service.checkVectorStorageLimit(1);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(TRPCError);
      expect(caught.code).toBe('FORBIDDEN');
      expect(caught.message).toContain('500 chunks');
    });
  });

  // -------------------------
  // getAccountStatistics
  // -------------------------
  describe('getAccountStatistics', () => {
    it('should return statistics with defaults when no user data exists', async () => {
      const mockDb = createMockDb({
        userBalances: { balance: '150.0000', userId: mockUserId },
        userExtensions: null,
        subscriptionPlans: null,
        selectChains: [
          whereChain([{ total: '50.0000' }]), // consumption
          whereChain([{ totalSize: 10 * 1024 * 1024 }]), // storage: 10MB
          whereChain([{ count: 42 }]), // vectors
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getAccountStatistics();

      expect(result.balance.current).toBe(150);
      expect(result.balance.currentPlan).toBe('Free Trial');
      expect(result.balance.planSlug).toBe('free');
      expect(result.balance.totalConsumed).toBe(50);
      expect(result.storage.totalSizeMB).toBeCloseTo(10, 1);
      expect(result.vectors.count).toBe(42);
    });

    it('should use plan data when user has a subscription plan', async () => {
      const plan = {
        name: 'Pro',
        slug: 'pro',
        credits: 5000,
        storageLimit: 2048,
        vectorLimit: 10000,
      };
      const mockDb = createMockDb({
        userBalances: { balance: '4500.0000', userId: mockUserId },
        userExtensions: { planId: 'plan-pro', currentPlan: 'pro', planExpiresAt: '2026-12-31' },
        subscriptionPlans: plan,
        selectChains: [
          whereChain([{ total: '500.0000' }]),
          whereChain([{ totalSize: 0 }]),
          whereChain([{ count: 0 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getAccountStatistics();

      expect(result.balance.current).toBe(4500);
      expect(result.balance.currentPlan).toBe('Pro');
      expect(result.balance.planSlug).toBe('pro');
      expect(result.balance.limit).toBe(5000);
      expect(result.storage.limitMB).toBe(2048);
      expect(result.vectors.limit).toBe(10000);
    });

    it('should parse month parameter for date-filtered consumption query', async () => {
      const mockDb = createMockDb({
        userBalances: null,
        userExtensions: null,
        subscriptionPlans: null,
        selectChains: [
          whereChain([{ total: null }]),
          whereChain([{ totalSize: null }]),
          whereChain([{ count: null }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getAccountStatistics('2026-01');

      expect(result.balance.current).toBe(0);
      expect(result.balance.totalConsumed).toBe(0);
      expect(result.storage.totalSizeMB).toBe(0);
      expect(result.vectors.count).toBe(0);
    });

    it('should format planExpiresAt as YYYY-MM-DD', async () => {
      const mockDb = createMockDb({
        userBalances: null,
        userExtensions: {
          planId: null,
          currentPlan: 'free',
          planExpiresAt: new Date('2026-06-30'),
        },
        subscriptionPlans: null,
        selectChains: [
          whereChain([{ total: null }]),
          whereChain([{ totalSize: null }]),
          whereChain([{ count: null }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getAccountStatistics();

      expect(result.resetCountdown.nextResetDate).toBe('2026-06-30');
    });

    it('should return "-" for nextResetDate when planExpiresAt is null', async () => {
      const mockDb = createMockDb({
        userBalances: null,
        userExtensions: { planId: null, currentPlan: 'free', planExpiresAt: null },
        subscriptionPlans: null,
        selectChains: [
          whereChain([{ total: null }]),
          whereChain([{ totalSize: null }]),
          whereChain([{ count: null }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getAccountStatistics();

      expect(result.resetCountdown.nextResetDate).toBe('-');
    });
  });

  // -------------------------
  // getTransactions
  // -------------------------
  describe('getTransactions', () => {
    it('should return paginated transactions with total count', async () => {
      const mockRecords = [
        { id: 'tx-1', amount: '-10.0000', userId: mockUserId, createdAt: new Date() },
        { id: 'tx-2', amount: '-5.0000', userId: mockUserId, createdAt: new Date() },
      ];
      const mockDb = createMockDb({
        userTransactionsMany: mockRecords,
        selectChains: [whereChain([{ count: 25 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getTransactions(10, 0);

      expect(result.list).toEqual(mockRecords);
      expect(result.total).toBe(25);
    });

    it('should use defaults when no arguments are provided', async () => {
      const mockDb = createMockDb({
        userTransactionsMany: [],
        selectChains: [whereChain([{ count: 0 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getTransactions();

      expect(result.list).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockDb.query.userTransactions.findMany).toHaveBeenCalledOnce();
    });

    it('should filter by month when mo parameter is provided', async () => {
      const mockDb = createMockDb({
        userTransactionsMany: [],
        selectChains: [whereChain([{ count: 5 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getTransactions(20, 0, '2026-01');

      expect(result.total).toBe(5);
    });

    it('should filter by date range when dateFrom and dateTo are provided', async () => {
      const mockDb = createMockDb({
        userTransactionsMany: [],
        selectChains: [whereChain([{ count: 3 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getTransactions(20, 0, undefined, '2026-01-01', '2026-01-31');

      expect(result.total).toBe(3);
    });

    it('should handle null count gracefully', async () => {
      const mockDb = createMockDb({
        userTransactionsMany: [],
        selectChains: [whereChain([{ count: null }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getTransactions();

      expect(result.total).toBe(0);
    });
  });

  // -------------------------
  // getConsumptionDetails
  // -------------------------
  describe('getConsumptionDetails', () => {
    it('should return mapped consumption details with correct fields', async () => {
      const mockRecord = {
        transaction: {
          id: 'tx-1',
          amount: '-15.5000',
          refId: 'msg-1',
          metadata: {
            model: 'gpt-4',
            provider: 'openai',
            totalInputTokens: 1000,
            totalOutputTokens: 500,
          },
          userId: mockUserId,
          type: 'CONSUMPTION',
          createdAt: new Date(),
        },
        message: null,
      };
      const mockDb = createMockDb({
        selectChains: [offsetChain([mockRecord]), whereChain([{ count: 1 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.total).toBe(1);
      expect(result.list).toHaveLength(1);
      expect(result.list[0].model).toBe('gpt-4');
      expect(result.list[0].provider).toBe('openai');
      expect(result.list[0].credits).toBe(15.5);
      expect(result.list[0].totalInputTokens).toBe(1000);
      expect(result.list[0].totalOutputTokens).toBe(500);
      expect(result.list[0].totalTokens).toBe(1500);
    });

    it('should fall back to message fields when transaction metadata is empty', async () => {
      const mockRecord = {
        transaction: {
          id: 'tx-2',
          amount: '-5.0000',
          refId: 'msg-2',
          metadata: {},
          userId: mockUserId,
          type: 'CONSUMPTION',
          createdAt: new Date(),
        },
        message: {
          id: 'msg-2',
          model: 'claude-3',
          provider: 'anthropic',
          metadata: { totalInputTokens: 200, totalOutputTokens: 100 },
        },
      };
      const mockDb = createMockDb({
        selectChains: [offsetChain([mockRecord]), whereChain([{ count: 1 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].model).toBe('claude-3');
      expect(result.list[0].provider).toBe('anthropic');
      expect(result.list[0].totalInputTokens).toBe(200);
      expect(result.list[0].totalOutputTokens).toBe(100);
    });

    it('should detect image usageType from metadata.type field', async () => {
      const mockRecord = {
        transaction: {
          id: 'tx-3',
          amount: '-20.0000',
          refId: 'gen_abc123',
          metadata: { type: 'image' },
          userId: mockUserId,
          type: 'CONSUMPTION',
          createdAt: new Date(),
        },
        message: null,
      };
      const mockDb = createMockDb({
        selectChains: [offsetChain([mockRecord]), whereChain([{ count: 1 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('image');
    });

    it('should detect image usageType from gen_ prefixed refId when metadata.type is absent', async () => {
      const mockRecord = {
        transaction: {
          id: 'tx-4',
          amount: '-8.0000',
          refId: 'gen_xyz789',
          metadata: {},
          userId: mockUserId,
          type: 'CONSUMPTION',
          createdAt: new Date(),
        },
        message: null,
      };
      const mockDb = createMockDb({
        selectChains: [offsetChain([mockRecord]), whereChain([{ count: 1 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('image');
    });

    it('should default usageType to "chat" when no type indicators are present', async () => {
      const mockRecord = {
        transaction: {
          id: 'tx-5',
          amount: '-3.0000',
          refId: 'msg-5',
          metadata: {},
          userId: mockUserId,
          type: 'CONSUMPTION',
          createdAt: new Date(),
        },
        message: null,
      };
      const mockDb = createMockDb({
        selectChains: [offsetChain([mockRecord]), whereChain([{ count: 1 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('chat');
    });

    it('should return empty list and zero total when no records match', async () => {
      const mockDb = createMockDb({
        selectChains: [offsetChain([]), whereChain([{ count: 0 }])],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getConsumptionDetails(20, 0, { model: 'gpt-4' });

      expect(result.total).toBe(0);
      expect(result.list).toHaveLength(0);
    });
  });

  // -------------------------
  // getUsageDetails
  // -------------------------
  describe('getUsageDetails', () => {
    it('should combine and sort transactions and embedding logs by date (newest first)', async () => {
      const olderDate = new Date('2026-01-01T10:00:00Z');
      const newerDate = new Date('2026-01-15T10:00:00Z');

      const txRecord = {
        transaction: {
          id: 'tx-1',
          amount: '-10.0000',
          refId: 'msg-1',
          metadata: {},
          createdAt: olderDate,
          userId: mockUserId,
          type: 'CONSUMPTION',
          category: null,
        },
        message: null,
      };

      const embLog = {
        id: 'emb-1',
        userId: mockUserId,
        fileId: 'file-1',
        modelId: 'text-embedding-ada-002',
        providerId: 'openai',
        inputTokens: 500,
        totalTokens: 500,
        chunkCount: 10,
        costPrice: '0.01',
        operationType: 'file_embedding',
        createdAt: newerDate,
      };

      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain([txRecord]),
          whereOrderByChain([embLog]),
          whereChain([{ count: 1 }]),
          whereChain([{ count: 1 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(20, 0);

      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
      // Newest embedding log should come first
      expect(result.list[0].source).toBe('embedding');
      expect(result.list[1].source).toBe('transaction');
    });

    it('should map embedding logs to unified format correctly', async () => {
      const embLog = {
        id: 42,
        userId: mockUserId,
        fileId: 'file-2',
        modelId: 'embed-model',
        providerId: 'my-provider',
        inputTokens: 300,
        totalTokens: 300,
        chunkCount: 5,
        costPrice: '0.005',
        operationType: 'semantic_search',
        createdAt: new Date(),
      };

      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain([]),
          whereOrderByChain([embLog]),
          whereChain([{ count: 0 }]),
          whereChain([{ count: 1 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(20, 0);

      const item = result.list[0];
      expect(item.id).toBe('emb_42');
      expect(item.model).toBe('embed-model');
      expect(item.provider).toBe('my-provider');
      expect(item.source).toBe('embedding');
      expect(item.usageType).toBe('embedding');
      expect(item.credits).toBe(0);
      expect(item.totalInputTokens).toBe(300);
      expect(item.totalOutputTokens).toBe(0);
      expect(item.totalTokens).toBe(300);
      expect(item.operationType).toBe('semantic_search');
    });

    it('should apply pagination offset and limit to combined results', async () => {
      const txRecords = Array.from({ length: 5 }, (_, i) => ({
        transaction: {
          id: `tx-${i}`,
          amount: '-1.0000',
          refId: `msg-${i}`,
          metadata: {},
          createdAt: new Date(2026, 0, i + 1),
          userId: mockUserId,
          type: 'CONSUMPTION',
          category: null,
        },
        message: null,
      }));

      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain(txRecords),
          whereOrderByChain([]),
          whereChain([{ count: 5 }]),
          whereChain([{ count: 0 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(2, 2);

      expect(result.total).toBe(5);
      expect(result.list).toHaveLength(2);
    });

    it('should filter by month when mo parameter is provided', async () => {
      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain([]),
          whereOrderByChain([]),
          whereChain([{ count: 0 }]),
          whereChain([{ count: 0 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(20, 0, '2026-02');

      expect(result.total).toBe(0);
      expect(result.list).toHaveLength(0);
    });

    it('should classify transaction as chat usageType when joined message exists', async () => {
      const txRecord = {
        transaction: {
          id: 'tx-chat',
          amount: '-2.0000',
          refId: 'msg-chat',
          metadata: {},
          createdAt: new Date(),
          userId: mockUserId,
          type: 'CONSUMPTION',
          category: null,
        },
        message: {
          id: 'msg-chat',
          model: 'gpt-3.5',
          provider: 'openai',
          metadata: {},
        },
      };

      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain([txRecord]),
          whereOrderByChain([]),
          whereChain([{ count: 1 }]),
          whereChain([{ count: 0 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(20, 0);

      expect(result.list[0].usageType).toBe('chat');
    });

    it('should classify transaction as image when refId starts with gen_', async () => {
      const txRecord = {
        transaction: {
          id: 'tx-img',
          amount: '-5.0000',
          refId: 'gen_abc',
          metadata: {},
          createdAt: new Date(),
          userId: mockUserId,
          type: 'CONSUMPTION',
          category: null,
        },
        message: null,
      };

      const mockDb = createMockDb({
        selectChains: [
          leftJoinOrderByChain([txRecord]),
          whereOrderByChain([]),
          whereChain([{ count: 1 }]),
          whereChain([{ count: 0 }]),
        ],
      });
      const service = new UserUsageService(mockDb, mockUserId);

      const result = await service.getUsageDetails(20, 0);

      expect(result.list[0].usageType).toBe('image');
    });
  });
});
