import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock idGenerator to return predictable IDs
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_mock_id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  const createMockTx = (balanceOverrides?: Partial<Record<string, any>>) => {
    const defaultBalance = {
      userId,
      balance: '100.0000',
      isUnlimited: false,
      ...balanceOverrides,
    };

    const mockTx = {
      query: {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(defaultBalance),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    return mockTx;
  };

  beforeEach(() => {
    mockDb = {
      query: {
        modelPricings: {
          findFirst: vi.fn(),
        },
        userBalances: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      // Should not query pricing for own-config users
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when pricing is not found for the model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(result).toBe(0);
    });

    it('should calculate cost based on input and output tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',   // 10 credits per 1M tokens
        userOutputPrice: '30.0',  // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 100K input tokens + 50K output tokens
      const result = await service.calculateCost('gpt-4', 'openai', 100_000, 50_000);

      // (100_000 / 1_000_000) * 10 + (50_000 / 1_000_000) * 30 = 1 + 1.5 = 2.5
      expect(result).toBeCloseTo(2.5);
    });

    it('should include per-request price in cost calculation', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5.0',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(result).toBe(5.0);
    });

    it('should return 0 cost for zero tokens with no per-request price', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '30.0',
        perRequestPrice: '0',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(result).toBe(0);
    });

    it('should handle null pricing fields gracefully (default to 0)', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'some-model',
        provider: 'some-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('some-model', 'some-provider', 1000, 500);

      expect(result).toBe(0);
    });

    it('should combine all pricing components correctly', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'deepseek-chat',
        provider: 'protochat',
        userInputPrice: '2.0',   // 2 credits per 1M tokens
        userOutputPrice: '8.0',  // 8 credits per 1M tokens
        perRequestPrice: '0.1',  // 0.1 credits per request
        subProvider: 'deepseek',
      });

      // 1M input + 1M output tokens
      const result = await service.calculateCost(
        'deepseek-chat',
        'protochat',
        1_000_000,
        1_000_000,
      );

      // (1_000_000 / 1_000_000) * 2 + (1_000_000 / 1_000_000) * 8 + 0.1 = 2 + 8 + 0.1 = 10.1
      expect(result).toBeCloseTo(10.1);
    });

    it('should default isUserConfig to false when not provided', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      // Call without isUserConfig argument (defaults to false)
      await service.calculateCost('gpt-4', 'openai', 100, 50);

      // Should have attempted to query pricing
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });
  });

  describe('deductCredits', () => {
    it('should return early when amount is 0', async () => {
      await service.deductCredits(0, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early when amount is negative', async () => {
      await service.deductCredits(-5, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance is not found', async () => {
      mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const mockTx = createMockTx({ balance: '5.0000', isUnlimited: false });
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should allow deduction when user has unlimited balance', async () => {
      const mockTx = createMockTx({ balance: '0.0000', isUnlimited: true });

      mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockTx);
      });

      // Should NOT throw even with 0 balance because isUnlimited is true
      const result = await service.deductCredits(100, 'test');

      // For unlimited users, the new balance calculation: 0 - 100 = -100
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should deduct credits and create transaction record on success', async () => {
      const mockTx = createMockTx({ balance: '100.0000', isUnlimited: false });

      mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockTx);
      });

      const result = await service.deductCredits(25.5, 'AI chat', 'msg-ref-id', { model: 'gpt-4' });

      // Verify balance was updated
      expect(mockTx.update).toHaveBeenCalled();

      // Verify transaction record was inserted
      expect(mockTx.insert).toHaveBeenCalled();

      // Result should be new balance (100 - 25.5 = 74.5)
      expect(result).toBeCloseTo(74.5);
    });

    it('should pass correct data to transaction insert', async () => {
      const insertValuesMock = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              userId,
              balance: '100.0000',
              isUnlimited: false,
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: insertValuesMock,
        }),
      };

      mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockTx);
      });

      await service.deductCredits(10, 'chat completion', 'msg-123', { model: 'gpt-4' });

      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-10.0000',
          balanceAfter: '90.0000',
          category: 'CONSUMPTION',
          description: 'chat completion',
          id: 'tx_mock_id',
          metadata: { model: 'gpt-4' },
          refId: 'msg-123',
          type: 'CONSUMPTION',
          userId,
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance record is not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance > 0 and estimatedAmount is 0 (default)', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and estimatedAmount is 0 (default)', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return false when balance is less than estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true when balance equals estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(true);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should query balance for the correct user', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      await service.hasEnoughCredits();

      expect(mockDb.query.userBalances.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
    });
  });
});
