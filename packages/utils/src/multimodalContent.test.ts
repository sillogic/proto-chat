import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize text parts to JSON string', () => {
      const parts = [{ type: 'text', text: 'Hello world' }];
      const result = serializePartsForStorage(parts as any);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize image parts to JSON string', () => {
      const parts = [
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image.png' },
        },
      ];
      const result = serializePartsForStorage(parts as any);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed content parts', () => {
      const parts = [
        { type: 'text', text: 'Describe this image:' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc123' },
        },
      ];
      const result = serializePartsForStorage(parts as any);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should produce valid JSON', () => {
      const parts = [{ type: 'text', text: 'test' }];
      const result = serializePartsForStorage(parts as any);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize valid text parts JSON string', () => {
      const parts = [{ type: 'text', text: 'Hello world' }];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize valid image parts JSON string', () => {
      const parts = [
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image.png' },
        },
      ];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed content parts', () => {
      const parts = [
        { type: 'text', text: 'Describe this:' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
      ];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text (not JSON)', () => {
      const result = deserializeParts('Hello world');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeParts('{invalid json}');
      expect(result).toBeNull();
    });

    it('should return null for JSON object (not array)', () => {
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hello' }));
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for array without type property', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'no type' }]));
      expect(result).toBeNull();
    });

    it('should return null for JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for JSON null', () => {
      const result = deserializeParts('null');
      expect(result).toBeNull();
    });

    it('should return null for JSON string', () => {
      const result = deserializeParts('"hello"');
      expect(result).toBeNull();
    });

    it('should handle round-trip serialization and deserialization', () => {
      const originalParts = [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,/9j/test' },
        },
      ];

      const serialized = serializePartsForStorage(originalParts as any);
      const deserialized = deserializeParts(serialized);

      expect(deserialized).toEqual(originalParts);
    });

    it('should handle parts with null type value', () => {
      const result = deserializeParts(JSON.stringify([{ type: null }]));
      // null is falsy, so parsed[0]?.type is null which is falsy
      expect(result).toBeNull();
    });
  });
});
