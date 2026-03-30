import { ArtifactFinalizer } from '../utils/ArtifactFinalizer';
import { SessionStateAdapter } from '../utils/Sessionstateadapter';
import {
  SessionState,
  TerminalArtifactTemplate,
  FieldMapping,
  FinalizationError,
  DEFAULT_STRINGS,
} from '../types';

describe('ArtifactFinalizer', () => {
  // Sample session state for testing
  const createSessionState = (overrides?: Partial<SessionState>): SessionState => ({
  artifact_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  flow_id: 'rv_furnace_no_heat',
  flow_version: '1.0',
  session_id: 'session-123',
  started_at: '2026-03-06T10:00:00Z',
  current_node_id: 'q1_thermostat_display',
  stop_reason: 'User completed diagnostic',             
  last_confirmed_state: 'Thermostat shows flame icon',
  completed: false,
  stopped: false,
  events: [],
  executed_nodes: [                                     
    {
      node_id: 'q1_thermostat_display',                 
      node_type: 'QUESTION',                            
      executed_at: '2026-03-06T10:00:00Z',              
      value: 'Flame icon visible',
    },
    {
      node_id: 'm1_gas_pressure',
      node_type: 'MEASURE',
      executed_at: '2026-03-06T10:05:00Z',
      value: 7.2,
    },
  ],
  answers: {
    q1_thermostat_display: 'Flame icon visible',
  },
  measurements: {
    m1_gas_pressure: 7.2,
  },
  ...overrides,
});

  // Sample terminal artifact template
  const createTemplate = (
    overrides?: Partial<TerminalArtifactTemplate>
  ): TerminalArtifactTemplate => ({
    vertical_id: 'RV',
    issue: 'Furnace not heating',
    thermostat_display: 'Flame icon visible',
    gas_pressure: 7.2,
    safety_notes: ['Turn off furnace before inspection'],
    stabilization_actions: ['Check gas supply'],
    recommendations: ['Inspect burner assembly'],
    notes: 'Diagnostic completed',
    ...overrides,
  });

  describe('finalize', () => {
    it('should create final artifact with all required base fields', async () => {
      const template = createTemplate();
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,  // ✅ Use ArtifactSessionState
        fieldOrder
      );

      expect(result.final_artifact.artifact_id).toBe(sessionState.artifact_id);
      expect(result.final_artifact.vertical_id).toBe('RV');
      expect(result.final_artifact.issue).toBe('Furnace not heating');
      expect(result.final_artifact.flow_id).toBe('rv_furnace_no_heat');
      expect(result.final_artifact.flow_version).toBe('1.0');
      expect(result.final_artifact.artifact_schema_version).toBe('1.0');
      expect(result.final_artifact.stop_reason).toBe('User completed diagnostic');
      expect(result.final_artifact.last_confirmed_state).toBe(
        'Thermostat shows flame icon'
      );
    });

    it('should populate artifact_hash via CanonicalSerializer', async () => {
      const template = createTemplate();
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder
      );

      // artifact_hash should be a 64-character hex string
      expect(result.final_artifact.artifact_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.sha256_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce canonical JSON with no placeholders', async () => {
      const template = createTemplate();
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder
      );

      // No double brace tokens
      expect(result.canonical_json).not.toMatch(/\{\{[^}]+\}\}/);
      
      // No whitespace formatting
      expect(result.canonical_json).not.toContain('\n');
      expect(result.canonical_json).not.toContain(': ');
    });

    it('should inject default stabilization_actions if empty', async () => {
      const template = createTemplate({
        stabilization_actions: [], // Empty array
      });
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder
      );

      expect(result.final_artifact.stabilization_actions).toEqual([
        DEFAULT_STRINGS.STABILIZATION_ACTION,
      ]);
      expect(result.warnings).toContain(
        'stabilization_actions was empty, injected default'
      );
    });

    it('should inject default recommendations if empty', async () => {
      const template = createTemplate({
        recommendations: [], // Empty array
      });
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder
      );

      expect(result.final_artifact.recommendations).toEqual([
        DEFAULT_STRINGS.RECOMMENDATION,
      ]);
      expect(result.warnings).toContain(
        'recommendations was empty, injected default'
      );
    });

    it('should preserve non-empty arrays without injection', async () => {
      const template = createTemplate({
        stabilization_actions: ['Custom action'],
        recommendations: ['Custom recommendation'],
      });
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder
      );

      expect(result.final_artifact.stabilization_actions).toEqual(['Custom action']);
      expect(result.final_artifact.recommendations).toEqual(['Custom recommendation']);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle field mappings with runtime values', async () => {
      const template = createTemplate();
      const sessionState = createSessionState();
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const fieldMappings: FieldMapping[] = [
        {
          artifact_field: 'thermostat_display',
          source_node_id: 'q1_thermostat_display',
          field_type: 'string',
        },
        {
          artifact_field: 'gas_pressure',
          source_node_id: 'm1_gas_pressure',
          field_type: 'number',
        },
      ];

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder,
        fieldMappings
      );

      expect(result.final_artifact.thermostat_display).toBe('Flame icon visible');
      expect(result.final_artifact.gas_pressure).toBe(7.2);
    });

    it('should set Unknown for unexecuted string fields', async () => {
      const template = createTemplate();
      const sessionState = createSessionState({
        executed_nodes: [], // No nodes executed
        answers: {},
      });
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const fieldMappings: FieldMapping[] = [
        {
          artifact_field: 'thermostat_display',
          source_node_id: 'q1_thermostat_display',
          field_type: 'string',
        },
      ];

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder,
        fieldMappings
      );

      expect(result.final_artifact.thermostat_display).toBe('Unknown');
    });

    it('should set null for unexecuted number fields', async () => {
      const template = createTemplate();
      const sessionState = createSessionState({
        executed_nodes: [], // No nodes executed
        measurements: {},
      });
      const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      const fieldMappings: FieldMapping[] = [
        {
          artifact_field: 'gas_pressure',
          source_node_id: 'm1_gas_pressure',
          field_type: 'number',
        },
      ];

      const result = await ArtifactFinalizer.finalize(
        template,
        artifactSessionState,
        fieldOrder,
        fieldMappings
      );

      expect(result.final_artifact.gas_pressure).toBeNull();
    });
  });

  describe('extractFieldOrder', () => {
    it('should extract canonical field order from template', () => {
      const template = createTemplate({
        field_a: 'value',
        field_b: 'value',
      });

      const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);

      // Check base fields come first
      expect(fieldOrder[0]).toBe('artifact_id');
      expect(fieldOrder[1]).toBe('artifact_hash');
      expect(fieldOrder[2]).toBe('vertical_id');

      // Check suffix fields come last
      const lastIndex = fieldOrder.length - 1;
      expect(fieldOrder[lastIndex]).toBe('notes');
      expect(fieldOrder[lastIndex - 1]).toBe('recommendations');
      expect(fieldOrder[lastIndex - 2]).toBe('stabilization_actions');
      expect(fieldOrder[lastIndex - 3]).toBe('safety_notes');
    });
  });
});