import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize text parts to JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'Hello' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize image parts to JSON string', () => {
      const parts = [{ type: 'image' as const, image: 'data:image/png;base64,abc123' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed text and image parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Describe this image:' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
      expect(JSON.parse(result)).toHaveLength(2);
    });

    it('should serialize an empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should preserve all fields including optional thoughtSignature', () => {
      const parts = [
        { type: 'text' as const, text: 'Hello', thoughtSignature: 'sig123' },
      ];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].thoughtSignature).toBe('sig123');
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize a valid JSON array of text parts', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize a valid JSON array of image parts', () => {
      const parts = [{ type: 'image', image: 'data:image/png;base64,abc' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed text and image parts', () => {
      const parts = [
        { type: 'text', text: 'Look at this:' },
        { type: 'image', image: 'data:image/jpeg;base64,xyz' },
      ];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
      expect(result).toHaveLength(2);
    });

    it('should return null for plain text (non-JSON)', () => {
      const result = deserializeParts('Hello, world!');
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = deserializeParts('');
      expect(result).toBeNull();
    });

    it('should return null for a JSON object (not an array)', () => {
      const result = deserializeParts('{"type": "text", "text": "hello"}');
      expect(result).toBeNull();
    });

    it('should return null for an empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for a JSON array without type property', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'no type here' }]));
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeParts('{invalid json}');
      expect(result).toBeNull();
    });

    it('should return null for a JSON array of primitives', () => {
      const result = deserializeParts('[1, 2, 3]');
      expect(result).toBeNull();
    });

    it('should return null for a JSON null value', () => {
      const result = deserializeParts('null');
      expect(result).toBeNull();
    });

    it('should round-trip correctly with serializePartsForStorage', () => {
      const parts = [
        { type: 'text' as const, text: 'First part' },
        { type: 'image' as const, image: 'data:image/png;base64,abc' },
      ];
      const serialized = serializePartsForStorage(parts);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(parts);
    });

    it('should handle parts with special characters in text', () => {
      const parts = [{ type: 'text', text: 'Hello "world" & <more>' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });
  });
});
