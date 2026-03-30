import { EnumValidationError, EnumValidationResult } from '../types';
import artifactEnums from './artifact_enums_v1_1.json';

export class EnumValidator {
  private static enumDefinitions: Record<string, string[]> = artifactEnums.fields;

  static validate(field: string, value: string): EnumValidationResult {
    if (this.isUnknown(value)) {
      return {
        is_valid: true,
        normalized_value: 'Unknown',
      };
    }

    const allowedValues = this.enumDefinitions[field];

    if (!allowedValues) {
      return {
        is_valid: true,
        normalized_value: value, // Pass through as-is
      };
    }

    const normalizedValue = this.normalize(value, allowedValues);

    if (normalizedValue) {
      return {
        is_valid: true,
        normalized_value: normalizedValue,
      };
    }

    return {
      is_valid: false,
      error_message: `Invalid enum value "${value}" for field "${field}". Allowed values: ${allowedValues.join(', ')}, Unknown`,
    };
  }
  static validateOrThrow(field: string, value: string): string {
    const result = this.validate(field, value);

    if (!result.is_valid) {
      const allowedValues = this.enumDefinitions[field] || [];
      throw new EnumValidationError(
        result.error_message || 'Enum validation failed',
        field,
        value,
        [...allowedValues, 'Unknown']
      );
    }

    return result.normalized_value!;
  }

  private static isUnknown(value: string): boolean {
    return value.trim().toLowerCase() === 'unknown';
  }

  private static normalize(value: string, allowedValues: string[]): string | null {
    const trimmed = value.trim();

    if (allowedValues.includes(trimmed)) {
      return trimmed;
    }

    const lowerValue = trimmed.toLowerCase();
    for (const allowed of allowedValues) {
      if (allowed.toLowerCase() === lowerValue) {
        return allowed; // Return canonical form
      }
    }

    return null;
  }

  static getAllowedValues(field: string): string[] | null {
    const values = this.enumDefinitions[field];
    return values ? [...values, 'Unknown'] : null;
  }

  static isEnumField(field: string): boolean {
    return field in this.enumDefinitions;
  }
  static validateArtifact(artifact: Record<string, any>): EnumValidationError[] {
    const errors: EnumValidationError[] = [];

    for (const [field, value] of Object.entries(artifact)) {
      // Only validate string values that are enum fields
      if (typeof value === 'string' && this.isEnumField(field)) {
        const result = this.validate(field, value);
        if (!result.is_valid) {
          const allowedValues = this.enumDefinitions[field];
          errors.push(
            new EnumValidationError(
              result.error_message || 'Invalid enum value',
              field,
              value,
              [...allowedValues, 'Unknown']
            )
          );
        }
      }
    }

    return errors;
  }

  static normalizeArtifact(artifact: Record<string, any>): Record<string, any> {
    for (const [field, value] of Object.entries(artifact)) {
      if (typeof value === 'string' && this.isEnumField(field)) {
        const result = this.validate(field, value);
        if (result.is_valid && result.normalized_value) {
          artifact[field] = result.normalized_value;
        }
      }
    }

    return artifact;
  }

  static getVersion(): string {
    return artifactEnums.artifact_enums_version;
  }
}
