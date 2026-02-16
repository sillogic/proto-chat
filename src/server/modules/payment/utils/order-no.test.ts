// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate order number with correct format', () => {
    const orderNo = generateOrderNo();

    // Should start with "PC"
    expect(orderNo).toMatch(/^PC/);

    // Should have correct length: PC(2) + timestamp(14) + random(6) = 22
    expect(orderNo).toHaveLength(22);

    // Should match full pattern: PC + YYYYMMDDHHMMSS + 6-digit number
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should generate unique order numbers', () => {
    const orderNo1 = generateOrderNo();
    const orderNo2 = generateOrderNo();
    const orderNo3 = generateOrderNo();

    // All should be different (high probability due to random component)
    expect(orderNo1).not.toBe(orderNo2);
    expect(orderNo2).not.toBe(orderNo3);
    expect(orderNo1).not.toBe(orderNo3);
  });

  it('should generate order number with valid timestamp format', () => {
    const orderNo = generateOrderNo();

    // Extract timestamp part (skip "PC" prefix, take next 14 digits)
    const timestamp = orderNo.slice(2, 16);

    // Parse timestamp components
    const year = Number.parseInt(timestamp.slice(0, 4));
    const month = Number.parseInt(timestamp.slice(4, 6));
    const day = Number.parseInt(timestamp.slice(6, 8));
    const hours = Number.parseInt(timestamp.slice(8, 10));
    const minutes = Number.parseInt(timestamp.slice(10, 12));
    const seconds = Number.parseInt(timestamp.slice(12, 14));

    // Validate ranges
    expect(year).toBeGreaterThanOrEqual(2024);
    expect(year).toBeLessThanOrEqual(2100);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });

  it('should generate 6-digit random number within valid range', () => {
    const orderNo = generateOrderNo();

    // Extract random part (last 6 digits)
    const randomPart = orderNo.slice(16);
    const randomNumber = Number.parseInt(randomPart);

    // Should be 6 digits (100000 to 999999)
    expect(randomNumber).toBeGreaterThanOrEqual(100_000);
    expect(randomNumber).toBeLessThanOrEqual(999_999);
  });

  it('should generate order number with current date and time', () => {
    const now = new Date();
    const orderNo = generateOrderNo();

    // Extract timestamp parts from order number
    const timestamp = orderNo.slice(2, 16);
    const year = Number.parseInt(timestamp.slice(0, 4));
    const month = Number.parseInt(timestamp.slice(4, 6));
    const day = Number.parseInt(timestamp.slice(6, 8));

    // Should match current date
    expect(year).toBe(now.getFullYear());
    expect(month).toBe(now.getMonth() + 1);
    expect(day).toBe(now.getDate());
  });

  it('should pad single-digit month and day with zero', () => {
    // Mock date with single-digit month and day
    const mockDate = new Date('2024-01-05T08:05:03');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Extract timestamp
    const timestamp = orderNo.slice(2, 16);

    // Should be "20240105080503"
    expect(timestamp).toBe('20240105080503');

    vi.useRealTimers();
  });

  it('should pad single-digit hours, minutes, and seconds with zero', () => {
    // Mock date with single-digit time components
    const mockDate = new Date('2024-12-15T08:05:03');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Extract timestamp
    const timestamp = orderNo.slice(2, 16);

    // Should be "20241215080503"
    expect(timestamp).toBe('20241215080503');

    vi.useRealTimers();
  });

  it('should generate different order numbers in rapid succession', () => {
    // Generate 100 order numbers quickly
    const orderNumbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      orderNumbers.add(generateOrderNo());
    }

    // Should have 100 unique order numbers (random component ensures uniqueness)
    expect(orderNumbers.size).toBe(100);
  });

  it('should handle midnight edge case', () => {
    const mockDate = new Date('2024-06-30T00:00:00');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const timestamp = orderNo.slice(2, 16);

    expect(timestamp).toBe('20240630000000');

    vi.useRealTimers();
  });

  it('should handle noon edge case', () => {
    const mockDate = new Date('2024-06-15T12:00:00');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const timestamp = orderNo.slice(2, 16);

    expect(timestamp).toBe('20240615120000');

    vi.useRealTimers();
  });
});
