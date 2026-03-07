import crypto from 'crypto';
import {
  CanonicalSerializationResult,
  DeterminismValidationResult,
  SerializationError,
  DeterminismError,
} from '../types';

export class CanonicalSerializer {
  static serialize(
    artifact: Record<string, any>,
    fieldOrder: string[],
    computeArtifactHash: boolean = true
  ): CanonicalSerializationResult {
    // Validate inputs
    if (!artifact || typeof artifact !== 'object') {
      throw new SerializationError('Artifact must be a non-null object');
    }

    if (!Array.isArray(fieldOrder) || fieldOrder.length === 0) {
      throw new SerializationError('Field order must be a non-empty array');
    }

    let finalArtifact = artifact;

    // Two-pass serialization if artifact_hash computation is required
    if (computeArtifactHash && 'artifact_hash' in artifact) {
      // Pass 1: Serialize with empty artifact_hash
      const artifactWithEmptyHash = { ...artifact, artifact_hash: '' };
      const pass1Json = this.serializeWithOrder(artifactWithEmptyHash, fieldOrder);
      const pass1Hash = this.computeSHA256(pass1Json);

      // Pass 2: Insert computed hash and serialize final
      finalArtifact = { ...artifact, artifact_hash: pass1Hash };
    }

    // Final serialization
    const canonicalJson = this.serializeWithOrder(finalArtifact, fieldOrder);
    const sha256Hash = this.computeSHA256(canonicalJson);

    return {
      canonical_json: canonicalJson,
      sha256_hash: sha256Hash,
    };
  }

  private static serializeWithOrder(
    obj: Record<string, any>,
    fieldOrder: string[]
  ): string {
    // Build ordered object following canonical field order
    const orderedObj: Record<string, any> = {};

    for (const key of fieldOrder) {
      if (key in obj) {
        orderedObj[key] = obj[key];
      }
    }

    // Check for fields not in fieldOrder (should not happen in valid artifacts)
    const objKeys = Object.keys(obj);
    const missingKeys = objKeys.filter(k => !fieldOrder.includes(k));
    if (missingKeys.length > 0) {
      throw new SerializationError(
        `Fields not in canonical order: ${missingKeys.join(', ')}`
      );
    }
    const canonicalJson = JSON.stringify(orderedObj);

    return canonicalJson;
  }

  private static computeSHA256(input: string): string {
    // Create hash using UTF-8 encoding
    const hash = crypto
      .createHash('sha256')
      .update(input, 'utf8')
      .digest('hex');

    return hash;
  }

  static validateDeterminism(
    storedJson: string,
    exportedJson: string
  ): DeterminismValidationResult {
    const storedHash = this.computeSHA256(storedJson);
    const exportedHash = this.computeSHA256(exportedJson);

    const isValid = storedHash === exportedHash;

    if (!isValid) {
      return {
        is_valid: false,
        stored_hash: storedHash,
        exported_hash: exportedHash,
        error_message: `Determinism violation: stored hash ${storedHash} != exported hash ${exportedHash}`,
      };
    }

    return {
      is_valid: true,
      stored_hash: storedHash,
      exported_hash: exportedHash,
    };
  }

  static verifyByteIdentical(json1: string, json2: string): void {
    if (json1 !== json2) {
      const hash1 = this.computeSHA256(json1);
      const hash2 = this.computeSHA256(json2);

      throw new DeterminismError(
        'Stored and exported JSON are not byte-identical',
        hash1,
        hash2
      );
    }
  }

  static exportWithVerification(
    storedJson: string,
    artifact: Record<string, any>,
    fieldOrder: string[]
  ): string {
    // Serialize artifact for export (no hash recomputation needed)
    const exportedJson = this.serializeWithOrder(artifact, fieldOrder);

    this.verifyByteIdentical(storedJson, exportedJson);

    return exportedJson;
  }
}
