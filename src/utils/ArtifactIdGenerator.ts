import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

export class ArtifactIdGenerator {
  static generate(): string {
    return uuidv4();
  }

  static isValid(id: string): boolean {
    if (!uuidValidate(id)) {
      return false;
    }
    return uuidVersion(id) === 4;
  }

  static ensureValid(existingId?: string): string {
    if (existingId && this.isValid(existingId)) {
      return existingId;
    }
    return this.generate();
  }
}