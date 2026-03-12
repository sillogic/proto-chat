// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_mock_id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  const mockUserId = 'user-123';

  // Mock database builder helpers
  const createMockDb = (overrides: Record<string, any> = {}) => {
    const mockUpdateSet = vi.fn().mockReturnThis();
    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockReturnValue({
      set: mockUpdateSet,
    });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      return fn(overrides.tx || mockDb);
    });

    const mockDb: any = {
      insert: mockInsert,
      query: {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      transaction: mockTransaction,
      update: mockUpdate,
      ...overrides,
    };

    return mockDb;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------
  // calculateCost
  // -------------------------
  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const mockDb = createMockDb();
      service = new CreditService(mockDb, mockUserId);

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, 0, true);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);
      service = new CreditService(mockDb, mockUserId);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        model: 'gpt-4',
        perRequestPrice: '0',
        provider: 'openai',
        userInputPrice: '10', // 10 credits per 1M tokens
        userOutputPrice: '30', // 30 credits per 1M tokens
      };
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);
      service = new CreditService(mockDb, mockUserId);

      // 1,000,000 input tokens + 1,000,000 output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(40); // 10 + 30
    });

    it('should include perRequestPrice in cost', async () => {
      const mockPricing = {
        model: 'gpt-4',
        perRequestPrice: '5',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
      };
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);
      service = new CreditService(mockDb, mockUserId);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(cost).toBe(5);
    });

    it('should handle missing price fields gracefully (default to 0)', async () => {
      const mockPricing = {
        model: 'gpt-4',
        perRequestPrice: null,
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
      };
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);
      service = new CreditService(mockDb, mockUserId);

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should default isUserConfig to false when not provided', async () => {
      const mockPricing = {
        model: 'gpt-4',
        perRequestPrice: '0',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
      };
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);
      service = new CreditService(mockDb, mockUserId);

      const cost = await service.calculateCost('gpt-4', 'openai', 500_000, 0);

      // 500000 / 1000000 * 10 = 5
      expect(cost).toBe(5);
    });

    it('should query pricing with correct model and provider', async () => {
      const mockDb = createMockDb();
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);
      service = new CreditService(mockDb, mockUserId);

      await service.calculateCost('claude-3', 'anthropic', 100, 50);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledOnce();
    });
  });

  // -------------------------
  // deductCredits
  // -------------------------
  describe('deductCredits', () => {
    it('should return early without any db calls when amount is 0', async () => {
      const mockDb = createMockDb();
      service = new CreditService(mockDb, mockUserId);

      await service.deductCredits(0, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early without any db calls when amount is negative', async () => {
      const mockDb = createMockDb();
      service = new CreditService(mockDb, mockUserId);

      await service.deductCredits(-5, 'negative amount');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw an error when user balance is not found', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };

      const mockDb = createMockDb();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx));
      service = new CreditService(mockDb, mockUserId);

      await expect(service.deductCredits(10, 'description')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw an error when user has insufficient credits', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              balance: '5.0000',
              isUnlimited: false,
              userId: mockUserId,
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };

      const mockDb = createMockDb();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx));
      service = new CreditService(mockDb, mockUserId);

      await expect(service.deductCredits(10, 'description')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should successfully deduct credits and create transaction record', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              balance: '100.0000',
              isUnlimited: false,
              userId: mockUserId,
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };

      const mockDb = createMockDb();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx));
      service = new CreditService(mockDb, mockUserId);

      const result = await service.deductCredits(25, 'test charge', 'ref-1', { extra: 'data' });

      expect(result).toBeCloseTo(75);
      expect(mockTx.update).toHaveBeenCalledOnce();
      expect(mockTx.insert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-25.0000',
          balanceAfter: '75.0000',
          category: 'CONSUMPTION',
          description: 'test charge',
          id: 'tx_mock_id',
          metadata: { extra: 'data' },
          refId: 'ref-1',
          type: 'CONSUMPTION',
          userId: mockUserId,
        }),
      );
    });

    it('should allow deduction when balance is unlimited (even if balance < amount)', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              balance: '0.0000',
              isUnlimited: true,
              userId: mockUserId,
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };

      const mockDb = createMockDb();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx));
      service = new CreditService(mockDb, mockUserId);

      // Should not throw even though balance (0) < amount (10)
      const result = await service.deductCredits(10, 'unlimited user charge');

      expect(result).toBeCloseTo(-10);
      expect(mockTx.insert).toHaveBeenCalledOnce();
    });

    it('should use exact balance precision in transaction record', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              balance: '50.1234',
              isUnlimited: false,
              userId: mockUserId,
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };

      const mockDb = createMockDb();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx));
      service = new CreditService(mockDb, mockUserId);

      await service.deductCredits(0.5, 'precise charge');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-0.5000',
          balanceAfter: '49.6234',
        }),
      );
    });
  });

  // -------------------------
  // hasEnoughCredits
  // -------------------------
  describe('hasEnoughCredits', () => {
    it('should return false when user balance record does not exist', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance isUnlimited regardless of amount', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '0.0000',
        isUnlimited: true,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits(9999);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and estimatedAmount is 0', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '10.0000',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and estimatedAmount is 0', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '0.0000',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '100.0000',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '50.0000',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(false);
    });

    it('should default estimatedAmount to 0 when not provided', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '5.0000',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is exactly 0 and no estimatedAmount provided', async () => {
      const mockDb = createMockDb();
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        balance: '0',
        isUnlimited: false,
        userId: mockUserId,
      });
      service = new CreditService(mockDb, mockUserId);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });
  });
});
