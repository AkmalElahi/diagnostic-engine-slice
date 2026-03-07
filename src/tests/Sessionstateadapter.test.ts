
import { SessionStateAdapter } from '../utils/Sessionstateadapter';
import { SessionState, ArtifactSessionState } from '../types';

describe('SessionStateAdapter', () => {
  const createMockSessionState = (): SessionState => ({
    flow_id: 'rv_furnace_no_heat',
    flow_version: '1.0',
    session_id: 'session-123',
    artifact_id: 'artifact-456',
    started_at: '2026-03-06T10:00:00Z',
    current_node_id: 'terminal_1',
    events: [
      {
        node_id: 'q1',
        type: 'QUESTION',
        value: 'Flame icon visible',
        timestamp: '2026-03-06T10:01:00Z',
      },
      {
        node_id: 'm1',
        type: 'MEASURE',
        value: 7.2,
        timestamp: '2026-03-06T10:02:00Z',
      },
    ],
    completed: false,
    stopped: false,
    stop_reason: 'User completed',
    executed_nodes: [
      {
        node_id: 'q1',
        node_type: 'QUESTION',
        executed_at: '2026-03-06T10:01:00Z',
        value: 'Flame icon visible',
      },
    ],
    last_confirmed_state: 'Thermostat shows flame',
    answers: { q1: 'Flame icon visible' },
    measurements: { m1: 7.2 },
  });

  describe('toArtifactSessionState', () => {
    it('should convert SessionState to ArtifactSessionState', () => {
      const sessionState = createMockSessionState();
      
      const artifactState = SessionStateAdapter.toArtifactSessionState(sessionState);

      expect(artifactState.artifact_id).toBe('artifact-456');
      expect(artifactState.flow_id).toBe('rv_furnace_no_heat');
      expect(artifactState.flow_version).toBe('1.0');
      expect(artifactState.stop_reason).toBe('User completed');
      expect(artifactState.last_confirmed_state).toBe('Thermostat shows flame');
      expect(artifactState.executed_nodes).toEqual(sessionState.executed_nodes);
      expect(artifactState.answers).toEqual(sessionState.answers);
      expect(artifactState.measurements).toEqual(sessionState.measurements);
    });

    it('should only include ArtifactSessionState fields', () => {
      const sessionState = createMockSessionState();
      
      const artifactState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const keys = Object.keys(artifactState);

      expect(keys).toContain('artifact_id');
      expect(keys).toContain('flow_id');
      expect(keys).not.toContain('session_id'); // Excluded
      expect(keys).not.toContain('completed'); // Excluded
      expect(keys).not.toContain('started_at'); // Excluded
    });
  });

  describe('validateForFinalization', () => {
    it('should pass validation for complete SessionState', () => {
      const sessionState = createMockSessionState();

      expect(() => {
        SessionStateAdapter.validateForFinalization(sessionState);
      }).not.toThrow();
    });

    it('should throw if artifact_id is missing', () => {
      const sessionState = createMockSessionState();
      sessionState.artifact_id = '';

      expect(() => {
        SessionStateAdapter.validateForFinalization(sessionState);
      }).toThrow('artifact_id');
    });

    it('should throw if flow_id is missing', () => {
      const sessionState = createMockSessionState();
      sessionState.flow_id = '';

      expect(() => {
        SessionStateAdapter.validateForFinalization(sessionState);
      }).toThrow('flow_id');
    });

    it('should throw if executed_nodes is not an array', () => {
      const sessionState = createMockSessionState();
      (sessionState as any).executed_nodes = null;

      expect(() => {
        SessionStateAdapter.validateForFinalization(sessionState);
      }).toThrow('executed_nodes must be an array');
    });

    it('should throw if answers is not an object', () => {
      const sessionState = createMockSessionState();
      (sessionState as any).answers = null;

      expect(() => {
        SessionStateAdapter.validateForFinalization(sessionState);
      }).toThrow('answers must be an object');
    });
  });

  describe('extractExecutedNodes', () => {
    it('should extract executed nodes from events', () => {
      const events = [
        {
          node_id: 'q1',
          type: 'QUESTION' as const,
          value: 'Yes',
          timestamp: '2026-03-06T10:00:00Z',
        },
        {
          node_id: 'm1',
          type: 'MEASURE' as const,
          value: 7.5,
          timestamp: '2026-03-06T10:01:00Z',
        },
      ];

      const nodes = SessionStateAdapter.extractExecutedNodes(events);

      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toEqual({
        node_id: 'q1',
        node_type: 'QUESTION',
        executed_at: '2026-03-06T10:00:00Z',
        value: 'Yes',
      });
      expect(nodes[1]).toEqual({
        node_id: 'm1',
        node_type: 'MEASURE',
        executed_at: '2026-03-06T10:01:00Z',
        value: 7.5,
      });
    });
  });

  describe('extractAnswers', () => {
    it('should extract only QUESTION node values', () => {
      const events = [
        {
          node_id: 'q1',
          type: 'QUESTION' as const,
          value: 'Yes',
          timestamp: '2026-03-06T10:00:00Z',
        },
        {
          node_id: 'm1',
          type: 'MEASURE' as const,
          value: 7.5,
          timestamp: '2026-03-06T10:01:00Z',
        },
        {
          node_id: 'q2',
          type: 'QUESTION' as const,
          value: 'No',
          timestamp: '2026-03-06T10:02:00Z',
        },
      ];

      const answers = SessionStateAdapter.extractAnswers(events);

      expect(Object.keys(answers)).toHaveLength(2);
      expect(answers.q1).toBe('Yes');
      expect(answers.q2).toBe('No');
      expect(answers.m1).toBeUndefined(); // Not a QUESTION
    });
  });

  describe('extractMeasurements', () => {
    it('should extract only MEASURE node values', () => {
      const events = [
        {
          node_id: 'q1',
          type: 'QUESTION' as const,
          value: 'Yes',
          timestamp: '2026-03-06T10:00:00Z',
        },
        {
          node_id: 'm1',
          type: 'MEASURE' as const,
          value: 7.5,
          timestamp: '2026-03-06T10:01:00Z',
        },
        {
          node_id: 'm2',
          type: 'MEASURE' as const,
          value: 12.3,
          timestamp: '2026-03-06T10:02:00Z',
        },
      ];

      const measurements = SessionStateAdapter.extractMeasurements(events);

      expect(Object.keys(measurements)).toHaveLength(2);
      expect(measurements.m1).toBe(7.5);
      expect(measurements.m2).toBe(12.3);
      expect(measurements.q1).toBeUndefined(); // Not a MEASURE
    });

    it('should handle non-numeric MEASURE values as null', () => {
      const events = [
        {
          node_id: 'm1',
          type: 'MEASURE' as const,
          value: 'invalid' as any,
          timestamp: '2026-03-06T10:00:00Z',
        },
      ];

      const measurements = SessionStateAdapter.extractMeasurements(events);

      expect(measurements.m1).toBeNull();
    });
  });

  describe('buildFromEvents', () => {
    it('should build complete ArtifactSessionState from events', () => {
      const sessionState = createMockSessionState();

      const artifactState = SessionStateAdapter.buildFromEvents(sessionState);

      expect(artifactState.artifact_id).toBe('artifact-456');
      expect(artifactState.executed_nodes).toHaveLength(2);
      expect(artifactState.answers.q1).toBe('Flame icon visible');
      expect(artifactState.measurements.m1).toBe(7.2);
    });

    it('should use "Unknown" for missing stop_reason', () => {
      const sessionState = createMockSessionState();
      sessionState.stop_reason = '';

      const artifactState = SessionStateAdapter.buildFromEvents(sessionState);

      expect(artifactState.stop_reason).toBe('Unknown');
    });
  });
});