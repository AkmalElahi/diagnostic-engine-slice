import { CanonicalSerializer } from '../utils/CanonicalSerializer';
import {
  SerializationError,
  DeterminismError,
} from '../types';

describe('CanonicalSerializer', () => {
  describe('serialize', () => {
    it('should produce canonical JSON with no formatting whitespace', async () => {
      const artifact = {
        artifact_id: '123-456',
        issue: 'TestIssue',
        flow_id: 'test_flow',
      };
      const fieldOrder = ['artifact_id', 'issue', 'flow_id'];

      const result = await CanonicalSerializer.serialize(artifact, fieldOrder, false);

      // No formatting whitespace (indentation, newlines, spaces around punctuation)
      expect(result.canonical_json).not.toContain('\n');
      expect(result.canonical_json).not.toContain('\t');
      expect(result.canonical_json).not.toContain(': '); // No space after colon
      expect(result.canonical_json).not.toContain(', '); // No space after comma
      expect(result.canonical_json).toBe(
        '{"artifact_id":"123-456","issue":"TestIssue","flow_id":"test_flow"}'
      );
    });

    it('should respect canonical field ordering, not alphabetical', async () => {
      const artifact = {
        zebra: 'last',
        apple: 'first',
        middle: 'second',
      };
      // Intentionally non-alphabetical order
      const fieldOrder = ['middle', 'zebra', 'apple'];

      const result = await CanonicalSerializer.serialize(artifact, fieldOrder, false);

      expect(result.canonical_json).toBe(
        '{"middle":"second","zebra":"last","apple":"first"}'
      );
    });

    it('should produce identical output for identical input (determinism)', async () => {
      const artifact = {
        artifact_id: '123',
        flow_id: 'test',
        issue: 'Furnace',
      };
      const fieldOrder = ['artifact_id', 'flow_id', 'issue'];

      const result1 = await CanonicalSerializer.serialize(artifact, fieldOrder, false);
      const result2 = await CanonicalSerializer.serialize(artifact, fieldOrder, false);

      expect(result1.canonical_json).toBe(result2.canonical_json);
      expect(result1.sha256_hash).toBe(result2.sha256_hash);
    });

    it('should compute artifact_hash via two-pass algorithm', async () => {
      const artifact = {
        artifact_id: '123',
        artifact_hash: '', // Will be computed
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'artifact_hash', 'issue'];

      const result = await CanonicalSerializer.serialize(artifact, fieldOrder, true);

      // artifact_hash should be populated with SHA-256
      expect(result.canonical_json).toMatch(
        /"artifact_hash":"[a-f0-9]{64}"/
      );

      // Hash should be 64 hex characters
      expect(result.sha256_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw error for fields not in canonical order', async () => {
      const artifact = {
        artifact_id: '123',
        unexpected_field: 'value',
      };
      const fieldOrder = ['artifact_id']; // Missing unexpected_field

      await expect(
        CanonicalSerializer.serialize(artifact, fieldOrder, false)
      ).rejects.toThrow(SerializationError);
    });

    it('should throw error for invalid inputs', async () => {
      await expect(
        CanonicalSerializer.serialize(null as any, ['field'], false)
      ).rejects.toThrow(SerializationError);

      await expect(
        CanonicalSerializer.serialize({}, [], false)
      ).rejects.toThrow(SerializationError);
    });
  });

  describe('validateDeterminism', () => {
    it('should validate identical JSON strings', async () => {
      const json = '{"artifact_id":"123","issue":"Test"}';

      const result = await CanonicalSerializer.validateDeterminism(json, json);

      expect(result.is_valid).toBe(true);
      expect(result.stored_hash).toBe(result.exported_hash);
      expect(result.error_message).toBeUndefined();
    });

    it('should fail for different JSON strings', async () => {
      const json1 = '{"artifact_id":"123","issue":"Test"}';
      const json2 = '{"artifact_id":"456","issue":"Test"}';

      const result = await CanonicalSerializer.validateDeterminism(json1, json2);

      expect(result.is_valid).toBe(false);
      expect(result.stored_hash).not.toBe(result.exported_hash);
      expect(result.error_message).toContain('Determinism violation');
    });

    it('should fail for whitespace differences (not canonical)', async () => {
      const json1 = '{"artifact_id":"123"}';
      const json2 = '{ "artifact_id": "123" }'; // Added spaces

      const result = await CanonicalSerializer.validateDeterminism(json1, json2);

      expect(result.is_valid).toBe(false);
    });
  });

  describe('verifyByteIdentical', () => {
    it('should pass for identical strings', async () => {
      const json = '{"artifact_id":"123"}';

      await expect(
        CanonicalSerializer.verifyByteIdentical(json, json)
      ).resolves.not.toThrow();
    });

    it('should throw DeterminismError for different strings', async () => {
      const json1 = '{"artifact_id":"123"}';
      const json2 = '{"artifact_id":"456"}';

      await expect(
        CanonicalSerializer.verifyByteIdentical(json1, json2)
      ).rejects.toThrow(DeterminismError);
    });
  });

  describe('exportWithVerification', () => {
    it('should export matching artifact successfully', async () => {
      const artifact = {
        artifact_id: '123',
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'issue'];
      const storedJson = '{"artifact_id":"123","issue":"Test"}';

      const exported = await CanonicalSerializer.exportWithVerification(
        storedJson,
        artifact,
        fieldOrder
      );

      expect(exported).toBe(storedJson);
    });

    it('should throw DeterminismError for non-matching artifact', async () => {
      const artifact = {
        artifact_id: '456', // Different value
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'issue'];
      const storedJson = '{"artifact_id":"123","issue":"Test"}';

      await expect(
        CanonicalSerializer.exportWithVerification(storedJson, artifact, fieldOrder)
      ).rejects.toThrow(DeterminismError);
    });
  });
});