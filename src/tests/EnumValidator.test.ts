import { EnumValidator } from '../utils/EnumValidators';
import { EnumValidationError } from '../types';

describe('EnumValidator', () => {
  describe('validate', () => {
    it('should validate exact match enum value', () => {
      const result = EnumValidator.validate('vertical_id', 'RV');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('RV');
    });

    it('should normalize lowercase to canonical form', () => {
      const result = EnumValidator.validate('vertical_id', 'rv');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('RV');
    });

    it('should normalize mixed case to canonical form', () => {
      const result = EnumValidator.validate('vertical_id', 'Rv');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('RV');

      const result2 = EnumValidator.validate('vertical_id', 'rV');
      expect(result2.is_valid).toBe(true);
      expect(result2.normalized_value).toBe('RV');
    });

    it('should trim whitespace before validation', () => {
      const result = EnumValidator.validate('vertical_id', '  RV  ');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('RV');
    });

    it('should always allow "Unknown" (exact case)', () => {
      const result = EnumValidator.validate('vertical_id', 'Unknown');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('Unknown');
    });

    it('should allow "Unknown" in any case', () => {
      const result1 = EnumValidator.validate('vertical_id', 'unknown');
      expect(result1.is_valid).toBe(true);
      expect(result1.normalized_value).toBe('Unknown');

      const result2 = EnumValidator.validate('vertical_id', 'UNKNOWN');
      expect(result2.is_valid).toBe(true);
      expect(result2.normalized_value).toBe('Unknown');

      const result3 = EnumValidator.validate('vertical_id', 'UnKnOwN');
      expect(result3.is_valid).toBe(true);
      expect(result3.normalized_value).toBe('Unknown');
    });

    it('should reject invalid enum value', () => {
      const result = EnumValidator.validate('vertical_id', 'INVALID');

      expect(result.is_valid).toBe(false);
      expect(result.error_message).toContain('Invalid enum value');
      expect(result.error_message).toContain('INVALID');
      expect(result.error_message).toContain('RV');
    });

    it('should pass through non-enum fields as-is', () => {
      const result = EnumValidator.validate('issue', 'Furnace not heating');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('Furnace not heating');
    });

    it('should handle empty string', () => {
      const result = EnumValidator.validate('vertical_id', '');

      expect(result.is_valid).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    it('should return normalized value on success', () => {
      const normalized = EnumValidator.validateOrThrow('vertical_id', 'rv');

      expect(normalized).toBe('RV');
    });

    it('should throw EnumValidationError on failure', () => {
      expect(() => {
        EnumValidator.validateOrThrow('vertical_id', 'INVALID');
      }).toThrow(EnumValidationError);
    });

    it('should include field, value, and allowed values in error', () => {
      try {
        EnumValidator.validateOrThrow('vertical_id', 'INVALID');
        fail('Should have thrown EnumValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(EnumValidationError);
        const enumError = error as EnumValidationError;
        expect(enumError.field).toBe('vertical_id');
        expect(enumError.value).toBe('INVALID');
        expect(enumError.allowed_values).toContain('RV');
        expect(enumError.allowed_values).toContain('Unknown');
      }
    });
  });

  describe('getAllowedValues', () => {
    it('should return allowed values including Unknown', () => {
      const values = EnumValidator.getAllowedValues('vertical_id');

      expect(values).toContain('RV');
      expect(values).toContain('Unknown');
      expect(values).toHaveLength(2);
    });

    it('should return null for non-enum fields', () => {
      const values = EnumValidator.getAllowedValues('issue');

      expect(values).toBeNull();
    });
  });

  describe('isEnumField', () => {
    it('should return true for enum fields', () => {
      expect(EnumValidator.isEnumField('vertical_id')).toBe(true);
    });

    it('should return false for non-enum fields', () => {
      expect(EnumValidator.isEnumField('issue')).toBe(false);
      expect(EnumValidator.isEnumField('notes')).toBe(false);
      expect(EnumValidator.isEnumField('random_field')).toBe(false);
    });
  });

  describe('validateArtifact', () => {
    it('should validate all enum fields in artifact', () => {
      const artifact = {
        artifact_id: '123',
        vertical_id: 'RV',
        issue: 'Furnace not heating',
        flow_id: 'rv_furnace',
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });

    it('should normalize enum values', () => {
      const artifact = {
        vertical_id: 'rv', // lowercase
        issue: 'Test',
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid enum values', () => {
      const artifact = {
        vertical_id: 'INVALID',
        issue: 'Test',
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('vertical_id');
      expect(errors[0].value).toBe('INVALID');
    });

    it('should ignore non-string values', () => {
      const artifact = {
        vertical_id: 'RV',
        some_number: 42,
        some_boolean: true,
        some_array: ['a', 'b'],
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });

    it('should handle artifacts with no enum fields', () => {
      const artifact = {
        issue: 'Test',
        notes: 'Some notes',
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });
  });

  describe('normalizeArtifact', () => {
    it('should normalize enum values in place', () => {
      const artifact = {
        vertical_id: 'rv', // Should become 'RV'
        issue: 'Furnace not heating',
      };

      const normalized = EnumValidator.normalizeArtifact(artifact);

      expect(normalized.vertical_id).toBe('RV');
      expect(normalized.issue).toBe('Furnace not heating'); // Unchanged
      expect(normalized).toBe(artifact); // Same object reference
    });

    it('should normalize Unknown to canonical form', () => {
      const artifact = {
        vertical_id: 'unknown', // Should become 'Unknown'
      };

      EnumValidator.normalizeArtifact(artifact);

      expect(artifact.vertical_id).toBe('Unknown');
    });

    it('should not modify non-enum fields', () => {
      const artifact = {
        vertical_id: 'RV',
        issue: 'Furnace not heating',
        notes: 'Some notes',
      };

      EnumValidator.normalizeArtifact(artifact);

      expect(artifact.issue).toBe('Furnace not heating');
      expect(artifact.notes).toBe('Some notes');
    });

    it('should handle artifacts with no enum fields', () => {
      const artifact = {
        issue: 'Test',
        notes: 'Notes',
      };

      const normalized = EnumValidator.normalizeArtifact(artifact);

      expect(normalized).toEqual(artifact);
    });
  });

  describe('getVersion', () => {
    it('should return artifact_enums version', () => {
      const version = EnumValidator.getVersion();

      expect(version).toBe('1.1');
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only Unknown', () => {
      const result = EnumValidator.validate('vertical_id', '  Unknown  ');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('Unknown');
    });

    it('should be case-sensitive for non-enum fields', () => {
      const result = EnumValidator.validate('issue', 'Furnace Not Heating');

      expect(result.is_valid).toBe(true);
      expect(result.normalized_value).toBe('Furnace Not Heating');
    });

    it('should handle artifact with undefined values', () => {
      const artifact = {
        vertical_id: 'RV',
        some_field: undefined,
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });

    it('should handle artifact with null values', () => {
      const artifact = {
        vertical_id: 'RV',
        some_field: null,
      };

      const errors = EnumValidator.validateArtifact(artifact);

      expect(errors).toHaveLength(0);
    });
  });
});