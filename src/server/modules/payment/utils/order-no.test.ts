// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('format validation', () => {
    it('should generate order number with correct format', () => {
      const orderNo = generateOrderNo();

      // Should start with 'PC'
      expect(orderNo).toMatch(/^PC/);

      // Total length should be PC (2) + timestamp (14) + random (6) = 22
      expect(orderNo).toHaveLength(22);

      // Should match full pattern: PC + YYYYMMDDHHMMSS + 6-digit number
      expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
    });

    it('should generate order number with correct prefix', () => {
      const orderNo = generateOrderNo();

      expect(orderNo.startsWith('PC')).toBe(true);
    });

    it('should generate order number with 14-digit timestamp', () => {
      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      expect(timestamp).toHaveLength(14);
      expect(timestamp).toMatch(/^\d{14}$/);
    });

    it('should generate order number with 6-digit random number', () => {
      const orderNo = generateOrderNo();
      const random = orderNo.slice(16);

      expect(random).toHaveLength(6);
      expect(random).toMatch(/^\d{6}$/);
    });
  });

  describe('timestamp generation', () => {
    it('should generate timestamp based on current date', () => {
      const mockDate = new Date('2026-02-14T09:30:45');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260214093045
      expect(timestamp).toBe('20260214093045');

      vi.useRealTimers();
    });

    it('should pad single-digit months with zero', () => {
      const mockDate = new Date('2026-01-15T10:20:30');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260115102030
      expect(timestamp.slice(4, 6)).toBe('01');

      vi.useRealTimers();
    });

    it('should pad single-digit days with zero', () => {
      const mockDate = new Date('2026-03-05T11:22:33');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260305112233
      expect(timestamp.slice(6, 8)).toBe('05');

      vi.useRealTimers();
    });

    it('should pad single-digit hours with zero', () => {
      const mockDate = new Date('2026-04-10T07:30:45');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260410073045
      expect(timestamp.slice(8, 10)).toBe('07');

      vi.useRealTimers();
    });

    it('should pad single-digit minutes with zero', () => {
      const mockDate = new Date('2026-05-20T14:05:30');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260520140530
      expect(timestamp.slice(10, 12)).toBe('05');

      vi.useRealTimers();
    });

    it('should pad single-digit seconds with zero', () => {
      const mockDate = new Date('2026-06-25T15:25:08');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260625152508
      expect(timestamp.slice(12, 14)).toBe('08');

      vi.useRealTimers();
    });

    it('should handle year boundary correctly', () => {
      const mockDate = new Date('2025-12-31T23:59:59');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20251231235959
      expect(timestamp).toBe('20251231235959');

      vi.useRealTimers();
    });

    it('should handle midnight correctly', () => {
      const mockDate = new Date('2026-01-01T00:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20260101000000
      expect(timestamp).toBe('20260101000000');

      vi.useRealTimers();
    });
  });

  describe('random number generation', () => {
    it('should generate 6-digit random number within valid range', () => {
      const orderNo = generateOrderNo();
      const random = Number.parseInt(orderNo.slice(16), 10);

      // Should be between 100000 and 999999 (inclusive)
      expect(random).toBeGreaterThanOrEqual(100_000);
      expect(random).toBeLessThanOrEqual(999_999);
    });

    it('should generate different random numbers on multiple calls', () => {
      const orderNos = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        orderNos.add(generateOrderNo());
      }

      // With high probability, all should be unique
      // (Allow for small chance of collision, but should be rare)
      expect(orderNos.size).toBeGreaterThan(iterations * 0.95);
    });

    it('should not generate random numbers below 100000', () => {
      // Mock Math.random to return 0 (minimum)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const orderNo = generateOrderNo();
      const random = Number.parseInt(orderNo.slice(16), 10);

      expect(random).toBe(100_000);
    });

    it('should not generate random numbers above 999999', () => {
      // Mock Math.random to return value close to 1 (maximum)
      vi.spyOn(Math, 'random').mockReturnValue(0.999_999);

      const orderNo = generateOrderNo();
      const random = Number.parseInt(orderNo.slice(16), 10);

      expect(random).toBeLessThanOrEqual(999_999);
    });
  });

  describe('uniqueness', () => {
    it('should generate unique order numbers when called rapidly', () => {
      const orderNos = new Set<string>();

      // Generate multiple order numbers in quick succession
      for (let i = 0; i < 50; i++) {
        orderNos.add(generateOrderNo());
      }

      // All should be unique (random component ensures this)
      expect(orderNos.size).toBeGreaterThan(45);
    });

    it('should generate different order numbers at the same timestamp', () => {
      const mockDate = new Date('2026-02-14T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();

      // Same timestamp but different random numbers
      expect(orderNo1.slice(2, 16)).toBe(orderNo2.slice(2, 16));
      expect(orderNo1).not.toBe(orderNo2);

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates correctly', () => {
      const mockDate = new Date('2024-02-29T12:30:45');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20240229123045
      expect(timestamp).toBe('20240229123045');

      vi.useRealTimers();
    });

    it('should handle end of month dates correctly', () => {
      const mockDate = new Date('2026-11-30T23:59:59');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const orderNo = generateOrderNo();
      const timestamp = orderNo.slice(2, 16);

      // Expected timestamp: 20261130235959
      expect(timestamp).toBe('20261130235959');

      vi.useRealTimers();
    });
  });

  describe('real-world usage', () => {
    it('should generate valid order number in production scenario', () => {
      const orderNo = generateOrderNo();

      // Verify it matches the documented format
      // Format: PC + YYYYMMDDHHMMSS + 6-digit random number
      // Example: PC202601270930451234567
      expect(orderNo).toMatch(/^PC\d{20}$/);
    });

    it('should generate order numbers that can be stored as strings', () => {
      const orderNo = generateOrderNo();

      expect(typeof orderNo).toBe('string');
      expect(orderNo.length).toBe(22);
    });

    it('should generate order numbers without special characters', () => {
      const orderNo = generateOrderNo();

      // Should only contain letters (PC) and digits
      expect(orderNo).toMatch(/^[A-Z0-9]+$/);
    });
  });
});
