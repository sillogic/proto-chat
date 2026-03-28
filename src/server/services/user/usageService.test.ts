// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserUsageService } from './usageService';

// Mock CreditService
vi.mock('@/server/services/credit', () => ({
  CreditService: vi.fn().mockImplementation(() => ({
    hasEnoughCredits: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock database schemas (drizzle operators reference schema objects)
vi.mock('@/database/schemas', () => ({
  embeddings: { userId: 'embeddings.userId' },
  embeddingUsageLogs: {
    userId: 'embeddingUsageLogs.userId',
    createdAt: 'embeddingUsageLogs.createdAt',
  },
  files: { userId: 'files.userId', size: 'files.size' },
  messages: { id: 'messages.id' },
  subscriptionPlans: { id: 'subscriptionPlans.id', slug: 'subscriptionPlans.slug' },
  userBalances: { userId: 'userBalances.userId' },
  userExtensions: { userId: 'userExtensions.userId' },
  userTransactions: {
    amount: 'userTransactions.amount',
    createdAt: 'userTransactions.createdAt',
    metadata: 'userTransactions.metadata',
    refId: 'userTransactions.refId',
    type: 'userTransactions.type',
    userId: 'userTransactions.userId',
  },
}));

/**
 * Creates a chainable select mock that supports arbitrary chaining
 * (from, where, leftJoin, orderBy, limit, offset) and resolves to returnValue when awaited.
 * Uses a Proxy wrapping a real Promise to avoid making plain objects thenable.
 */
const createSelectChain = (returnValue: any): any => {
  const resolved = Promise.resolve(returnValue);
  return new Proxy(resolved, {
    get(target, prop) {
      // Delegate Promise methods to the underlying Promise
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      // All chaining methods (from, where, leftJoin, orderBy, limit, offset)
      // return a new chain with the same resolved value
      return () => createSelectChain(returnValue);
    },
  });
};

const createMockDb = (overrides: Record<string, any> = {}) => {
  const mockDb: any = {
    query: {
      embeddingUsageLogs: { findMany: vi.fn() },
      subscriptionPlans: { findFirst: vi.fn().mockResolvedValue(null) },
      userBalances: { findFirst: vi.fn().mockResolvedValue(null) },
      userExtensions: { findFirst: vi.fn().mockResolvedValue(null) },
      userTransactions: { findMany: vi.fn().mockResolvedValue([]) },
    },
    select: vi.fn(),
    ...overrides,
  };
  return mockDb;
};

describe('UserUsageService', () => {
  let service: UserUsageService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new UserUsageService(mockDb, userId);
  });

  // -------------------------
  // checkTokenLimit
  // -------------------------
  describe('checkTokenLimit', () => {
    it('should not throw when user has enough credits', async () => {
      const { CreditService } = await import('@/server/services/credit');
      (CreditService as any).mockImplementation(() => ({
        hasEnoughCredits: vi.fn().mockResolvedValue(true),
      }));

      service = new UserUsageService(mockDb, userId);

      await expect(service.checkTokenLimit()).resolves.toBeUndefined();
    });

    it('should throw TRPCError FORBIDDEN when user has insufficient credits', async () => {
      const { CreditService } = await import('@/server/services/credit');
      (CreditService as any).mockImplementation(() => ({
        hasEnoughCredits: vi.fn().mockResolvedValue(false),
      }));

      service = new UserUsageService(mockDb, userId);

      await expect(service.checkTokenLimit()).rejects.toThrow(TRPCError);
      await expect(service.checkTokenLimit()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // -------------------------
  // checkFileStorageLimit
  // -------------------------
  describe('checkFileStorageLimit', () => {
    it('should not throw when usage is within default 512MB limit', async () => {
      const storageBytes = 100 * 1024 * 1024; // 100MB used
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ totalSize: storageBytes }]));

      await expect(service.checkFileStorageLimit(10 * 1024 * 1024)).resolves.toBeUndefined();
    });

    it('should throw TRPCError FORBIDDEN when storage limit is exceeded', async () => {
      const storageBytes = 510 * 1024 * 1024; // 510MB used
      const incomingSize = 10 * 1024 * 1024; // 10MB incoming => total 520MB > 512MB

      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ totalSize: storageBytes }]));

      await expect(service.checkFileStorageLimit(incomingSize)).rejects.toThrow(TRPCError);
      await expect(service.checkFileStorageLimit(incomingSize)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should use plan storageLimit when user has a plan by planId', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({ planId: 'plan-123', userId });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        id: 'plan-123',
        storageLimit: 1024, // 1024MB plan
      });

      const storageBytes = 900 * 1024 * 1024; // 900MB used — within 1024MB limit
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ totalSize: storageBytes }]));

      await expect(service.checkFileStorageLimit(10 * 1024 * 1024)).resolves.toBeUndefined();
    });

    it('should use plan storageLimit when user has currentPlan slug', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({ currentPlan: 'pro', userId });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        slug: 'pro',
        storageLimit: 2048,
      });

      mockDb.select = vi
        .fn()
        .mockReturnValue(createSelectChain([{ totalSize: 100 * 1024 * 1024 }]));

      await expect(service.checkFileStorageLimit(0)).resolves.toBeUndefined();
    });

    it('should handle zero incomingSize correctly', async () => {
      const storageBytes = 511 * 1024 * 1024; // 511MB used, just within 512MB
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ totalSize: storageBytes }]));

      await expect(service.checkFileStorageLimit(0)).resolves.toBeUndefined();
    });

    it('should handle null totalSize from database', async () => {
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ totalSize: null }]));

      await expect(service.checkFileStorageLimit(0)).resolves.toBeUndefined();
    });
  });

  // -------------------------
  // checkVectorStorageLimit
  // -------------------------
  describe('checkVectorStorageLimit', () => {
    it('should skip check when vectorLimit is 0 (unlimited)', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({ planId: 'plan-123', userId });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        id: 'plan-123',
        vectorLimit: 0,
      });

      await expect(service.checkVectorStorageLimit(1000)).resolves.toBeUndefined();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should skip check when no plan found (vectorLimit defaults to 0)', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue(null);

      await expect(service.checkVectorStorageLimit(1000)).resolves.toBeUndefined();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should not throw when vector count is within limit', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({ planId: 'plan-123', userId });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        id: 'plan-123',
        vectorLimit: 10_000,
      });
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 5000 }]));

      await expect(service.checkVectorStorageLimit(1000)).resolves.toBeUndefined();
    });

    it('should throw TRPCError FORBIDDEN when vector count exceeds limit', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({ planId: 'plan-123', userId });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        id: 'plan-123',
        vectorLimit: 5000,
      });
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 4999 }]));

      await expect(service.checkVectorStorageLimit(10)).rejects.toThrow(TRPCError);
      await expect(service.checkVectorStorageLimit(10)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // -------------------------
  // getAccountStatistics
  // -------------------------
  describe('getAccountStatistics', () => {
    beforeEach(() => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({ balance: '100.50', userId });
      mockDb.query.userExtensions.findFirst.mockResolvedValue({
        currentPlan: 'pro',
        planExpiresAt: new Date('2026-12-31'),
        userId,
      });
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue({
        credits: 500,
        name: 'Pro Plan',
        slug: 'pro',
        storageLimit: 1024,
        vectorLimit: 10_000,
      });
    });

    const setupStatsSelect = (consumption: number, storageMB: number, vectors: number) => {
      const storageBytes = storageMB * 1024 * 1024;
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createSelectChain([{ total: String(consumption) }]);
        if (callCount === 2) return createSelectChain([{ totalSize: storageBytes }]);
        return createSelectChain([{ count: vectors }]);
      });
    };

    it('should return account statistics with correct balance info', async () => {
      setupStatsSelect(25, 500, 3000);

      const result = await service.getAccountStatistics();

      expect(result.balance.current).toBe(100.5);
      expect(result.balance.currentPlan).toBe('Pro Plan');
      expect(result.balance.limit).toBe(500);
      expect(result.balance.planSlug).toBe('pro');
      expect(result.balance.totalConsumed).toBe(25);
    });

    it('should return correct storage info in MB', async () => {
      setupStatsSelect(0, 100, 0);

      const result = await service.getAccountStatistics();

      expect(result.storage.limitMB).toBe(1024);
      expect(result.storage.totalSizeMB).toBe(100);
    });

    it('should return vector usage info', async () => {
      setupStatsSelect(0, 0, 7500);

      const result = await service.getAccountStatistics();

      expect(result.vectors.count).toBe(7500);
      expect(result.vectors.limit).toBe(10_000);
    });

    it('should handle missing balance and return defaults', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);
      mockDb.query.userExtensions.findFirst.mockResolvedValue(null);
      mockDb.query.subscriptionPlans.findFirst.mockResolvedValue(null);

      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createSelectChain([{ total: null }]);
        if (callCount === 2) return createSelectChain([{ totalSize: null }]);
        return createSelectChain([{ count: null }]);
      });

      const result = await service.getAccountStatistics();

      expect(result.balance.current).toBe(0);
      expect(result.balance.currentPlan).toBe('Free Trial');
      expect(result.balance.limit).toBe(0);
      expect(result.balance.planSlug).toBe('free');
      expect(result.balance.totalConsumed).toBe(0);
      expect(result.storage.limitMB).toBe(512);
      expect(result.storage.totalSizeMB).toBe(0);
      expect(result.vectors.count).toBe(0);
      expect(result.vectors.limit).toBe(0);
    });

    it('should use provided month parameter for date range', async () => {
      setupStatsSelect(10, 0, 0);

      const result = await service.getAccountStatistics('2025-01');

      expect(result.balance.totalConsumed).toBe(10);
    });

    it('should return formatted plan expiry date', async () => {
      setupStatsSelect(0, 0, 0);

      const result = await service.getAccountStatistics();

      expect(result.resetCountdown.nextResetDate).toBe('2026-12-31');
    });

    it('should return dash when planExpiresAt is not set', async () => {
      mockDb.query.userExtensions.findFirst.mockResolvedValue({
        currentPlan: 'free',
        planExpiresAt: null,
        userId,
      });
      setupStatsSelect(0, 0, 0);

      const result = await service.getAccountStatistics();

      expect(result.resetCountdown.nextResetDate).toBe('-');
    });
  });

  // -------------------------
  // getTransactions
  // -------------------------
  describe('getTransactions', () => {
    it('should return paginated transaction list', async () => {
      const mockRecords = [
        { amount: '-10', createdAt: new Date(), id: 'tx-1', type: 'CONSUMPTION', userId },
        { amount: '-5', createdAt: new Date(), id: 'tx-2', type: 'CONSUMPTION', userId },
      ];
      mockDb.query.userTransactions.findMany.mockResolvedValue(mockRecords);
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 2 }]));

      const result = await service.getTransactions(20, 0);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty list when no transactions found', async () => {
      mockDb.query.userTransactions.findMany.mockResolvedValue([]);
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 0 }]));

      const result = await service.getTransactions();

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle month parameter for date filtering', async () => {
      mockDb.query.userTransactions.findMany.mockResolvedValue([]);
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 0 }]));

      const result = await service.getTransactions(20, 0, '2025-01');

      expect(result.total).toBe(0);
    });

    it('should handle dateFrom and dateTo parameters', async () => {
      mockDb.query.userTransactions.findMany.mockResolvedValue([]);
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: 0 }]));

      const result = await service.getTransactions(20, 0, undefined, '2025-01-01', '2025-01-31');

      expect(result.total).toBe(0);
    });

    it('should handle null count gracefully', async () => {
      mockDb.query.userTransactions.findMany.mockResolvedValue([]);
      mockDb.select = vi.fn().mockReturnValue(createSelectChain([{ count: null }]));

      const result = await service.getTransactions();

      expect(result.total).toBe(0);
    });
  });

  // -------------------------
  // getConsumptionDetails
  // -------------------------
  describe('getConsumptionDetails', () => {
    const makeTransaction = (overrides: Record<string, any> = {}) => ({
      amount: '-5',
      category: null,
      createdAt: new Date(),
      id: 'tx-1',
      metadata: {
        model: 'gpt-4',
        provider: 'openai',
        totalInputTokens: 100,
        totalOutputTokens: 50,
      },
      refId: 'msg-1',
      type: 'CONSUMPTION',
      updatedAt: new Date(),
      userId,
      ...overrides,
    });

    const makeMessage = (overrides: Record<string, any> = {}) => ({
      id: 'msg-1',
      metadata: {},
      model: 'gpt-4',
      provider: 'openai',
      ...overrides,
    });

    const setupConsumptionSelect = (records: any[], count: number) => {
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createSelectChain(records);
        return createSelectChain([{ count }]);
      });
    };

    it('should return mapped consumption details', async () => {
      const tx = makeTransaction();
      const msg = makeMessage();
      setupConsumptionSelect([{ message: msg, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.list[0].credits).toBe(5); // abs(-5)
      expect(result.list[0].model).toBe('gpt-4');
      expect(result.list[0].provider).toBe('openai');
      expect(result.list[0].totalInputTokens).toBe(100);
      expect(result.list[0].totalOutputTokens).toBe(50);
      expect(result.list[0].totalTokens).toBe(150);
    });

    it('should determine usageType as "chat" by default', async () => {
      const tx = makeTransaction({ metadata: {} });
      const msg = makeMessage();
      setupConsumptionSelect([{ message: msg, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('chat');
    });

    it('should determine usageType from metadata.type', async () => {
      const tx = makeTransaction({ metadata: { type: 'image' } });
      const msg = makeMessage();
      setupConsumptionSelect([{ message: msg, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('image');
    });

    it('should determine usageType as "image" from gen_ refId prefix', async () => {
      const tx = makeTransaction({ metadata: {}, refId: 'gen_abc123' });
      setupConsumptionSelect([{ message: null, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].usageType).toBe('image');
    });

    it('should fallback to message model/provider when metadata is empty', async () => {
      const tx = makeTransaction({ metadata: {} });
      const msg = makeMessage({ model: 'claude-3', provider: 'anthropic' });
      setupConsumptionSelect([{ message: msg, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].model).toBe('claude-3');
      expect(result.list[0].provider).toBe('anthropic');
    });

    it('should return dash when model/provider not found', async () => {
      const tx = makeTransaction({ metadata: {} });
      setupConsumptionSelect([{ message: null, transaction: tx }], 1);

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.list[0].model).toBe('-');
      expect(result.list[0].provider).toBe('-');
    });

    it('should filter by type=image when options.type is image', async () => {
      setupConsumptionSelect([], 0);

      const result = await service.getConsumptionDetails(20, 0, { type: 'image' });

      expect(result.list).toHaveLength(0);
    });

    it('should filter by type=chat when options.type is chat', async () => {
      setupConsumptionSelect([], 0);

      const result = await service.getConsumptionDetails(20, 0, { type: 'chat' });

      expect(result.list).toHaveLength(0);
    });

    it('should handle null count gracefully', async () => {
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createSelectChain([]);
        return createSelectChain([{ count: null }]);
      });

      const result = await service.getConsumptionDetails(20, 0);

      expect(result.total).toBe(0);
    });
  });

  // -------------------------
  // getUsageDetails
  // -------------------------
  describe('getUsageDetails', () => {
    const setupUsageSelect = (
      transactions: any[],
      embeddingLogs: any[],
      txCount: number,
      embCount: number,
    ) => {
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createSelectChain(transactions);
        if (callCount === 2) return createSelectChain(embeddingLogs);
        if (callCount === 3) return createSelectChain([{ count: txCount }]);
        return createSelectChain([{ count: embCount }]);
      });
    };

    it('should combine transaction and embedding records', async () => {
      const tx = {
        amount: '-5',
        category: null,
        createdAt: new Date('2025-01-15T10:00:00Z'),
        id: 'tx-1',
        metadata: { model: 'gpt-4', provider: 'openai' },
        refId: 'msg-1',
        type: 'CONSUMPTION',
        updatedAt: new Date(),
        userId,
      };
      const msg = { id: 'msg-1', metadata: {}, model: 'gpt-4', provider: 'openai' };

      const embLog = {
        chunkCount: 10,
        costPrice: '0.001',
        createdAt: new Date('2025-01-15T09:00:00Z'),
        fileId: 'file-1',
        id: 'emb-1',
        inputTokens: 500,
        modelId: 'text-embedding-3-small',
        operationType: 'file_embedding',
        providerId: 'openai',
        totalTokens: 500,
        userId,
      };

      setupUsageSelect([{ message: msg, transaction: tx }], [embLog], 1, 1);

      const result = await service.getUsageDetails(20, 0);

      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
      // Combined and sorted by date descending: tx first (10:00), then emb (09:00)
      expect(result.list[0].source).toBe('transaction');
      expect(result.list[1].source).toBe('embedding');
    });

    it('should format embedding entries with correct fields', async () => {
      const embLog = {
        chunkCount: 5,
        costPrice: '0.001',
        createdAt: new Date('2025-01-15T09:00:00Z'),
        fileId: 'file-1',
        id: 'emb-1',
        inputTokens: 200,
        modelId: 'text-embedding-ada-002',
        operationType: 'semantic_search',
        providerId: 'openai',
        totalTokens: 200,
        userId,
      };

      setupUsageSelect([], [embLog], 0, 1);

      const result = await service.getUsageDetails(20, 0);

      const embEntry = result.list[0];
      expect(embEntry.source).toBe('embedding');
      expect(embEntry.usageType).toBe('embedding');
      expect(embEntry.model).toBe('text-embedding-ada-002');
      expect(embEntry.provider).toBe('openai');
      expect(embEntry.credits).toBe(0);
      expect(embEntry.amount).toBe(0);
      expect(embEntry.totalInputTokens).toBe(200);
      expect(embEntry.totalOutputTokens).toBe(0);
      expect(embEntry.totalTokens).toBe(200);
      expect(embEntry.operationType).toBe('semantic_search');
      expect(embEntry.id).toBe('emb_emb-1');
    });

    it('should apply pagination to combined results', async () => {
      const makeTxRecord = (id: string, date: string) => ({
        message: null,
        transaction: {
          amount: '-1',
          category: null,
          createdAt: new Date(date),
          id,
          metadata: {},
          refId: null,
          type: 'CONSUMPTION',
          updatedAt: new Date(),
          userId,
        },
      });

      const txs = [
        makeTxRecord('tx-1', '2025-01-15T12:00:00Z'),
        makeTxRecord('tx-2', '2025-01-15T11:00:00Z'),
        makeTxRecord('tx-3', '2025-01-15T10:00:00Z'),
      ];

      setupUsageSelect(txs, [], 3, 0);

      const result = await service.getUsageDetails(2, 0);

      // Total is 3+0=3, but paginated to 2
      expect(result.total).toBe(3);
      expect(result.list).toHaveLength(2);
    });

    it('should sort combined results by date descending', async () => {
      const olderTx = {
        message: null,
        transaction: {
          amount: '-1',
          category: null,
          createdAt: new Date('2025-01-14T10:00:00Z'),
          id: 'tx-old',
          metadata: {},
          refId: null,
          type: 'CONSUMPTION',
          updatedAt: new Date(),
          userId,
        },
      };
      const newerEmb = {
        chunkCount: 1,
        costPrice: '0',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        fileId: null,
        id: 'emb-new',
        inputTokens: 10,
        modelId: 'model',
        operationType: 'file_embedding',
        providerId: 'openai',
        totalTokens: 10,
        userId,
      };

      setupUsageSelect([olderTx], [newerEmb], 1, 1);

      const result = await service.getUsageDetails(10, 0);

      // Newer embedding should come first
      expect(result.list[0].source).toBe('embedding');
      expect(result.list[1].source).toBe('transaction');
    });

    it('should filter by month when mo parameter provided', async () => {
      setupUsageSelect([], [], 0, 0);

      const result = await service.getUsageDetails(20, 0, '2025-01');

      expect(result.total).toBe(0);
      expect(result.list).toHaveLength(0);
    });
  });
});
