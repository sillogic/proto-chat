import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';
import { userBalances, userTransactions, modelPricings } from '@/database/schemas';

import { CreditService } from './index';

// Mock console methods to avoid noise in test output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  // Helper function to create a mock database query chain
  const createMockQueryChain = (returnValue: any) => {
    return {
      findFirst: vi.fn().mockResolvedValue(returnValue),
    };
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      query: {
        userBalances: createMockQueryChain(null),
        modelPricings: createMockQueryChain(null),
      },
      transaction: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] User using own config for openai, no charge',
      );
    });

    it('should return 0 when pricing is not found', async () => {
      // Mock no pricing found
      mockDb.query.modelPricings = createMockQueryChain(null);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[Credit] No pricing found for unknown-provider::unknown-model, no charge',
      );
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000', // $10 per 1M tokens
        userOutputPrice: '30.0000', // $30 per 1M tokens
        perRequestPrice: '0.0010', // $0.001 per request
        subProvider: null,
      };

      mockDb.query.modelPricings = createMockQueryChain(mockPricing);

      // 100k input tokens + 50k output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 100_000, 50_000);

      // Expected: (100k / 1M) * 10 + (50k / 1M) * 30 + 0.001
      // = 0.1 * 10 + 0.05 * 30 + 0.001
      // = 1.0 + 1.5 + 0.001 = 2.501
      expect(cost).toBeCloseTo(2.501, 4);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Credit] Charging for openai::gpt-4'),
      );
    });

    it('should calculate cost with subProvider information', async () => {
      const mockPricing = {
        model: 'deepseek/deepseek-chat-v3.1',
        provider: 'protochat',
        userInputPrice: '5.0000',
        userOutputPrice: '15.0000',
        perRequestPrice: '0.0000',
        subProvider: 'deepseek',
      };

      mockDb.query.modelPricings = createMockQueryChain(mockPricing);

      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        1_000_000,
        500_000,
      );

      // Expected: (1M / 1M) * 5 + (500k / 1M) * 15 + 0
      // = 1 * 5 + 0.5 * 15 = 5 + 7.5 = 12.5
      expect(cost).toBeCloseTo(12.5, 4);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('(via deepseek)'),
      );
    });

    it('should handle zero tokens', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '30.0000',
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query.modelPricings = createMockQueryChain(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      // Only per-request cost
      expect(cost).toBeCloseTo(0.001, 4);
    });

    it('should handle null pricing fields as zero', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      };

      mockDb.query.modelPricings = createMockQueryChain(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(cost).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct credits when amount is zero', async () => {
      await service.deductCredits(0, 'Test transaction');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct credits when amount is negative', async () => {
      await service.deductCredits(-5, 'Test transaction');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      const mockTx = {
        query: {
          userBalances: createMockQueryChain(null),
        },
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when insufficient credits for non-unlimited account', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockTx = {
        query: {
          userBalances: createMockQueryChain(mockBalance),
        },
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should deduct credits successfully for sufficient balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: createMockQueryChain(mockBalance),
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      const result = await service.deductCredits(25.5, 'Test transaction', 'ref-123', {
        foo: 'bar',
      });

      expect(result).toBeCloseTo(74.5, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction for unlimited accounts even with zero balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: createMockQueryChain(mockBalance),
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      const result = await service.deductCredits(50, 'Test transaction');

      expect(result).toBeCloseTo(-50, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create transaction record with correct format', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      };

      let capturedTransactionData: any;

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((data) => {
          capturedTransactionData = data;
          return Promise.resolve(undefined);
        }),
      });

      const mockTx = {
        query: {
          userBalances: createMockQueryChain(mockBalance),
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      await service.deductCredits(15.25, 'Model usage', 'msg-123', { model: 'gpt-4' });

      expect(capturedTransactionData).toMatchObject({
        amount: '-15.2500',
        balanceAfter: '84.7500',
        category: 'CONSUMPTION',
        description: 'Model usage',
        type: 'CONSUMPTION',
        userId: userId,
        refId: 'msg-123',
        metadata: { model: 'gpt-4' },
      });
      expect(capturedTransactionData.id).toMatch(/^tx/);
    });

    it('should handle decimal precision correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.1234',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: createMockQueryChain(mockBalance),
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx as any);
      });

      const result = await service.deductCredits(0.0012, 'Small transaction');

      expect(result).toBeCloseTo(10.1222, 4);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      mockDb.query.userBalances = createMockQueryChain(null);

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true for unlimited account regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than zero with no estimatedAmount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when balance is zero with no estimatedAmount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '25.5000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(25.5);

      expect(result).toBe(true);
    });

    it('should handle very small balances correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '10.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should handle negative balance for unlimited account', async () => {
      const mockBalance = {
        userId: userId,
        balance: '-50.0000',
        isUnlimited: true,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances = createMockQueryChain(mockBalance);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });
  });
});
