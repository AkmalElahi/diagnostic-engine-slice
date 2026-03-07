import { CanonicalSerializer } from '../utils/CanonicalSerializer';
import {
  SerializationError,
  DeterminismError,
} from '../types';

describe('CanonicalSerializer', () => {
  describe('serialize', () => {
    it('should produce canonical JSON with no formatting whitespace', () => {
      const artifact = {
        artifact_id: '123-456',
        issue: 'TestIssue',
        flow_id: 'test_flow',
      };
      const fieldOrder = ['artifact_id', 'issue', 'flow_id'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      // No formatting whitespace (indentation, newlines, spaces around punctuation)
      expect(result.canonical_json).not.toContain('\n');
      expect(result.canonical_json).not.toContain('\t');
      expect(result.canonical_json).not.toContain(': '); // No space after colon
      expect(result.canonical_json).not.toContain(', '); // No space after comma
      expect(result.canonical_json).toBe(
        '{"artifact_id":"123-456","issue":"TestIssue","flow_id":"test_flow"}'
      );
    });

    it('should respect canonical field ordering, not alphabetical', () => {
      const artifact = {
        zebra: 'last',
        apple: 'first',
        middle: 'second',
      };
      // Intentionally non-alphabetical order
      const fieldOrder = ['middle', 'zebra', 'apple'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      expect(result.canonical_json).toBe(
        '{"middle":"second","zebra":"last","apple":"first"}'
      );
    });

    it('should produce identical output for identical input (determinism)', () => {
      const artifact = {
        artifact_id: '123',
        flow_id: 'test',
        issue: 'Furnace',
      };
      const fieldOrder = ['artifact_id', 'flow_id', 'issue'];

      const result1 = CanonicalSerializer.serialize(artifact, fieldOrder, false);
      const result2 = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      expect(result1.canonical_json).toBe(result2.canonical_json);
      expect(result1.sha256_hash).toBe(result2.sha256_hash);
    });

    it('should handle arrays without sorting', () => {
      const artifact = {
        artifact_id: '123',
        recommendations: ['Third', 'First', 'Second'],
      };
      const fieldOrder = ['artifact_id', 'recommendations'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      // Array order preserved exactly
      expect(result.canonical_json).toContain(
        '"recommendations":["Third","First","Second"]'
      );
    });

    it('should handle null values correctly', () => {
      const artifact = {
        artifact_id: '123',
        measurement: null,
        flow_id: 'test',
      };
      const fieldOrder = ['artifact_id', 'measurement', 'flow_id'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      expect(result.canonical_json).toContain('"measurement":null');
    });

    it('should handle numbers without trailing zeros', () => {
      const artifact = {
        artifact_id: '123',
        voltage: 12.5,
        current: 3,
      };
      const fieldOrder = ['artifact_id', 'voltage', 'current'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      // No superfluous formatting
      expect(result.canonical_json).toContain('"voltage":12.5');
      expect(result.canonical_json).toContain('"current":3');
      expect(result.canonical_json).not.toContain('12.50');
      expect(result.canonical_json).not.toContain('3.0');
    });

    it('should compute artifact_hash via two-pass algorithm', () => {
      const artifact = {
        artifact_id: '123',
        artifact_hash: '', // Will be computed
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'artifact_hash', 'issue'];

      const result = CanonicalSerializer.serialize(artifact, fieldOrder, true);

      // artifact_hash should be populated with SHA-256
      expect(result.canonical_json).toMatch(
        /"artifact_hash":"[a-f0-9]{64}"/
      );

      // Hash should be 64 hex characters
      expect(result.sha256_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw error for fields not in canonical order', () => {
      const artifact = {
        artifact_id: '123',
        unexpected_field: 'value',
      };
      const fieldOrder = ['artifact_id']; // Missing unexpected_field

      expect(() => {
        CanonicalSerializer.serialize(artifact, fieldOrder, false);
      }).toThrow(SerializationError);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => {
        CanonicalSerializer.serialize(null as any, ['field'], false);
      }).toThrow(SerializationError);

      expect(() => {
        CanonicalSerializer.serialize({}, [], false);
      }).toThrow(SerializationError);
    });
  });

  describe('validateDeterminism', () => {
    it('should validate identical JSON strings', () => {
      const json = '{"artifact_id":"123","issue":"Test"}';

      const result = CanonicalSerializer.validateDeterminism(json, json);

      expect(result.is_valid).toBe(true);
      expect(result.stored_hash).toBe(result.exported_hash);
      expect(result.error_message).toBeUndefined();
    });

    it('should fail for different JSON strings', () => {
      const json1 = '{"artifact_id":"123","issue":"Test"}';
      const json2 = '{"artifact_id":"456","issue":"Test"}';

      const result = CanonicalSerializer.validateDeterminism(json1, json2);

      expect(result.is_valid).toBe(false);
      expect(result.stored_hash).not.toBe(result.exported_hash);
      expect(result.error_message).toContain('Determinism violation');
    });

    it('should fail for whitespace differences (not canonical)', () => {
      const json1 = '{"artifact_id":"123"}';
      const json2 = '{ "artifact_id": "123" }'; // Added spaces

      const result = CanonicalSerializer.validateDeterminism(json1, json2);

      expect(result.is_valid).toBe(false);
    });
  });

  describe('verifyByteIdentical', () => {
    it('should pass for identical strings', () => {
      const json = '{"artifact_id":"123"}';

      expect(() => {
        CanonicalSerializer.verifyByteIdentical(json, json);
      }).not.toThrow();
    });

    it('should throw DeterminismError for different strings', () => {
      const json1 = '{"artifact_id":"123"}';
      const json2 = '{"artifact_id":"456"}';

      expect(() => {
        CanonicalSerializer.verifyByteIdentical(json1, json2);
      }).toThrow(DeterminismError);
    });

    it('should include hashes in error message', () => {
      const json1 = '{"artifact_id":"123"}';
      const json2 = '{"artifact_id":"456"}';

      try {
        CanonicalSerializer.verifyByteIdentical(json1, json2);
        fail('Should have thrown DeterminismError');
      } catch (error) {
        expect(error).toBeInstanceOf(DeterminismError);
        const deterError = error as DeterminismError;
        expect(deterError.stored_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(deterError.exported_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(deterError.stored_hash).not.toBe(deterError.exported_hash);
      }
    });
  });

  describe('exportWithVerification', () => {
    it('should export and verify byte-identical artifact', () => {
      const artifact = {
        artifact_id: '123',
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'issue'];

      // Serialize and store
      const stored = CanonicalSerializer.serialize(artifact, fieldOrder, false);

      // Export with verification
      const exported = CanonicalSerializer.exportWithVerification(
        stored.canonical_json,
        artifact,
        fieldOrder
      );

      expect(exported).toBe(stored.canonical_json);
    });

    it('should throw if artifact was modified between storage and export', () => {
      const originalArtifact = {
        artifact_id: '123',
        issue: 'Test',
      };
      const fieldOrder = ['artifact_id', 'issue'];

      // Serialize and store
      const stored = CanonicalSerializer.serialize(
        originalArtifact,
        fieldOrder,
        false
      );

      // Modify artifact
      const modifiedArtifact = {
        artifact_id: '123',
        issue: 'Modified', // Changed
      };

      // Export should fail
      expect(() => {
        CanonicalSerializer.exportWithVerification(
          stored.canonical_json,
          modifiedArtifact,
          fieldOrder
        );
      }).toThrow(DeterminismError);
    });
  });

  describe('Determinism proof scenarios', () => {
    it('should produce identical output across multiple serializations', () => {
      const artifact = {
        artifact_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        artifact_hash: '',
        vertical_id: 'RV',
        issue: 'Furnace not heating',
        flow_id: 'rv_furnace_no_heat',
        flow_version: '1.0',
        artifact_schema_version: '1.1',
        stop_reason: 'User completed diagnostic',
        last_confirmed_state: 'Thermostat shows flame icon',
        safety_notes: ['Turn off furnace before inspection'],
        stabilization_actions: ['Avoid further operation until evaluated by a technician.'],
        recommendations: ['Schedule a technician and share this artifact so they can triage the issue quickly.'],
        notes: 'Diagnostic completed successfully',
      };

      const fieldOrder = [
        'artifact_id',
        'artifact_hash',
        'vertical_id',
        'issue',
        'flow_id',
        'flow_version',
        'artifact_schema_version',
        'stop_reason',
        'last_confirmed_state',
        'safety_notes',
        'stabilization_actions',
        'recommendations',
        'notes',
      ];

      // Serialize 10 times
      const results = Array.from({ length: 10 }, () =>
        CanonicalSerializer.serialize(artifact, fieldOrder, true)
      );

      // All canonical JSON strings should be identical
      const firstJson = results[0].canonical_json;
      results.forEach((result) => {
        expect(result.canonical_json).toBe(firstJson);
      });

      // All hashes should be identical
      const firstHash = results[0].sha256_hash;
      results.forEach((result) => {
        expect(result.sha256_hash).toBe(firstHash);
      });
    });

    it('should prove storage-export determinism', () => {
      const artifact = {
        artifact_id: '123',
        artifact_hash: '',
        issue: 'Water heater leaking',
        flow_id: 'rv_water_heater_leak',
      };

      const fieldOrder = ['artifact_id', 'artifact_hash', 'issue', 'flow_id'];

      // Simulate storage
      const storageResult = CanonicalSerializer.serialize(
        artifact,
        fieldOrder,
        true
      );
      const storedJson = storageResult.canonical_json;
      const storedHash = storageResult.sha256_hash;

      // Simulate export (artifact is retrieved from storage)
      const exportedJson = CanonicalSerializer.exportWithVerification(
        storedJson,
        JSON.parse(storedJson),
        fieldOrder
      );

      // Verify byte-identical
      expect(exportedJson).toBe(storedJson);

      // Verify hashes match
      const validation = CanonicalSerializer.validateDeterminism(
        storedJson,
        exportedJson
      );
      expect(validation.is_valid).toBe(true);
      expect(validation.stored_hash).toBe(storedHash);
      expect(validation.stored_hash).toBe(storedHash);
    });
  });
});
