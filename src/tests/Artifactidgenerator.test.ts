import { ArtifactIdGenerator } from '../utils/ArtifactIdGenerator';

describe('ArtifactIdGenerator', () => {
  describe('generate', () => {
    it('should generate unique IDs', () => {
      const id1 = ArtifactIdGenerator.generate();
      const id2 = ArtifactIdGenerator.generate();
      const id3 = ArtifactIdGenerator.generate();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs in correct format', () => {
      const id = ArtifactIdGenerator.generate();
      const parts = id.split('-');

      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);  // 8 hex chars
      expect(parts[1]).toHaveLength(4);  // 4 hex chars
      expect(parts[2]).toHaveLength(4);  // 4 hex chars (version 4)
      expect(parts[3]).toHaveLength(4);  // 4 hex chars
      expect(parts[4]).toHaveLength(12); // 12 hex chars
    });
  });

  describe('isValid', () => {
    it('should validate correct UUID v4', () => {
      const validId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      expect(ArtifactIdGenerator.isValid(validId)).toBe(true);
    });

    it('should accept uppercase UUID', () => {
      const validId = 'F47AC10B-58CC-4372-A567-0E02B2C3D479';
      
      expect(ArtifactIdGenerator.isValid(validId)).toBe(true);
    });

    it('should accept mixed case UUID', () => {
      const validId = 'F47ac10b-58CC-4372-a567-0E02b2c3d479';
      
      expect(ArtifactIdGenerator.isValid(validId)).toBe(true);
    });

    it('should reject non-UUID strings', () => {
      expect(ArtifactIdGenerator.isValid('not-a-uuid')).toBe(false);
      expect(ArtifactIdGenerator.isValid('12345')).toBe(false);
      expect(ArtifactIdGenerator.isValid('')).toBe(false);
    });

    it('should reject UUID v1/v3/v5 (not v4)', () => {
      const uuidV1 = 'f47ac10b-58cc-1372-a567-0e02b2c3d479'; // version 1
      const uuidV3 = 'f47ac10b-58cc-3372-a567-0e02b2c3d479'; // version 3
      const uuidV5 = 'f47ac10b-58cc-5372-a567-0e02b2c3d479'; // version 5

      expect(ArtifactIdGenerator.isValid(uuidV1)).toBe(false);
      expect(ArtifactIdGenerator.isValid(uuidV3)).toBe(false);
      expect(ArtifactIdGenerator.isValid(uuidV5)).toBe(false);
    });

    it('should reject malformed UUIDs', () => {
      expect(ArtifactIdGenerator.isValid('f47ac10b-58cc-4372-a567')).toBe(false); // Too short
      expect(ArtifactIdGenerator.isValid('f47ac10b58cc4372a5670e02b2c3d479')).toBe(false); // No hyphens
      expect(ArtifactIdGenerator.isValid('f47ac10b-58cc-4372-z567-0e02b2c3d479')).toBe(false); // Invalid char
    });
  });

  describe('ensureValid', () => {
    it('should return existing valid ID', () => {
      const validId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      const result = ArtifactIdGenerator.ensureValid(validId);

      expect(result).toBe(validId);
    });

    it('should generate new ID if existing is invalid', () => {
      const invalidId = 'not-a-uuid';
      
      const result = ArtifactIdGenerator.ensureValid(invalidId);

      expect(result).not.toBe(invalidId);
      expect(ArtifactIdGenerator.isValid(result)).toBe(true);
    });

    it('should generate new ID if no existing ID provided', () => {
      const result = ArtifactIdGenerator.ensureValid();

      expect(ArtifactIdGenerator.isValid(result)).toBe(true);
    });

    it('should generate new ID if existing is empty string', () => {
      const result = ArtifactIdGenerator.ensureValid('');

      expect(ArtifactIdGenerator.isValid(result)).toBe(true);
      expect(result).not.toBe('');
    });

    it('should generate new ID if existing is undefined', () => {
      const result = ArtifactIdGenerator.ensureValid(undefined);

      expect(ArtifactIdGenerator.isValid(result)).toBe(true);
    });
  });
});