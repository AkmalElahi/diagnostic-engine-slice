import * as Crypto from 'expo-crypto';

export class ChecksumVerificationError extends Error {
  public readonly flow_id: string;
  public readonly flow_version: string;
  public readonly expected_hash: string;
  public readonly computed_hash: string;

  constructor(
    message: string,
    flow_id: string,
    flow_version: string,
    expected_hash: string,
    computed_hash: string
  ) {
    super(message);
    this.name = 'ChecksumVerificationError';
    this.flow_id = flow_id;
    this.flow_version = flow_version;
    this.expected_hash = expected_hash;
    this.computed_hash = computed_hash;
  }
}

export interface ChecksumVerificationResult {
  is_valid: boolean;
  flow_id: string;
  flow_version: string;
  expected_hash: string;
  computed_hash: string;
  error_message?: string;
}

export class FlowChecksumValidator {
  static async computeFlowHash(flowJsonString: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      flowJsonString
    );
    return hash;
  }

  static async verifyChecksum(
    flowJsonString: string,
    expectedHash: string,
    flowId: string,
    flowVersion: string
  ): Promise<ChecksumVerificationResult> {
    const computedHash = await this.computeFlowHash(flowJsonString);
    
    const normalizedExpected = expectedHash.toLowerCase().trim();
    const normalizedComputed = computedHash.toLowerCase().trim();
    const isValid = normalizedExpected === normalizedComputed;

    if (!isValid) {
      return {
        is_valid: false,
        flow_id: flowId,
        flow_version: flowVersion,
        expected_hash: normalizedExpected,
        computed_hash: normalizedComputed,
        error_message: `Checksum mismatch: expected ${normalizedExpected}, computed ${normalizedComputed}`,
      };
    }

    return {
      is_valid: true,
      flow_id: flowId,
      flow_version: flowVersion,
      expected_hash: normalizedExpected,
      computed_hash: normalizedComputed,
    };
  }

  static async verifyChecksumOrThrow(
    flowJsonString: string,
    expectedHash: string,
    flowId: string,
    flowVersion: string
  ): Promise<void> {
    const result = await this.verifyChecksum(
      flowJsonString,
      expectedHash,
      flowId,
      flowVersion
    );

    if (!result.is_valid) {
      console.error('[CHECKSUM_VERIFICATION_FAILED]', {
        flow_id: flowId,
        flow_version: flowVersion,
        expected_hash: result.expected_hash,
        computed_hash: result.computed_hash,
        timestamp: new Date().toISOString(),
      });

      throw new ChecksumVerificationError(
        `Flow checksum verification failed for ${flowId} v${flowVersion}. ` +
        `Expected hash: ${result.expected_hash}, Computed hash: ${result.computed_hash}. ` +
        `Flow may have been modified. Refusing to execute.`,
        flowId,
        flowVersion,
        result.expected_hash,
        result.computed_hash
      );
    }

    console.log('[CHECKSUM_VERIFICATION_SUCCESS]', {
      flow_id: flowId,
      flow_version: flowVersion,
      hash: result.computed_hash,
      timestamp: new Date().toISOString(),
    });
  }
  static parseChecksumFile(checksumFileContent: string): string {
    const hash = checksumFileContent.split('\n')[0].trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(
        `Invalid checksum format: expected 64 hex characters, got "${hash}"`
      );
    }
    return hash;
  }
}