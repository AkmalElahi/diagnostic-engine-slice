import { MMKV, createMMKV } from 'react-native-mmkv';
import { ArtifactFinalizationService } from '../utils/Artifactfinalizationservice';
import {
  SessionState,
  TerminalNode,
} from '../types';

// Mock MMKV
jest.mock('react-native-mmkv');

describe('ArtifactFinalizationService', () => {
  let storage: MMKV;
  let integration: ArtifactFinalizationService;

  beforeEach(() => {
    storage = createMMKV({
      id: 'rv-diagnostic-engine-test',
    });
    integration = new ArtifactFinalizationService(storage);
  });

  describe('initializeSession', () => {
    it('should initialize session with artifact_id', () => {
      const session = integration.initializeSession('rv_furnace', '1.0');

      expect(session.artifact_id).toBeDefined();
      expect(session.artifact_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(session.flow_id).toBe('rv_furnace');
      expect(session.flow_version).toBe('1.0');
    });

    it('should generate unique artifact_ids for different sessions', () => {
      const session1 = integration.initializeSession('flow_1', '1.0');
      const session2 = integration.initializeSession('flow_2', '1.0');

      expect(session1.artifact_id).not.toBe(session2.artifact_id);
    });
  });

  describe('finalizeArtifact', () => {
    it('should finalize artifact at terminal node', async () => {
      const session: SessionState = {
        artifact_id: 'test-artifact-id',
        flow_id: 'rv_furnace',
        flow_version: '1.0',
        session_id: 'test-session',
        started_at: '2026-03-06T10:00:00Z',
        current_node_id: 'terminal_1',
        events: [],
        completed: false,
        stopped: false,
        stop_reason: 'User completed',
        executed_nodes: [],
        last_confirmed_state: 'Diagnostic complete',
        answers: {},
        measurements: {},
      };

      const terminalNode: TerminalNode = {
        type: 'TERMINAL',
        result: 'Diagnostic complete',
        artifact: {
          flow_id: 'rv_furnace',
          flow_version: '1.0',
          vertical_id: 'RV',
          issue: 'Furnace not heating',
          stop_reason: 'User completed',
          last_confirmed_state: 'Diagnostic complete',
          safety_notes: ['Safety note 1'],
          stabilization_actions: ['Action 1'],
          recommendations: ['Recommendation 1'],
          notes: 'Test notes',
        },
      };

      const result = await integration.finalizeArtifact(session, terminalNode);

      expect(result.artifact_id).toBe('test-artifact-id');
      expect(result.flow_id).toBe('rv_furnace');
      expect(result.finalization_result).toBeDefined();
      expect(result.finalization_result.canonical_json).toBeDefined();
      expect(result.finalization_result.sha256_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw error if validation fails', async () => {
      const session: SessionState = {
        artifact_id: '',  // Invalid - missing required field
        flow_id: 'rv_furnace',
        flow_version: '1.0',
        session_id: 'test',
        started_at: '2026-03-06T10:00:00Z',
        current_node_id: 'terminal',
        events: [],
        completed: false,
        stopped: false,
        stop_reason: '',
        executed_nodes: [],
        last_confirmed_state: '',
        answers: {},
        measurements: {},
      };

      const terminalNode: TerminalNode = {
        type: 'TERMINAL',
        result: 'Test',
        artifact: {
          flow_id: 'test',
          flow_version: '1.0',
          vertical_id: 'RV',
          issue: 'Test',
          stop_reason: 'Test',
          last_confirmed_state: 'Test',
          safety_notes: [],
          stabilization_actions: [],
          recommendations: [],
          notes: '',
        },
      };

      await expect(
        integration.finalizeArtifact(session, terminalNode)
      ).rejects.toThrow();
    });

    it('should normalize enum values during finalization', async () => {
      const session: SessionState = {
        artifact_id: 'test-id',
        flow_id: 'test',
        flow_version: '1.0',
        session_id: 'test',
        started_at: '2026-03-06T10:00:00Z',
        current_node_id: 'terminal',
        events: [],
        completed: false,
        stopped: false,
        stop_reason: 'Complete',
        executed_nodes: [],
        last_confirmed_state: 'Done',
        answers: {},
        measurements: {},
      };

      const terminalNode: TerminalNode = {
        type: 'TERMINAL',
        result: 'Done',
        artifact: {
          flow_id: 'test',
          flow_version: '1.0',
          vertical_id: 'rv',  // lowercase - should be normalized to 'RV'
          issue: 'Test',
          stop_reason: 'Complete',
          last_confirmed_state: 'Done',
          safety_notes: [],
          stabilization_actions: ['Action'],
          recommendations: ['Rec'],
          notes: '',
        },
      };

      const result = await integration.finalizeArtifact(session, terminalNode);

      expect(result.finalization_result.final_artifact.vertical_id).toBe('RV');
    });
  });

  describe('finalizeAndStore', () => {
    it('should finalize and call store callback', async () => {
      const session: SessionState = {
        artifact_id: 'test-id',
        flow_id: 'test',
        flow_version: '1.0',
        session_id: 'test',
        started_at: '2026-03-06T10:00:00Z',
        current_node_id: 'terminal',
        events: [],
        completed: false,
        stopped: false,
        stop_reason: 'Complete',
        executed_nodes: [],
        last_confirmed_state: 'Done',
        answers: {},
        measurements: {},
      };

      const terminalNode: TerminalNode = {
        type: 'TERMINAL',
        result: 'Done',
        artifact: {
          flow_id: 'test',
          flow_version: '1.0',
          vertical_id: 'RV',
          issue: 'Test',
          stop_reason: 'Complete',
          last_confirmed_state: 'Done',
          safety_notes: [],
          stabilization_actions: ['Action'],
          recommendations: ['Rec'],
          notes: '',
        },
      };

      const onStore = jest.fn().mockResolvedValue(undefined);

      const result = await integration.finalizeAndStore(
        session,
        terminalNode,
        onStore
      );

      expect(onStore).toHaveBeenCalledWith(result);
      expect(result.artifact_id).toBe('test-id');
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', () => {
      const stats = integration.getSessionStats();

      expect(stats).toHaveProperty('has_session');
      expect(stats).toHaveProperty('artifact_id');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('stopped');
      expect(stats).toHaveProperty('event_count');
    });
  });
});
