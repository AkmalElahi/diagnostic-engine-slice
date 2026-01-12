import { FlowEngine } from '../utils/FlowEngine';
import { FlowDefinition, SessionSummary } from '../types';
import sampleFlow from '../flows/sample_flow.json';

/**
 * Normalize summary for comparison (remove non-deterministic fields)
 */
function normalizeSummary(summary: SessionSummary) {
  return {
    flow_id: summary.flow_id,
    flow_version: summary.flow_version,
    events: summary.events.map(e => ({
      node_id: e.node_id,
      type: e.type,
      value: e.value,
    })),
    terminal_node_id: summary.terminal_node_id,
    result: summary.result,
  };
}

/**
 * DEMONSTRATION: Determinism Proof for Client
 */
export function demonstrateDeterminism() {
  console.log('═══════════════════════════════════════════════');
  console.log('     DETERMINISM PROOF DEMONSTRATION');
  console.log('═══════════════════════════════════════════════\n');

  console.log('Test Inputs:');
  console.log('Q1: Is RV connected to shore power? → YES');
  console.log('S1: Disconnect shore power → ACKNOWLEDGED');
  console.log('M1: Battery voltage → 11.5V\n');

  // ===== RUN 1 =====
  console.log('RUN 1 - Starting...');
  const engine1 = new FlowEngine(sampleFlow as FlowDefinition);
  let session1 = engine1.startSession();
  session1 = engine1.processResponse(session1, true);  // YES
  session1 = engine1.processResponse(session1, true);  // Acknowledge
  session1 = engine1.processResponse(session1, 11.5); // 11.5V

  const summary1: SessionSummary = {
    flow_id: session1.flow_id,
    flow_version: session1.flow_version,
    session_id: session1.session_id,
    started_at: session1.started_at,
    completed_at: session1.completed_at!,
    events: session1.events,
    terminal_node_id: session1.terminal_node_id!,
    result: session1.result!,
  };

  console.log('Run 1 Complete\n');

  // Wait 2 seconds to show different timestamps
  console.log('Waiting 2 seconds...\n');
  const waitMs = 2000;
  const startTime = Date.now();
  while (Date.now() - startTime < waitMs) {
    // Blocking wait
  }

  // ===== RUN 2 =====
  console.log('RUN 2 - Starting (with same inputs)...');
  const engine2 = new FlowEngine(sampleFlow as FlowDefinition);
  let session2 = engine2.startSession();
  session2 = engine2.processResponse(session2, true);  // YES
  session2 = engine2.processResponse(session2, true);  // Acknowledge
  session2 = engine2.processResponse(session2, 11.5); // 11.5V

  const summary2: SessionSummary = {
    flow_id: session2.flow_id,
    flow_version: session2.flow_version,
    session_id: session2.session_id,
    started_at: session2.started_at,
    completed_at: session2.completed_at!,
    events: session2.events,
    terminal_node_id: session2.terminal_node_id!,
    result: session2.result!,
  };

  console.log('Run 2 Complete\n');

  // ===== NORMALIZED COMPARISON =====
  console.log('═══════════════════════════════════════════════');
  console.log('NORMALIZED OUTPUT COMPARISON');
  console.log('(Removed: session_id, timestamps)');
  console.log('═══════════════════════════════════════════════\n');

  const normalized1 = normalizeSummary(summary1);
  const normalized2 = normalizeSummary(summary2);

  console.log('Run 1 Normalized:');
  console.log(JSON.stringify(normalized1, null, 2));
  console.log('\nRun 2 Normalized:');
  console.log(JSON.stringify(normalized2, null, 2));

  const normalizedMatch = JSON.stringify(normalized1) === JSON.stringify(normalized2);
  console.log(`\n${normalizedMatch ? 'PASS' : 'FAIL'}: Normalized outputs are identical\n`);

  // ===== DETAILED FIELD COMPARISON =====
  console.log('═══════════════════════════════════════════════');
  console.log('DETAILED FIELD-BY-FIELD COMPARISON');
  console.log('═══════════════════════════════════════════════\n');

  const checks = [
    { 
      field: 'flow_id', 
      value1: normalized1.flow_id, 
      value2: normalized2.flow_id,
      match: normalized1.flow_id === normalized2.flow_id
    },
    { 
      field: 'flow_version', 
      value1: normalized1.flow_version, 
      value2: normalized2.flow_version,
      match: normalized1.flow_version === normalized2.flow_version
    },
    { 
      field: 'terminal_node_id', 
      value1: normalized1.terminal_node_id, 
      value2: normalized2.terminal_node_id,
      match: normalized1.terminal_node_id === normalized2.terminal_node_id
    },
    { 
      field: 'result', 
      value1: normalized1.result, 
      value2: normalized2.result,
      match: normalized1.result === normalized2.result
    },
    { 
      field: 'events.length', 
      value1: normalized1.events.length, 
      value2: normalized2.events.length,
      match: normalized1.events.length === normalized2.events.length
    },
  ];

  checks.forEach(check => {
    console.log(`${check.field}:`);
    console.log(`  Run 1: ${JSON.stringify(check.value1)}`);
    console.log(`  Run 2: ${JSON.stringify(check.value2)}`);
    console.log(`  ${check.match ? 'MATCH' : 'DIFFERENT'}\n`);
  });

  // Check each event
  console.log('Event Sequence:');
  const eventsMatch = normalized1.events.every((e1, i) => {
    const e2 = normalized2.events[i];
    const match = 
      e1.node_id === e2.node_id &&
      e1.type === e2.type &&
      e1.value === e2.value;
    
    console.log(`  Event ${i + 1}:`);
    console.log(`    Node: ${e1.node_id} → ${e2.node_id} ${e1.node_id === e2.node_id ? 'PASS' : 'FAIL'}`);
    console.log(`    Type: ${e1.type} → ${e2.type} ${e1.type === e2.type ? 'PASS' : 'FAIL'}`);
    console.log(`    Value: ${e1.value} → ${e2.value} ${e1.value === e2.value ? 'PASS' : 'FAIL'}`);
    
    return match;
  });
  console.log(`All events match: ${eventsMatch ? 'PASS' : 'FAIL'}\n`);

  // ===== FINAL VERDICT =====
  console.log('═══════════════════════════════════════════════');
  console.log('DETERMINISM TEST RESULT');
  console.log('═══════════════════════════════════════════════\n');

  const allChecksPass = checks.every(c => c.match) && eventsMatch;

  if (allChecksPass) {
    console.log('PASS: DETERMINISTIC ENGINE CONFIRMED');
    console.log('\n✓ Same inputs produced identical business logic');
    console.log('✓ Event sequence matches perfectly');
    console.log('✓ Final result is consistent');
    console.log('✓ Flow execution is deterministic\n');
  } else {
    console.log('FAIL: Non-deterministic behavior detected\n');
  }

  console.log('═══════════════════════════════════════════════\n');

  return allChecksPass;
}