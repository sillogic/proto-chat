import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clientDB, initializeDB } from '@/database/client/db';
import { modelPricings, userBalances, userTransactions, users } from '@/database/schemas';
import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

await initializeDB();
const serverDB: LobeChatDatabase = clientDB as LobeChatDatabase;

const userId = 'credit-service-test-user-id';
const userId2 = 'credit-service-test-user-id-2';

beforeEach(async () => {
  // Clean up and insert test users
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: userId2 }]);

  // Insert test user balance
  await serverDB.insert(userBalances).values({
    balance: '100.0000',
    isUnlimited: false,
    totalPurchased: '100.0000',
    userId,
  });

  // Insert test user with unlimited balance
  await serverDB.insert(userBalances).values({
    balance: '0.0000',
    isUnlimited: true,
    totalPurchased: '0.0000',
    userId: userId2,
  });
});

afterEach(async () => {
  // Clean up test data
  await serverDB.delete(users).where(eq(users.id, userId));
  await serverDB.delete(users).where(eq(users.id, userId2));
  await serverDB.delete(userBalances).where(eq(userBalances.userId, userId));
  await serverDB.delete(userBalances).where(eq(userBalances.userId, userId2));
  await serverDB.delete(userTransactions).where(eq(userTransactions.userId, userId));
  await serverDB.delete(userTransactions).where(eq(userTransactions.userId, userId2));
  await serverDB.delete(modelPricings);
  vi.restoreAllMocks();
});

