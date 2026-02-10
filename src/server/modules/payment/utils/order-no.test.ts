// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate order number with PC prefix', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC\d{20}$/);
  });

  it('should include timestamp in YYYYMMDDHHMMSS format', () => {
    const fixedDate = new Date('2026-01-15T14:30:45');
    vi.setSystemTime(fixedDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20260115143045');
  });

  it('should include 6-digit random number', () => {
    const orderNo = generateOrderNo();
    // Format: PC + 14 digits (timestamp) + 6 digits (random)
    expect(orderNo).toHaveLength(22);
    const randomPart = orderNo.slice(16);
    expect(randomPart).toMatch(/^\d{6}$/);
    expect(Number.parseInt(randomPart)).toBeGreaterThanOrEqual(100_000);
    expect(Number.parseInt(randomPart)).toBeLessThan(1_000_000);
  });

  it('should pad single-digit month and day with zero', () => {
    const fixedDate = new Date('2026-02-03T05:06:07');
    vi.setSystemTime(fixedDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20260203050607');
  });

  it('should generate unique order numbers', () => {
    const orderNos = new Set<string>();
    for (let i = 0; i < 100; i++) {
      orderNos.add(generateOrderNo());
    }
    // All generated order numbers should be unique
    expect(orderNos.size).toBe(100);
  });

  it('should handle year transitions correctly', () => {
    const fixedDate = new Date('2026-12-31T23:59:59');
    vi.setSystemTime(fixedDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20261231235959');
  });

  it('should handle midnight correctly', () => {
    const fixedDate = new Date('2026-01-01T00:00:00');
    vi.setSystemTime(fixedDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20260101000000');
  });
});
