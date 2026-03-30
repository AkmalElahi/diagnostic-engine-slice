import * as Crypto from 'expo-crypto';

import {
  CanonicalSerializationResult,
  DeterminismValidationResult,
  SerializationError,
  DeterminismError,
} from '../types';

export class CanonicalSerializer {
  static async serialize(
    artifact: Record<string, any>,
    fieldOrder: string[],
    computeArtifactHash: boolean = true
  ): Promise<CanonicalSerializationResult> {
    if (!artifact || typeof artifact !== 'object') {
      throw new SerializationError('Artifact must be a non-null object');
    }

    if (!Array.isArray(fieldOrder) || fieldOrder.length === 0) {
      throw new SerializationError('Field order must be a non-empty array');
    }

    let finalArtifact = artifact;
    if (computeArtifactHash && 'artifact_hash' in artifact) {
      const artifactWithEmptyHash = { ...artifact, artifact_hash: '' };
      const pass1Json = this.serializeWithOrder(artifactWithEmptyHash, fieldOrder);
      const pass1Hash = await this.computeSHA256(pass1Json);

      finalArtifact = { ...artifact, artifact_hash: pass1Hash };
    }

    const canonicalJson = this.serializeWithOrder(finalArtifact, fieldOrder);
    const sha256Hash = await this.computeSHA256(canonicalJson);

    return {
      canonical_json: canonicalJson,
      sha256_hash: sha256Hash,
    };
  }

  private static serializeWithOrder(
    obj: Record<string, any>,
    fieldOrder: string[]
  ): string {
    const orderedObj: Record<string, any> = {};

    for (const key of fieldOrder) {
      if (key in obj) {
        orderedObj[key] = obj[key];
      }
    }

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

  private static async computeSHA256(input: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input
    );

    return hash;
  }

  static async validateDeterminism(
    storedJson: string,
    exportedJson: string
  ): Promise<DeterminismValidationResult> {
    const storedHash = await this.computeSHA256(storedJson);
    const exportedHash = await this.computeSHA256(exportedJson);

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

  static async verifyByteIdentical(json1: string, json2: string): Promise<void> {
    if (json1 !== json2) {
      const hash1 = await this.computeSHA256(json1);
      const hash2 = await this.computeSHA256(json2);

      throw new DeterminismError(
        'Stored and exported JSON are not byte-identical',
        hash1,
        hash2
      );
    }
  }

  static async exportWithVerification(
    storedJson: string,
    artifact: Record<string, any>,
    fieldOrder: string[]
  ): Promise<string> {
    // Serialize artifact for export (no hash recomputation needed)
    const exportedJson = this.serializeWithOrder(artifact, fieldOrder);

    await this.verifyByteIdentical(storedJson, exportedJson);

    return exportedJson;
  }
}