describe('CreditService', () => {
  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const creditService = new CreditService(serverDB, userId);
      const cost = await creditService.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true, // isUserConfig
      );

      expect(cost).toBe(0);
    });

    it('should return 0 when pricing is not found', async () => {
      const creditService = new CreditService(serverDB, userId);
      const cost = await creditService.calculateCost(
        'unknown-model',
        'unknown-provider',
        1000,
        500,
        false,
      );

      expect(cost).toBe(0);
    });

    it('should calculate cost correctly with pricing data', async () => {
      // Insert test pricing
      await serverDB.insert(modelPricings).values({
        inputPrice: '10.000000', // 10 credits per 1M tokens
        model: 'gpt-4',
        outputPrice: '20.000000', // 20 credits per 1M tokens
        perRequestPrice: '0.001000', // 0.001 credits per request
        provider: 'openai',
        userInputPrice: '15.000000', // 15 credits per 1M tokens (user price)
        userOutputPrice: '30.000000', // 30 credits per 1M tokens (user price)
      });

      const creditService = new CreditService(serverDB, userId);
      const cost = await creditService.calculateCost(
        'gpt-4',
        'openai',
        1_000_000, // 1M input tokens
        500_000, // 500K output tokens
        false,
      );

      // Expected: (1_000_000 / 1_000_000) * 15 + (500_000 / 1_000_000) * 30 + 0.001
      // = 1 * 15 + 0.5 * 30 + 0.001
      // = 15 + 15 + 0.001
      // = 30.001
      expect(cost).toBe(30.001);
    });

    it('should calculate cost with zero tokens', async () => {
      await serverDB.insert(modelPricings).values({
        inputPrice: '10.000000',
        model: 'gpt-4',
        outputPrice: '20.000000',
        perRequestPrice: '0.001000',
        provider: 'openai',
        userInputPrice: '15.000000',
        userOutputPrice: '30.000000',
      });

      const creditService = new CreditService(serverDB, userId);
      const cost = await creditService.calculateCost('gpt-4', 'openai', 0, 0, false);

      // Only per-request price should be charged
      expect(cost).toBe(0.001);
    });

    it('should handle subProvider information in logging', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await serverDB.insert(modelPricings).values({
        inputPrice: '10.000000',
        model: 'deepseek-chat',
        outputPrice: '20.000000',
        perRequestPrice: '0.000000',
        provider: 'protochat',
        subProvider: 'deepseek',
        userInputPrice: '15.000000',
        userOutputPrice: '30.000000',
      });

      const creditService = new CreditService(serverDB, userId);
      await creditService.calculateCost('deepseek-chat', 'protochat', 1000, 500, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(via deepseek)'),
      );
    });

    it('should handle pricing with string values that parse to 0', async () => {
      await serverDB.insert(modelPricings).values({
        inputPrice: '10.000000',
        model: 'test-model',
        outputPrice: '20.000000',
        perRequestPrice: '0.000000',
        provider: 'test-provider',
        userInputPrice: '0.000000',
        userOutputPrice: '0.000000',
      });

      const creditService = new CreditService(serverDB, userId);
      const cost = await creditService.calculateCost(
        'test-model',
        'test-provider',
        1_000_000,
        1_000_000,
        false,
      );

      // With 0 user prices, should return 0
      expect(cost).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      const creditService = new CreditService(serverDB, userId);
      await creditService.deductCredits(0, 'Test deduction');

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });

      expect(balance?.balance).toBe('100.0000');
    });

    it('should not deduct when amount is negative', async () => {
      const creditService = new CreditService(serverDB, userId);
      await creditService.deductCredits(-10, 'Test deduction');

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });

      expect(balance?.balance).toBe('100.0000');
    });

    it('should throw error when user balance not found', async () => {
      const creditService = new CreditService(serverDB, 'non-existent-user');

      await expect(
        creditService.deductCredits(10, 'Test deduction'),
      ).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      const creditService = new CreditService(serverDB, userId);

      await expect(
        creditService.deductCredits(150, 'Test deduction'),
      ).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and create transaction successfully', async () => {
      const creditService = new CreditService(serverDB, userId);
      const newBalance = await creditService.deductCredits(25.5, 'Test deduction');

      expect(newBalance).toBe(74.5);

      // Check balance was updated
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('74.5000');

      // Check transaction was created
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        amount: '-25.5000',
        balanceAfter: '74.5000',
        category: 'CONSUMPTION',
        description: 'Test deduction',
        type: 'CONSUMPTION',
        userId,
      });
    });

    it('should deduct credits with refId and metadata', async () => {
      const creditService = new CreditService(serverDB, userId);
      const metadata = { model: 'gpt-4', tokens: 1000 };

      await creditService.deductCredits(10, 'Model usage', 'msg_123', metadata);

      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        description: 'Model usage',
        metadata,
        refId: 'msg_123',
      });
    });

    it('should allow deduction for unlimited balance users', async () => {
      const creditService = new CreditService(serverDB, userId2);
      const newBalance = await creditService.deductCredits(1000, 'Test deduction');

      expect(newBalance).toBe(-1000);

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId2),
      });
      expect(balance?.balance).toBe('-1000.0000');
    });

    it('should handle floating point precision correctly', async () => {
      const creditService = new CreditService(serverDB, userId);
      await creditService.deductCredits(0.1234, 'Precision test');

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });

      // Balance should be 100 - 0.1234 = 99.8766
      expect(balance?.balance).toBe('99.8766');
    });

    it('should handle multiple sequential deductions correctly', async () => {
      const creditService = new CreditService(serverDB, userId);

      // First deduction
      await creditService.deductCredits(10, 'First deduction');
      let balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('90.0000');

      // Second deduction
      await creditService.deductCredits(20, 'Second deduction');
      balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('70.0000');

      // Verify both transactions exist
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(2);
      expect(transactions[0].amount).toBe('-10.0000');
      expect(transactions[1].amount).toBe('-20.0000');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      const creditService = new CreditService(serverDB, 'non-existent-user');
      const result = await creditService.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true for unlimited balance users regardless of amount', async () => {
      const creditService = new CreditService(serverDB, userId2);

      expect(await creditService.hasEnoughCredits(0)).toBe(true);
      expect(await creditService.hasEnoughCredits(10000)).toBe(true);
    });

    it('should return true when current balance is positive and estimatedAmount is 0', async () => {
      const creditService = new CreditService(serverDB, userId);
      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when current balance is 0 and estimatedAmount is 0', async () => {
      // Update balance to 0
      await serverDB
        .update(userBalances)
        .set({ balance: '0.0000' })
        .where(eq(userBalances.userId, userId));

      const creditService = new CreditService(serverDB, userId);
      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when current balance >= estimatedAmount', async () => {
      const creditService = new CreditService(serverDB, userId);

      expect(await creditService.hasEnoughCredits(50)).toBe(true);
      expect(await creditService.hasEnoughCredits(100)).toBe(true);
    });

    it('should return false when current balance < estimatedAmount', async () => {
      const creditService = new CreditService(serverDB, userId);

      expect(await creditService.hasEnoughCredits(101)).toBe(false);
      expect(await creditService.hasEnoughCredits(150)).toBe(false);
    });

    it('should handle floating point comparisons correctly', async () => {
      // Set balance to 10.5
      await serverDB
        .update(userBalances)
        .set({ balance: '10.5000' })
        .where(eq(userBalances.userId, userId));

      const creditService = new CreditService(serverDB, userId);

      expect(await creditService.hasEnoughCredits(10.4999)).toBe(true);
      expect(await creditService.hasEnoughCredits(10.5)).toBe(true);
      expect(await creditService.hasEnoughCredits(10.5001)).toBe(false);
    });
  });
});
