import {
  FlowValidator,
  FlowValidationError,
  ChecksumVerificationError,
  EnumValidationError,
  RawFlow,
} from '../validators/FlowValidator';
import { FlowChecksumValidator } from '../validators/Flowchecksumvalidator';

describe('FlowValidator  Validation', () => {
  // Sample valid flow for testing
  const validFlow: RawFlow = {
    flowId: 'test_flow_ms57',
    flowVersion: '1.0',
    startNode: 'q1',
    nodes: {
      q1: {
        type: 'QUESTION',
        text: 'Test question?',
        answers: { Yes: 't1', No: 't1' },
      },
      t1: {
        type: 'TERMINAL',
        result: 'Complete',
        artifact: {
          vertical_id: 'RV',
          issue: 'Test Issue',
          flow_id: 'test_flow_ms57',
          flow_version: '1.0',
          artifact_schema_version: '1.0',
          stop_reason: 'Complete',
          last_confirmed_state: 'Completed',
          safety_notes: ['Test safety note'],
          stabilization_actions: ['Test action'],
          recommendations: ['Test recommendation'],
          notes: 'Test notes',
        },
      },
    },
  };

  beforeEach(() => {
    // Clear flow ID registry before each test
    FlowValidator.clearRegistry();
  });

  describe('Flow ID Uniqueness Validation', () => {
    it('should allow first registration of flow ID', () => {
      expect(() => {
        FlowValidator.validateSync(validFlow);
      }).not.toThrow();
    });

    it('should reject duplicate flow IDs', () => {
      // Register first time
      FlowValidator.validateSync(validFlow);

      // Try to register again
      expect(() => {
        FlowValidator.validateSync(validFlow);
      }).toThrow(FlowValidationError);

      try {
        FlowValidator.validateSync(validFlow);
      } catch (error) {
        expect(error).toBeInstanceOf(FlowValidationError);
        expect((error as Error).message).toContain('Duplicate flow ID');
        expect((error as Error).message).toContain('test_flow_ms57');
      }
    });

    it('should allow different flow IDs', () => {
      const flow1 = { ...validFlow, flowId: 'flow_1' };
      const flow2 = { ...validFlow, flowId: 'flow_2' };

      expect(() => {
        FlowValidator.validateSync(flow1);
        FlowValidator.validateSync(flow2);
      }).not.toThrow();
    });

    it('should reset registry on clearRegistry()', () => {
      FlowValidator.validateSync(validFlow);
      FlowValidator.clearRegistry();

      // Should not throw after clearing
      expect(() => {
        FlowValidator.validateSync(validFlow);
      }).not.toThrow();
    });
  });

  describe('Enum Validation', () => {
    it('should accept valid vertical_id enum value', () => {
      const flowWithValidVertical = {
        ...validFlow,
        flowId: 'test_valid_vertical',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              vertical_id: 'RV',
            },
          },
        },
      };

      expect(() => {
        FlowValidator.validateSync(flowWithValidVertical);
      }).not.toThrow();
    });

    it('should reject invalid vertical_id enum value', () => {
      const flowWithInvalidVertical = {
        ...validFlow,
        flowId: 'test_invalid_vertical',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              vertical_id: 'INVALID_VERTICAL',
            },
          },
        },
      };

      expect(() => {
        FlowValidator.validateSync(flowWithInvalidVertical);
      }).toThrow(EnumValidationError);

      try {
        FlowValidator.validateSync(flowWithInvalidVertical);
      } catch (error) {
        expect(error).toBeInstanceOf(EnumValidationError);
        const enumError = error as EnumValidationError;
        expect(enumError.field).toBe('vertical_id');
        expect(enumError.value).toBe('INVALID_VERTICAL');
        expect(enumError.allowedValues).toContain('RV');
      }
    });

    it('should accept valid artifact_schema_version enum value', () => {
      const flowWithValidSchema = {
        ...validFlow,
        flowId: 'test_valid_schema',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              artifact_schema_version: '1.0',
            },
          },
        },
      };

      expect(() => {
        FlowValidator.validateSync(flowWithValidSchema);
      }).not.toThrow();
    });

  });

  describe('Checksum Validation (Async)', () => {
    it('should validate flow with correct checksum', async () => {
      const flowJsonString = JSON.stringify(validFlow);
      const expectedChecksum = await FlowChecksumValidator.computeFlowHash(flowJsonString);

      await expect(
        FlowValidator.validate(validFlow, expectedChecksum)
      ).resolves.not.toThrow();
    });

    it('should reject flow with incorrect checksum', async () => {
      const wrongChecksum = 'a'.repeat(64);

      await expect(
        FlowValidator.validate(validFlow, wrongChecksum)
      ).rejects.toThrow(ChecksumVerificationError);
    });

    it('should skip checksum validation when not provided', async () => {
      await expect(
        FlowValidator.validate(validFlow)
      ).resolves.not.toThrow();
    });

    it('should include flow details in checksum error', async () => {
      const wrongChecksum = 'b'.repeat(64);

      try {
        await FlowValidator.validate(validFlow, wrongChecksum);
        fail('Should have thrown ChecksumVerificationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ChecksumVerificationError);
        const checksumError = error as ChecksumVerificationError;
        expect(checksumError.flow_id).toBe('test_flow_ms57');
        expect(checksumError.flow_version).toBe('1.0');
      }
    });
  });

  describe('Combined Validation', () => {
    it('should run all validations in order', async () => {
      const flowJsonString = JSON.stringify(validFlow);
      const expectedChecksum = await FlowChecksumValidator.computeFlowHash(flowJsonString);

      // Should pass all: checksum, schema, enum, uniqueness
      await expect(
        FlowValidator.validate(validFlow, expectedChecksum)
      ).resolves.not.toThrow();
    });

    it('should fail fast on checksum error before other validations', async () => {
      const wrongChecksum = 'c'.repeat(64);

      // Checksum should fail before reaching uniqueness check
      await expect(
        FlowValidator.validate(validFlow, wrongChecksum)
      ).rejects.toThrow(ChecksumVerificationError);
    });

    it('should catch schema errors after checksum passes', async () => {
      const invalidFlow = {
        ...validFlow,
        flowId: 'test_invalid_flow',
        nodes: {
          q1: {
            type: 'QUESTION',
            text: 'Test?',
            answers: {}, // Empty answers - invalid!
          },
        },
      };

      const flowJsonString = JSON.stringify(invalidFlow);
      const expectedChecksum = await FlowChecksumValidator.computeFlowHash(flowJsonString);

      await expect(
        FlowValidator.validate(invalidFlow, expectedChecksum)
      ).rejects.toThrow(FlowValidationError);
    });

    it('should catch enum errors after schema validation passes', async () => {
      const flowWithInvalidEnum = {
        ...validFlow,
        flowId: 'test_enum_error',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              vertical_id: 'INVALID',
            },
          },
        },
      };

      const flowJsonString = JSON.stringify(flowWithInvalidEnum);
      const expectedChecksum = await FlowChecksumValidator.computeFlowHash(flowJsonString);

      await expect(
        FlowValidator.validate(flowWithInvalidEnum, expectedChecksum)
      ).rejects.toThrow(EnumValidationError);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support synchronous validation via validateSync()', () => {
      expect(() => {
        FlowValidator.validateSync(validFlow);
      }).not.toThrow();
    });

    it('should validate flow structure with validateSync()', () => {
      const invalidFlow = {
        ...validFlow,
        flowId: 'test_sync_invalid',
        startNode: 'nonexistent',
      };

      expect(() => {
        FlowValidator.validateSync(invalidFlow);
      }).toThrow(FlowValidationError);
    });

    it('should validate enums with validateSync()', () => {
      const flowWithInvalidEnum = {
        ...validFlow,
        flowId: 'test_sync_enum',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              vertical_id: 'INVALID',
            },
          },
        },
      };

      expect(() => {
        FlowValidator.validateSync(flowWithInvalidEnum);
      }).toThrow(EnumValidationError);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear error for duplicate flow ID', () => {
      FlowValidator.validateSync(validFlow);

      try {
        FlowValidator.validateSync(validFlow);
        fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Duplicate flow ID');
        expect(message).toContain('test_flow_ms57');
        expect(message).toContain('unique');
      }
    });

    it('should provide clear error for invalid enum', () => {
      const flowWithBadEnum = {
        ...validFlow,
        flowId: 'test_bad_enum',
        nodes: {
          ...validFlow.nodes,
          t1: {
            ...validFlow.nodes.t1,
            artifact: {
              ...(validFlow.nodes.t1 as any).artifact,
              vertical_id: 'MARINE',
            },
          },
        },
      };

      try {
        FlowValidator.validateSync(flowWithBadEnum);
        fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Invalid enum value');
        expect(message).toContain('vertical_id');
        expect(message).toContain('MARINE');
        expect(message).toContain('Allowed values');
      }
    });
  });
});
