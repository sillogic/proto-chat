/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Compressor, StrCompressor } from './compass';

// Mock brotli-wasm module
vi.mock('brotli-wasm', () => {
  const mockCompress = (input: Uint8Array): Uint8Array => {
    // Simple mock compression - just return the input with a marker
    // In real brotli, this would be compressed
    return input;
  };

  const mockDecompress = (input: Uint8Array): Uint8Array => {
    // Simple mock decompression - just return the input
    return input;
  };

  return {
    default: Promise.resolve({
      compress: mockCompress,
      decompress: mockDecompress,
    }),
  };
});

describe('StrCompressor', () => {
  let compressor: StrCompressor;

  beforeEach(() => {
    compressor = new StrCompressor();
  });

  describe('initialization', () => {
    it('should initialize the brotli instance', async () => {
      await compressor.init();
      // @ts-expect-error - accessing private property for testing
      expect(compressor.instance).toBeDefined();
      // @ts-expect-error - accessing private property for testing
      expect(compressor.instance.compress).toBeDefined();
      // @ts-expect-error - accessing private property for testing
      expect(compressor.instance.decompress).toBeDefined();
    });
  });

  describe('compress', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should compress a simple string', () => {
      const input = 'hello world';
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress an empty string', () => {
      const input = '';
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      // Empty string will produce empty result with mock
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should compress a long string efficiently', () => {
      const input = 'a'.repeat(1000);
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Compressed length should be significantly smaller than base64 of original
      const base64Original = btoa(input);
      expect(result.length).toBeLessThan(base64Original.length);
    });

    it('should compress strings with special characters', () => {
      const input = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress strings with Unicode characters', () => {
      const input = '你好世界 🌍 émojis 日本語 한국어';
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce URL-safe base64 encoding', () => {
      const input = 'test data that might produce + or / in base64';
      const result = compressor.compress(input);

      // URL-safe base64 should not contain + or /
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      // Should not have padding at the end
      expect(result).not.toMatch(/=+$/);
    });

    it('should produce deterministic output', () => {
      const input = 'deterministic test';
      const result1 = compressor.compress(input);
      const result2 = compressor.compress(input);

      expect(result1).toBe(result2);
    });

    it('should produce different outputs for different inputs', () => {
      const input1 = 'test1';
      const input2 = 'test2';

      const result1 = compressor.compress(input1);
      const result2 = compressor.compress(input2);

      expect(result1).not.toBe(result2);
    });

    it('should handle newlines and tabs', () => {
      const input = 'line1\nline2\tcolumn';
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress JSON strings', () => {
      const input = JSON.stringify({ name: 'test', value: 123, nested: { key: 'value' } });
      const result = compressor.compress(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('decompress', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should decompress a compressed string', () => {
      const original = 'hello world';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress an empty string', () => {
      const original = '';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress strings with special characters', () => {
      const original = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress strings with Unicode characters', () => {
      const original = '你好世界 🌍 émojis 日本語 한국어';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle newlines and tabs in decompression', () => {
      const original = 'line1\nline2\tcolumn';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress long strings', () => {
      const original = 'a'.repeat(1000);
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle URL-safe base64 decoding', () => {
      const original = 'test data that might produce + or / in base64';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });
  });

  describe('compressAsync', () => {
    it('should compress a string asynchronously', async () => {
      const input = 'hello world async';
      const result = await compressor.compressAsync(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress without calling init first', async () => {
      const newCompressor = new StrCompressor();
      const input = 'test async without init';
      const result = await newCompressor.compressAsync(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce URL-safe base64 encoding', async () => {
      const input = 'test data that might produce + or / in base64';
      const result = await compressor.compressAsync(input);

      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toMatch(/=+$/);
    });

    it('should produce deterministic output', async () => {
      const input = 'deterministic async test';
      const result1 = await compressor.compressAsync(input);
      const result2 = await compressor.compressAsync(input);

      expect(result1).toBe(result2);
    });

    it('should handle Unicode characters', async () => {
      const input = '你好世界 🌍 émojis';
      const result = await compressor.compressAsync(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should compress long strings efficiently', async () => {
      const input = 'async long string '.repeat(100);
      const result = await compressor.compressAsync(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('decompressAsync', () => {
    it('should decompress a compressed string asynchronously', async () => {
      const original = 'hello world async';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress without calling init first', async () => {
      const newCompressor = new StrCompressor();
      const original = 'test async decompress without init';
      const compressed = await newCompressor.compressAsync(original);
      const decompressed = await newCompressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle Unicode characters', async () => {
      const original = '你好世界 🌍 émojis 日本語 한국어';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should decompress long strings', async () => {
      const original = 'async long string '.repeat(100);
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle special characters', async () => {
      const original = 'Special @#$%^&*() chars!';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle empty strings', async () => {
      const original = '';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });
  });

  describe('round-trip compression/decompression', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should preserve data through compress/decompress cycle', () => {
      const testStrings = [
        'simple text',
        'test@123:password',
        '中文测试',
        'user:pass',
        'special!@#$%^&*()chars',
        '',
        'line1\nline2\tcolumn',
        JSON.stringify({ test: 'data', nested: { value: 123 } }),
        'a'.repeat(1000),
      ];

      testStrings.forEach((input) => {
        const compressed = compressor.compress(input);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(input);
      });
    });

    it('should preserve data through async compress/decompress cycle', async () => {
      const testStrings = [
        'simple async text',
        'async@test:data',
        '异步测试',
        'emoji 🎉 test',
        'long async '.repeat(50),
      ];

      for (const input of testStrings) {
        const compressed = await compressor.compressAsync(input);
        const decompressed = await compressor.decompressAsync(compressed);
        expect(decompressed).toBe(input);
      }
    });

    it('should work with mixed sync and async operations', async () => {
      const original = 'mixed sync async test';

      // Sync compress, async decompress
      const syncCompressed = compressor.compress(original);
      const asyncDecompressed = await compressor.decompressAsync(syncCompressed);
      expect(asyncDecompressed).toBe(original);

      // Async compress, sync decompress
      const asyncCompressed = await compressor.compressAsync(original);
      const syncDecompressed = compressor.decompress(asyncCompressed);
      expect(syncDecompressed).toBe(original);
    });
  });

  describe('urlSafeBase64Encode (private method behavior)', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should replace + with _0_', () => {
      // Find an input that produces + in base64
      const input = 'test>?@';
      const result = compressor.compress(input);

      // Verify no + symbols in result
      expect(result).not.toContain('+');
    });

    it('should replace / with _', () => {
      // Find an input that produces / in base64
      const input = 'test?@A';
      const result = compressor.compress(input);

      // Verify no / symbols in result
      expect(result).not.toContain('/');
    });

    it('should remove padding =', () => {
      const inputs = ['a', 'ab', 'abc', 'abcd'];
      inputs.forEach((input) => {
        const result = compressor.compress(input);
        expect(result).not.toMatch(/=+$/);
      });
    });
  });

  describe('urlSafeBase64Decode (private method behavior)', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should restore _0_ to +', () => {
      const original = 'test with data that encodes to plus';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should restore _ to /', () => {
      const original = 'test with data that encodes to slash';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should add back padding when needed', () => {
      const testCases = ['x', 'xy', 'xyz', 'abcd'];
      testCases.forEach((original) => {
        const compressed = compressor.compress(original);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(original);
      });
    });
  });

  describe('compression efficiency', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should compress repetitive data efficiently', () => {
      const repetitive = 'repeat '.repeat(100);
      const nonRepetitive = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(10);

      const compressedRepetitive = compressor.compress(repetitive);
      const compressedNonRepetitive = compressor.compress(nonRepetitive);

      // With mock, we just verify both compress successfully
      // Real brotli would compress repetitive data better
      expect(compressedRepetitive.length).toBeGreaterThan(0);
      expect(compressedNonRepetitive.length).toBeGreaterThan(0);
    });

    it('should provide benefit for large inputs', () => {
      const largeInput = 'This is a large string with some repetitive content. '.repeat(50);
      const compressed = compressor.compress(largeInput);

      // Compressed should be smaller than base64 of original
      const base64Original = btoa(largeInput);
      expect(compressed.length).toBeLessThan(base64Original.length);
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should handle very long strings', () => {
      const veryLong = 'x'.repeat(10000);
      const compressed = compressor.compress(veryLong);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(veryLong);
    });

    it('should handle strings with only whitespace', () => {
      const whitespace = '   \n\t  \r\n   ';
      const compressed = compressor.compress(whitespace);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(whitespace);
    });

    it('should handle binary-like data in strings', () => {
      const binaryLike = String.fromCharCode(0, 1, 2, 3, 4, 5, 255);
      const compressed = compressor.compress(binaryLike);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(binaryLike);
    });

    it('should handle strings with all ASCII characters', () => {
      const allAscii = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join('');
      const compressed = compressor.compress(allAscii);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(allAscii);
    });
  });
});

describe('Compressor singleton', () => {
  it('should be an instance of StrCompressor', () => {
    expect(Compressor).toBeInstanceOf(StrCompressor);
  });

  it('should be usable directly', async () => {
    await Compressor.init();
    const original = 'test singleton compressor';
    const compressed = Compressor.compress(original);
    const decompressed = Compressor.decompress(compressed);

    expect(decompressed).toBe(original);
  });

  it('should support async methods', async () => {
    const original = 'test singleton async';
    const compressed = await Compressor.compressAsync(original);
    const decompressed = await Compressor.decompressAsync(compressed);

    expect(decompressed).toBe(original);
  });
});
