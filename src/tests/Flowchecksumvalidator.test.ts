import { FlowChecksumValidator, ChecksumVerificationError } from '../utils/Flowchecksumvalidator';

describe('FlowChecksumValidator', () => {
  const sampleFlowJson = JSON.stringify({
    flowId: 'test_flow',
    flowVersion: '1.0',
    startNode: 'q1',
    nodes: {
      q1: { type: 'QUESTION', text: 'Test?', answers: { Yes: 't1' } },
      t1: { type: 'TERMINAL', result: 'Done', artifact: {} },
    },
  });

  describe('computeFlowHash', () => {
    it('should compute SHA-256 hash of flow JSON', async () => {
      const hash = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce identical hashes for identical JSON strings', async () => {
      const hash1 = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);
      const hash2 = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different JSON strings', async () => {
      const modified = sampleFlowJson.replace('Test?', 'Modified?');
      
      const hash1 = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);
      const hash2 = await FlowChecksumValidator.computeFlowHash(modified);

      expect(hash1).not.toBe(hash2);
    });

    it('should be sensitive to whitespace changes', async () => {
      const withSpace = sampleFlowJson.replace('{', '{ ');
      
      const hash1 = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);
      const hash2 = await FlowChecksumValidator.computeFlowHash(withSpace);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyChecksum', () => {
    it('should verify matching checksums', async () => {
      const computedHash = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);

      const result = await FlowChecksumValidator.verifyChecksum(
        sampleFlowJson,
        computedHash,
        'test_flow',
        '1.0'
      );

      expect(result.is_valid).toBe(true);
      expect(result.flow_id).toBe('test_flow');
      expect(result.flow_version).toBe('1.0');
      expect(result.expected_hash).toBe(computedHash);
      expect(result.computed_hash).toBe(computedHash);
    });

    it('should detect mismatched checksums', async () => {
      const wrongHash = 'a'.repeat(64);

      const result = await FlowChecksumValidator.verifyChecksum(
        sampleFlowJson,
        wrongHash,
        'test_flow',
        '1.0'
      );

      expect(result.is_valid).toBe(false);
      expect(result.expected_hash).toBe(wrongHash);
      expect(result.computed_hash).not.toBe(wrongHash);
      expect(result.error_message).toContain('Checksum mismatch');
    });

    it('should normalize hashes (case-insensitive)', async () => {
      const computedHash = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);
      const uppercaseHash = computedHash.toUpperCase();

      const result = await FlowChecksumValidator.verifyChecksum(
        sampleFlowJson,
        uppercaseHash,
        'test_flow',
        '1.0'
      );

      expect(result.is_valid).toBe(true);
    });

    it('should handle whitespace in expected hash', async () => {
      const computedHash = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);
      const hashWithWhitespace = `  ${computedHash}  \n`;

      const result = await FlowChecksumValidator.verifyChecksum(
        sampleFlowJson,
        hashWithWhitespace,
        'test_flow',
        '1.0'
      );

      expect(result.is_valid).toBe(true);
    });
  });

  describe('verifyChecksumOrThrow', () => {
    it('should pass for valid checksum', async () => {
      const computedHash = await FlowChecksumValidator.computeFlowHash(sampleFlowJson);

      await expect(
        FlowChecksumValidator.verifyChecksumOrThrow(
          sampleFlowJson,
          computedHash,
          'test_flow',
          '1.0'
        )
      ).resolves.not.toThrow();
    });

    it('should throw ChecksumVerificationError for invalid checksum', async () => {
      const wrongHash = 'a'.repeat(64);

      await expect(
        FlowChecksumValidator.verifyChecksumOrThrow(
          sampleFlowJson,
          wrongHash,
          'test_flow',
          '1.0'
        )
      ).rejects.toThrow(ChecksumVerificationError);
    });

    it('should include flow details in error', async () => {
      const wrongHash = 'a'.repeat(64);

      try {
        await FlowChecksumValidator.verifyChecksumOrThrow(
          sampleFlowJson,
          wrongHash,
          'test_flow',
          '1.0'
        );
        fail('Should have thrown ChecksumVerificationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ChecksumVerificationError);
        const checksumError = error as ChecksumVerificationError;
        expect(checksumError.flow_id).toBe('test_flow');
        expect(checksumError.flow_version).toBe('1.0');
        expect(checksumError.expected_hash).toBe(wrongHash);
        expect(checksumError.computed_hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  describe('parseChecksumFile', () => {
    it('should parse valid checksum file content', () => {
      const validHash = 'a'.repeat(64);
      const fileContent = `${validHash}\n`;

      const parsed = FlowChecksumValidator.parseChecksumFile(fileContent);

      expect(parsed).toBe(validHash);
    });

    it('should handle content without trailing newline', () => {
      const validHash = 'b'.repeat(64);
      const fileContent = validHash;

      const parsed = FlowChecksumValidator.parseChecksumFile(fileContent);

      expect(parsed).toBe(validHash);
    });

    it('should handle multiple lines (use first line)', () => {
      const validHash = 'c'.repeat(64);
      const fileContent = `${validHash}\nExtra content\n`;

      const parsed = FlowChecksumValidator.parseChecksumFile(fileContent);

      expect(parsed).toBe(validHash);
    });

    it('should normalize to lowercase', () => {
      const uppercaseHash = 'A'.repeat(64);
      const fileContent = `${uppercaseHash}\n`;

      const parsed = FlowChecksumValidator.parseChecksumFile(fileContent);

      expect(parsed).toBe(uppercaseHash.toLowerCase());
    });

    it('should throw error for invalid hash format', () => {
      const invalidHash = 'not-a-valid-hash';
      const fileContent = `${invalidHash}\n`;

      expect(() => {
        FlowChecksumValidator.parseChecksumFile(fileContent);
      }).toThrow('Invalid checksum format');
    });

    it('should throw error for hash too short', () => {
      const shortHash = 'a'.repeat(32); // Only 32 chars instead of 64
      const fileContent = `${shortHash}\n`;

      expect(() => {
        FlowChecksumValidator.parseChecksumFile(fileContent);
      }).toThrow('Invalid checksum format');
    });

    it('should throw error for hash with invalid characters', () => {
      const invalidHash = 'g'.repeat(64); // 'g' is not a hex char
      const fileContent = `${invalidHash}\n`;

      expect(() => {
        FlowChecksumValidator.parseChecksumFile(fileContent);
      }).toThrow('Invalid checksum format');
    });
  });

  describe('Integration scenarios', () => {
    it('should detect single byte modification', async () => {
      const original = '{"test":"value"}';
      const modified = '{"test":"walue"}'; // Changed 'v' to 'w'

      const originalHash = await FlowChecksumValidator.computeFlowHash(original);

      const result = await FlowChecksumValidator.verifyChecksum(
        modified,
        originalHash,
        'test',
        '1.0'
      );

      expect(result.is_valid).toBe(false);
    });

    it('should detect added whitespace', async () => {
      const original = '{"test":"value"}';
      const withSpace = '{"test": "value"}'; // Added space after colon

      const originalHash = await FlowChecksumValidator.computeFlowHash(original);

      const result = await FlowChecksumValidator.verifyChecksum(
        withSpace,
        originalHash,
        'test',
        '1.0'
      );

      expect(result.is_valid).toBe(false);
    });

    it('should detect field reordering', async () => {
      const original = '{"a":"1","b":"2"}';
      const reordered = '{"b":"2","a":"1"}';

      const originalHash = await FlowChecksumValidator.computeFlowHash(original);

      const result = await FlowChecksumValidator.verifyChecksum(
        reordered,
        originalHash,
        'test',
        '1.0'
      );

      expect(result.is_valid).toBe(false);
    });
  });
});