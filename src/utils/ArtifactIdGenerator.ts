import * as Crypto from 'expo-crypto';

export class ArtifactIdGenerator {
  static generate(): string {
    return Crypto.randomUUID();
  }

  static isValid(id: string): boolean {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(id);
  }

  static ensureValid(existingId?: string): string {
    if (existingId && this.isValid(existingId)) {
      return existingId;
    }
    return this.generate();
  }
}