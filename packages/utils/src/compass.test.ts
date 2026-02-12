/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock brotli-wasm to use the Node.js version which works synchronously
vi.mock('brotli-wasm', async () => {
  // Use dynamic import to get the actual Node.js implementation
  const path = await import('node:path');
  const brotliPath = path.resolve(
    __dirname,
    '../node_modules/brotli-wasm/pkg.node/brotli_wasm.js',
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const brotliNode = require(brotliPath);
  return {
    default: Promise.resolve(brotliNode),
  };
});

import { Compressor, StrCompressor } from './compass';

describe('StrCompressor', () => {
  let compressor: StrCompressor;

  beforeAll(async () => {
    compressor = new StrCompressor();
    await compressor.init();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newCompressor = new StrCompressor();
      await expect(newCompressor.init()).resolves.toBeUndefined();
    });
  });

  describe('synchronous compression and decompression', () => {
    it('should compress and decompress a simple string', () => {
      const original = 'Hello, World!';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(compressed).not.toBe(original);
      expect(decompressed).toBe(original);
    });

    it('should compress and decompress an empty string', () => {
      const original = '';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should compress and decompress a long string', () => {
      const original = 'Lorem ipsum dolor sit amet, '.repeat(100);
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(compressed.length).toBeLessThan(original.length);
      expect(decompressed).toBe(original);
    });

    it('should compress and decompress special characters', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`\n\t\r';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should compress and decompress unicode characters', () => {
      const original = '你好世界 🌍 مرحبا العالم Привет мир';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should compress and decompress JSON data', () => {
      const original = JSON.stringify({
        name: 'Test User',
        age: 30,
        email: 'test@example.com',
        nested: { data: [1, 2, 3], flag: true },
      });
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
      expect(JSON.parse(decompressed)).toEqual(JSON.parse(original));
    });

    it('should compress and decompress multiline text', () => {
      const original = `Line 1
Line 2
Line 3
Line 4`;
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle repeated patterns efficiently', () => {
      const original = 'aaaaaaaaaa'.repeat(50);
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(compressed.length).toBeLessThan(original.length / 2);
      expect(decompressed).toBe(original);
    });
  });

  describe('asynchronous compression and decompression', () => {
    it('should compress and decompress a simple string asynchronously', async () => {
      const original = 'Hello, Async World!';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(compressed).not.toBe(original);
      expect(decompressed).toBe(original);
    });

    it('should compress and decompress an empty string asynchronously', async () => {
      const original = '';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should compress and decompress a long string asynchronously', async () => {
      const original = 'Async test string. '.repeat(100);
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(compressed.length).toBeLessThan(original.length);
      expect(decompressed).toBe(original);
    });

    it('should compress and decompress unicode asynchronously', async () => {
      const original = '异步测试 🚀 Тест';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should work without prior init() call', async () => {
      const newCompressor = new StrCompressor();
      const original = 'Test without init';
      const compressed = await newCompressor.compressAsync(original);
      const decompressed = await newCompressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });
  });

  describe('URL-safe Base64 encoding', () => {
    it('should produce URL-safe output without + or / characters', () => {
      const testStrings = [
        'test+string',
        'another/test',
        'complex+data/with=padding',
        'a'.repeat(100),
      ];

      for (const str of testStrings) {
        const compressed = compressor.compress(str);
        expect(compressed).not.toContain('+');
        expect(compressed).not.toContain('/');
        expect(compressed).not.toContain('=');
      }
    });

    it('should handle strings that result in + and / in standard Base64', () => {
      // These strings are chosen to likely produce + or / in standard Base64
      const original = '\x00\x10\x83\x10Q\xc7';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(compressed).not.toContain('+');
      expect(compressed).not.toContain('/');
      expect(decompressed).toBe(original);
    });

    it('should correctly decode URL-safe encoded strings with _0_ and _', () => {
      const original = 'Test string for URL encoding';
      const compressed = compressor.compress(original);

      // Verify that if the string contains special markers, they decode correctly
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(original);
    });

    it('should handle padding correctly', () => {
      // Test strings of varying lengths to test different padding scenarios
      const testStrings = ['a', 'ab', 'abc', 'abcd', 'abcde'];

      for (const str of testStrings) {
        const compressed = compressor.compress(str);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(str);
      }
    });
  });

  describe('round-trip integrity', () => {
    it('should maintain data integrity for sync operations', () => {
      const testData = [
        '',
        'a',
        'Hello World',
        '1234567890',
        '!@#$%^&*()',
        'Multi\nLine\nText',
        '{"json": true, "value": 123}',
        'x'.repeat(1000),
        '你好 🌍 Hello مرحبا',
      ];

      for (const data of testData) {
        const compressed = compressor.compress(data);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(data);
      }
    });

    it('should maintain data integrity for async operations', async () => {
      const testData = [
        '',
        'a',
        'Async Hello World',
        '0987654321',
        'Special!@#',
        'Async\nMulti\nLine',
        '{"async": true}',
        'y'.repeat(500),
      ];

      for (const data of testData) {
        const compressed = await compressor.compressAsync(data);
        const decompressed = await compressor.decompressAsync(compressed);
        expect(decompressed).toBe(data);
      }
    });

    it('should produce consistent results between sync and async methods', async () => {
      const original = 'Consistency test string';

      const syncCompressed = compressor.compress(original);
      const asyncCompressed = await compressor.compressAsync(original);

      expect(syncCompressed).toBe(asyncCompressed);

      const syncDecompressed = compressor.decompress(syncCompressed);
      const asyncDecompressed = await compressor.decompressAsync(asyncCompressed);

      expect(syncDecompressed).toBe(asyncDecompressed);
      expect(syncDecompressed).toBe(original);
    });
  });

  describe('singleton Compressor instance', () => {
    it('should export a pre-initialized Compressor instance', async () => {
      expect(Compressor).toBeInstanceOf(StrCompressor);
    });

    it('should work with the singleton instance', async () => {
      // Initialize if not already
      await Compressor.init();

      const original = 'Testing singleton';
      const compressed = Compressor.compress(original);
      const decompressed = Compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should work asynchronously with the singleton instance', async () => {
      const original = 'Async singleton test';
      const compressed = await Compressor.compressAsync(original);
      const decompressed = await Compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });
  });

  describe('compression efficiency', () => {
    it('should achieve compression for repetitive text', () => {
      const original = 'repeat '.repeat(100);
      const compressed = compressor.compress(original);

      expect(compressed.length).toBeLessThan(original.length / 2);
    });

    it('should handle highly compressible JSON data', () => {
      const original = JSON.stringify({
        users: Array.from({ length: 50 }).fill({
          name: 'John Doe',
          email: 'john@example.com',
          active: true,
        }),
      });
      const compressed = compressor.compress(original);

      expect(compressed.length).toBeLessThan(original.length / 3);
    });

    it('may not compress random data significantly', () => {
      // Random data is typically not very compressible
      const randomChars = Array.from({ length: 100 })
        .map(() => String.fromCharCode(Math.floor(Math.random() * 94) + 33))
        .join('');
      const compressed = compressor.compress(randomChars);

      // Compressed size might be close to or even larger than original for truly random data
      // This test just ensures it works
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(randomChars);
    });
  });
});
