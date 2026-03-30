import { FlowEngine } from '../utils/FlowEngine';
import { CanonicalSerializer } from '../utils/CanonicalSerializer';
import { RawFlow } from '../validators/FlowValidator';
import * as fs from 'fs';
import * as path from 'path';

describe('VerificationHarness - MS5 Contract Compliance', () => {
  const outputDir = path.join(__dirname, '../../test-outputs');

  // Sample flow for verification
  const testFlow: RawFlow = {
    flowId: 'verification_test_flow',
    flowVersion: '1.0',
    startNode: 'q1',
    nodes: {
      q1: {
        type: 'QUESTION',
        text: 'Is the system operational?',
        answers: {
          yes: 's1',
          no: 't_issue',
        },
      },
      s1: {
        type: 'SAFETY',
        text: 'Safety check: Ensure power is off.',
        next: 'm1',
      },
      m1: {
        type: 'MEASURE',
        text: 'Measure voltage in volts.',
        unit: 'volts',
        validRange: { min: 10.0, max: 15.0 },
        branches: [
          { condition: '< 12.0', next: 't_low' },
          { condition: '>= 12.0', next: 't_ok' },
        ],
      },
      t_low: {
        type: 'TERMINAL',
        result: 'Low voltage detected',
        artifact: {
          flow_id: 'verification_test_flow',
          flow_version: '1.0',
          artifact_schema_version: '1.0',
          issue: 'Voltage Test',
          stop_reason: 'Low voltage detected',
          last_confirmed_state: 'Voltage below 12V',
          safety_notes: ['Check battery connections'],
          stabilization_actions: ['Disconnect power'],
          recommendations: ['Replace battery'],
          notes: 'Voltage reading indicates battery issue',
        },
      },
      t_ok: {
        type: 'TERMINAL',
        result: 'Voltage OK',
        artifact: {
          flow_id: 'verification_test_flow',
          flow_version: '1.0',
          artifact_schema_version: '1.0',
          issue: 'Voltage Test',
          stop_reason: 'Voltage OK',
          last_confirmed_state: 'Voltage above 12V',
          safety_notes: ['System operational'],
          stabilization_actions: ['Resume normal operation'],
          recommendations: ['No action needed'],
          notes: 'System voltage is within normal range',
        },
      },
      t_issue: {
        type: 'TERMINAL',
        result: 'System not operational',
        artifact: {
          flow_id: 'verification_test_flow',
          flow_version: '1.0',
          artifact_schema_version: '1.0',
          issue: 'Voltage Test',
          stop_reason: 'System not operational',
          last_confirmed_state: 'System reported as not operational',
          safety_notes: ['Do not operate system'],
          stabilization_actions: ['Power off system'],
          recommendations: ['Contact technician'],
          notes: 'System requires professional inspection',
        },
      },
    },
  };

  beforeAll(() => {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  it('should generate execution_trace.json', async () => {
    const engine = FlowEngine.createUnsafe(testFlow);

    // Start session
    let session = engine.startSession();

    // Execute complete diagnostic flow
    session = await engine.processResponse(session, 'yes'); // q1 → s1
    session = await engine.processResponse(session, true);  // s1 → m1
    session = await engine.processResponse(session, 11.5);  // m1 → t_low

    // Build execution trace
    const executionTrace = {
      session_id: session.session_id,
      flow_id: session.flow_id,
      flow_version: session.flow_version,
      started_at: session.started_at,
      completed_at: session.completed_at,
      execution_events: session.events.map(event => ({
        node_id: event.node_id,
        node_type: event.type,
        value: event.value,
        timestamp: event.timestamp,
      })),
      executed_nodes: session.executed_nodes || [],
      answers: session.answers || {},
      measurements: session.measurements || {},
      final_state: {
        completed: session.completed,
        stopped: session.stopped,
        terminal_node_id: session.terminal_node_id,
        result: session.result,
      },
    };

    // Write to file
    const outputPath = path.join(outputDir, 'execution_trace.json');
    fs.writeFileSync(outputPath, JSON.stringify(executionTrace, null, 2));

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`✓ Generated: ${outputPath}`);
  });

  it('should generate artifact_output.json', async () => {
    const engine = FlowEngine.createUnsafe(testFlow);

    // Start session
    let session = engine.startSession();

    // Execute complete diagnostic flow
    session = await engine.processResponse(session, 'yes');
    session = await engine.processResponse(session, true);
    session = await engine.processResponse(session, 11.5);

    // Extract final artifact
    const artifactOutput = {
      session_id: session.session_id,
      artifact_id: session.artifact_id,
      finalized_at: session.completed_at,
      artifact: session.artifact,
    };

    // Write to file
    const outputPath = path.join(outputDir, 'artifact_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(artifactOutput, null, 2));

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(artifactOutput.artifact).toBeDefined();
    expect(artifactOutput.artifact?.artifact_schema_version).toBe('1.0');
    console.log(`✓ Generated: ${outputPath}`);
  });

  it('should generate serialization_output.json', async () => {
    const engine = FlowEngine.createUnsafe(testFlow);

    // Start session
    let session = engine.startSession();

    // Execute complete diagnostic flow
    session = await engine.processResponse(session, 'yes');
    session = await engine.processResponse(session, true);
    session = await engine.processResponse(session, 11.5);

    // Get artifact and serialize it
    const artifact = session.artifact!;
    const fieldOrder = Object.keys(artifact);

    const serializationResult = await CanonicalSerializer.serialize(artifact, fieldOrder);

    // Build serialization output
    const serializationOutput = {
      artifact_id: session.artifact_id,
      serialized_at: new Date().toISOString(),
      field_order: fieldOrder,
      canonical_json: serializationResult.canonical_json,
      artifact_hash: serializationResult.artifact_hash,
      determinism_verification: {
        description: 'Verify by re-serializing and comparing hashes',
        expected_hash: serializationResult.artifact_hash,
      },
    };

    // Write to file
    const outputPath = path.join(outputDir, 'serialization_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(serializationOutput, null, 2));

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(serializationOutput.artifact_hash).toMatch(/^[a-f0-9]{64}$/);
    console.log(`✓ Generated: ${outputPath}`);
  });

  it('should verify all three outputs exist after test run', () => {
    const files = [
      'execution_trace.json',
      'artifact_output.json',
      'serialization_output.json',
    ];

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }

    console.log('\n=== Verification Artifacts Generated ===');
    console.log(`Location: ${outputDir}`);
    console.log('Files:');
    files.forEach(f => console.log(`  - ${f}`));
    console.log('=========================================\n');
  });
});