// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';
import { modelPricings, userBalances, userTransactions } from '@/database/schemas';
import { idGenerator } from '@/database/utils/idGenerator';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'mock-tx-id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.000000', // 10 credits per 1M tokens
        userOutputPrice: '30.000000', // 30 credits per 1M tokens
        perRequestPrice: '0.000000',
        subProvider: null,
      });

      // 1000 input tokens = 0.001M tokens * 10 = 0.01 credits
      // 500 output tokens = 0.0005M tokens * 30 = 0.015 credits
      // Total = 0.01 + 0.015 = 0.025 credits
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(cost).toBeCloseTo(0.025, 6);
    });

    it('should calculate cost with per-request pricing', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '5.000000',
        userOutputPrice: '15.000000',
        perRequestPrice: '0.001000', // 0.001 credits per request
        subProvider: null,
      });

      // 2000 input tokens = 0.002M * 5 = 0.01
      // 1000 output tokens = 0.001M * 15 = 0.015
      // Per request = 0.001
      // Total = 0.01 + 0.015 + 0.001 = 0.026
      const cost = await service.calculateCost('claude-3', 'anthropic', 2000, 1000);

      expect(cost).toBeCloseTo(0.026, 6);
    });

    it('should handle pricing with subProvider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'protochat',
        userInputPrice: '8.000000',
        userOutputPrice: '24.000000',
        perRequestPrice: '0.000000',
        subProvider: 'openrouter',
      });

      const cost = await service.calculateCost('gpt-4', 'protochat', 1000000, 500000);

      // 1M input tokens * 8 = 8 credits
      // 0.5M output tokens * 24 = 12 credits
      // Total = 20 credits
      expect(cost).toBeCloseTo(20, 6);
    });

    it('should handle zero tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.000000',
        userOutputPrice: '30.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
      });

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(cost).toBe(0);
    });

    it('should handle null pricing values as zero', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const cost = await service.calculateCost('test-model', 'test-provider', 1000, 500);

      expect(cost).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is zero', async () => {
      await service.deductCredits(0, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-5, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should deduct credits and create transaction successfully', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      const result = await service.deductCredits(10.5, 'Model usage', 'msg-123', {
        model: 'gpt-4',
      });

      expect(result).toBeCloseTo(89.5, 4);
      expect(mockTx.update).toHaveBeenCalledWith(userBalances);
      expect(mockTx.insert).toHaveBeenCalledWith(userTransactions);
    });

    it('should throw error when user balance not found', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue(null);

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should allow deduction for unlimited balance users', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      const result = await service.deductCredits(100, 'test unlimited');

      expect(result).toBeCloseTo(-95, 4);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should handle deduction with metadata and refId', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      await service.deductCredits(5.5, 'API call', 'msg-456', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        tokens: { input: 100, output: 50 },
      });

      expect(mockTx.insert).toHaveBeenCalledWith(userTransactions);
    });

    it('should handle floating point precision correctly', async () => {
      const mockTx = createMockTransaction();
      mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.1234',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => callback(mockTx));

      const result = await service.deductCredits(0.0005, 'tiny deduction');

      // 10.1234 - 0.0005 = 10.1229
      expect(result).toBeCloseTo(10.1229, 4);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits(30);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '20.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits(30);

      expect(result).toBe(false);
    });

    it('should return true when balance equals estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '25.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasEnoughCredits(25);

      expect(result).toBe(true);
    });

    it('should handle very small balances and estimates', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const resultEnough = await service.hasEnoughCredits(0.00005);
      const resultInsufficient = await service.hasEnoughCredits(0.0002);

      expect(resultEnough).toBe(true);
      expect(resultInsufficient).toBe(false);
    });
  });
});

// Helper function to create a mock database
function createMockDb() {
  return {
    query: {
      modelPricings: {
        findFirst: vi.fn(),
      },
      userBalances: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  } as any;
}

// Helper function to create a mock transaction
function createMockTransaction() {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockValues = vi.fn().mockResolvedValue(undefined);

  return {
    query: {
      userBalances: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: mockSet,
    }),
    insert: vi.fn().mockReturnValue({
      values: mockValues,
    }),
  } as any;
}
