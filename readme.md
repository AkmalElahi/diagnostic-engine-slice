# RV TECH VAULT — SLICE PROOF

An offline-first, JSON-driven diagnostic flow system built with React Native and Expo.

## Overview

This application demonstrates a deterministic diagnostic engine that:

- Executes flows entirely from JSON configuration
- Maintains offline-first persistence using MMKV
- Supports session resumption after app kill
- Generates immutable summary JSON

## Technology Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Storage**: MMKV (fast, synchronous key-value storage)
- **Architecture**: Offline-first, no backend/cloud/AI

## Features

### Core Capabilities

- ✅ **JSON-Driven**: All flow logic defined in JSON configuration
- ✅ **Offline-First**: Works entirely offline with local persistence
- ✅ **State Persistence**: Atomic writes, survives app kill
- ✅ **Session Resume**: Resume exact state after restart
- ✅ **Immutable Summary**: Generate schema-compliant JSON summaries
- ✅ **Flow Validation**: Schema validation blocks invalid flows before execution
- ✅ **Error Handling**: Comprehensive error boundaries and validation

### Node Types

1. **QUESTION** - Yes/No branching

   ```json
   {
     "type": "QUESTION",
     "text": "Is the RV connected to shore power?",
     "yes": "node_id_if_yes",
     "no": "node_id_if_no"
   }
   ```

2. **SAFETY** - Warning acknowledgment

   ```json
   {
     "type": "SAFETY",
     "text": "Disconnect shore power before proceeding.",
     "next": "next_node_id"
   }
   ```

3. **MEASURE** - Numeric input with validation
   ```json
   {
     "type": "MEASURE",
     "text": "Measure battery voltage (DC).",
     "min": 10,
     "max": 14,
     "branches": {
       "below": "node_if_out_of_range",
       "within": "node_if_in_range"
     }
   }
   ```

4. **TERMINAL** - End state
   ```json
   {
     "type": "TERMINAL",
     "result": "Battery voltage is low."
   }
   ```

## Installation

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

````

2. **Generate native code** (required for MMKV):
```bash
   npx expo prebuild
````

3. **Start the iOS Simulator**:

   ```bash
   npx expo run:ios
   ```

4. **Start the Android Emulator**:

   ```bash
   npx expo run:android
   ```

## How It Works

### Flow Execution

1. **Load Flow**: Flow definition loaded from JSON
2. **Validate Flow**: Schema validation runs on construction (blocks invalid flows)
3. **Start Session**: Creates new session with unique ID and timestamp
4. **Navigate Nodes**: Process user responses to determine next node
5. **Record Events**: Each interaction saved as timestamped event
6. **Persist State**: Atomic writes to MMKV after each step
7. **Generate Summary**: On completion, immutable summary created

### State Management

The app maintains a single session state object:

```typescript
interface SessionState {
  flow_id: string;
  flow_version: string;
  session_id: string;
  started_at: string;
  current_node_id: string;
  events: SessionEvent[];
  completed: boolean;
  completed_at?: string;
  terminal_node_id?: string;
  result?: string;
}
```

### Storage Architecture

- **MMKV**: Fast, synchronous key-value storage
- **Atomic Writes**: Each state update is a single atomic operation
- **Session Persistence**: Current session survives app kill/restart
- **History**: Completed sessions stored separately

### Resume Behavior

The app automatically checks for existing session on startup:

1. If found → Resume from exact node
2. If completed → Show result
3. If none → Show welcome screen

## Validation & Verification

### Flow Validation Enforcement

**Validation is enforced at flow load time in `FlowEngine` constructor:**

```typescript
constructor(flowDefinition: FlowDefinition) {
  // Validation runs BEFORE engine is created
  FlowValidator.validate(flowDefinition); // Throws FlowValidationError on failure
  this.flowDefinition = flowDefinition;
}
```

**Key Points:**

- Validation **blocks execution** - invalid flows cannot run
- Throws `FlowValidationError` with specific error message
- App shows error alert, does not crash
- No warnings - validation is enforced, not advisory

**What Gets Validated:**

- Flow structure (flow_id, flow_version, start_node, nodes)
- Node types and required fields
- Reference integrity (all branch targets exist)
- Data types (numbers for MEASURE min/max, strings for text)
- Logic constraints (min < max, at least one TERMINAL node)
- Reachability (warns about unreachable nodes)

### Determinism Scope

**Deterministic Fields (Guaranteed Identical):**

- `flow_id` - Same flow
- `flow_version` - Same version
- `events[].node_id` - Same nodes visited
- `events[].type` - Same node types
- `events[].value` - Same user responses
- `terminal_node_id` - Same ending node
- `result` - Same result text

**Non-Deterministic Fields (Expected to Vary):**

- `session_id` - Randomly generated per session
- `started_at` - Timestamp of session start
- `completed_at` - Timestamp of session completion
- `events[].timestamp` - Timestamp of each interaction

**Normalization for Comparison:**
When verifying determinism, strip out non-deterministic fields:

```typescript
function normalize(summary) {
  return {
    flow_id: summary.flow_id,
    flow_version: summary.flow_version,
    events: summary.events.map((e) => ({
      node_id: e.node_id,
      type: e.type,
      value: e.value,
    })),
    terminal_node_id: summary.terminal_node_id,
    result: summary.result,
  };
}
```

Two normalized summaries from identical inputs **must** be 100% identical.

### Verification Tests

#### 1. Determinism Verification

**Test:** Run same diagnostic twice with identical inputs, compare normalized outputs.

**Inputs:**

- Q1: Is RV connected to shore power? → `YES`
- S1: Disconnect shore power → `ACKNOWLEDGED`
- M1: Battery voltage → `11.5`

**Expected Pass Result:**

```
PASS: DETERMINISTIC ENGINE CONFIRMED

✓ Same inputs produced identical business logic
✓ Event sequence matches perfectly
✓ Final result is consistent
✓ Flow execution is deterministic

Normalized Output 1 === Normalized Output 2:
{
  "flow_id": "demo_12v_no_power",
  "flow_version": "0.1",
  "events": [
    { "node_id": "q1", "type": "QUESTION", "value": true },
    { "node_id": "s1", "type": "SAFETY", "value": true },
    { "node_id": "m1", "type": "MEASURE", "value": 11.5 },
    { "node_id": "t2", "type": "TERMINAL", "value": true }
  ],
  "terminal_node_id": "t2",
  "result": "Battery voltage is normal."
}
```

**Run Test:**

```typescript
import { demonstrateDeterminism } from './src/tests/determinism-demo';
demonstrateDeterminism();
```

---

#### 2. Flow Validation Verification

**Test:** Load 8 intentionally invalid flows, verify correct errors thrown.

**Invalid Flow Examples:**

**Example 1: Missing start_node**

```json
{
  "flow_id": "broken_flow",
  "flow_version": "1.0",
  "nodes": { ... }
}
```

**Expected Error:** `Flow must have a valid start_node`

**Example 2: Broken reference**

```json
{
  "start_node": "q1",
  "nodes": {
    "q1": {
      "type": "QUESTION",
      "yes": "missing_node", // Doesn't exist
      "no": "t1"
    }
  }
}
```

**Expected Error:** `QUESTION node "q1" yes branch "missing_node" does not exist`

**Expected Pass Result:**

```
ALL VALIDATION TESTS PASSED (8/8)

✓ All invalid flows were correctly rejected
✓ All error messages were accurate
✓ Flow validator is working correctly

Test Results:
  Missing start_node → Correct error thrown
  Broken reference → Correct error thrown
  Invalid MEASURE range → Correct error thrown
  Missing text field → Correct error thrown
  Missing TERMINAL node → Correct error thrown
  Wrong data type → Correct error thrown
  Missing branch → Correct error thrown
  Start node doesn't exist → Correct error thrown
```

**Run Test:**

```typescript
import { demonstrateValidation } from './src/tests/validation-demo';
demonstrateValidation();
```

---

#### 3. Resume-After-Kill Verification

**Test:** Start diagnostic, force quit app mid-flow, resume and complete.

**Test Steps:**

1. Start session → Answer Q1 (YES) → Acknowledge safety
2. **Force quit app** (kill process, not background)
3. Relaunch app
4. Verify session restored from MMKV (not UI memory)
5. Complete diagnostic
6. Compare summary with clean run (no kill)

**Expected Pass Result:**

```
RESUME-AFTER-KILL TEST PASSED

=== BEFORE KILL ===
Session ID: session_1234567890_abc123
Current node: m1
Events count: 2
Session state saved to MMKV

SIMULATING APP KILL...

=== AFTER KILL ===
Session restored from MMKV storage (not UI memory)
Session ID: session_1234567890_abc123  ← Same ID
Current node: m1                        ← Same node
Events count: 2                         ← Same events

=== COMPLETING AFTER RESUME ===
Final summary events: 4
Result: "Battery voltage is normal."

=== COMPARISON WITH CLEAN RUN ===
Clean run summary events: 4
Result: "Battery voltage is normal."

PASS: Resume-then-complete produces same summary as clean run
PASS: Session state matches pre-kill state
PASS: No data loss occurred
```

**Console Logs Indicate Success:**

```
Session state loaded: session_1234567890_abc123
Session resumed: session_1234567890_abc123
```

**Manual Test (iOS):**

```bash
1. npx expo run:ios
2. Start diagnostic, answer 2 questions
3. Cmd+Shift+H+H, swipe app up (force quit)
4. Tap app icon to relaunch
5. Should resume at step 3
```

**Manual Test (Android):**

```bash
1. npx expo run:android
2. Start diagnostic, answer 2 questions
3. Recent apps button, swipe app away (force quit)
4. Tap app icon to relaunch
5. ✅ Should resume at step 3
```

**Run Automated Test:**

```typescript
import { testResumeAfterKill } from './src/tests/resume.test';
testResumeAfterKill();
```

## Testing Resume Functionality

### iOS Simulator

1. Start a diagnostic flow
2. Complete a few steps
3. Force quit: `Cmd + Shift + H + H` then swipe up
4. Restart app → Should resume at exact node

### Android Emulator

1. Start a diagnostic flow
2. Complete a few steps
3. Force quit: Swipe up to recent apps and swipe away
4. Restart app → Should resume at exact node

### Physical Device

1. Start a diagnostic flow
2. Complete a few steps
3. Force quit: Double-tap home, swipe up to close
4. Restart app → Should resume at exact node

## Summary Schema

Completed sessions generate summaries matching this schema:

```json
{
  "flow_id": "demo_12v_no_power",
  "flow_version": "0.1",
  "session_id": "session_1234567890_abc123",
  "started_at": "2024-01-01T12:00:00.000Z",
  "completed_at": "2024-01-01T12:05:30.000Z",
  "events": [
    {
      "node_id": "q1",
      "type": "QUESTION",
      "value": true,
      "timestamp": "2024-01-01T12:00:15.000Z"
    }
  ],
  "terminal_node_id": "t1",
  "result": "Battery voltage is low."
}
```

## Acceptance Checklist

### Engine

- ✅ Flow driven entirely by JSON
- ✅ No hard-coded logic
- ✅ Schema validation enforced

### State

- ✅ Single session state object
- ✅ Local persistence (MMKV)
- ✅ Atomic writes

### Resume Test

- ✅ Kill app mid-flow
- ✅ Resume exact node
- ✅ Verified with automated test

### Summary

- ✅ Matches schema
- ✅ Correct ordering
- ✅ Deterministic output (normalized)

### Validation

- ✅ Invalid flows rejected at load time
- ✅ Specific error messages provided
- ✅ 8 test cases verified

### Constraints

- ✅ No backend
- ✅ No cloud
- ✅ No AI

### Deliverables

- ✅ Source code
- ✅ README with verification notes
- ⏳ Demo video

## Project Structure

```
rv-diagnostic-engine/
├── src/
│   ├── types.ts                     # TypeScript definitions
│   ├── utils/
│   │   ├── flowEngine.ts           # Diagnostic engine with validation
│   │   ├── flowValidator.ts        # Schema validation (enforced)
│   │   └── StorageService.ts       # MMKV persistence
│   ├── components/
│   │   ├── QuestionNodeComponent.tsx
│   │   ├── SafetyNodeComponent.tsx
│   │   ├── MeasureNodeComponent.tsx
│   │   ├── TerminalNodeComponent.tsx
│   │   ├── HistoryView.tsx
│   │   ├── FlowSelector.tsx
│   │   └── ErrorBoundary.tsx       # React error handling
│   ├── flows/
│   │   └── sample_flow.json        # Sample diagnostic flow
│   └── tests/                       # Verification tests
│       ├── determinism-demo.ts     # Determinism verification
│       ├── validation-demo.ts      # Flow validation tests
├── App.tsx                          # Main application
├── package.json
└── README.md
```

## Development Notes

### Adding New Node Types

1. Add type to `src/types.ts`
2. Create component in `src/components/`
3. Add validation in `flowValidator.ts`
4. Add case in `flowEngine.ts` processResponse()
5. Add render case in `App.tsx`

### Error Handling Strategy

- **FlowValidationError**: Thrown when flow schema is invalid
- **FlowEngineError**: Thrown when runtime logic fails
- **StorageError**: Thrown when persistence fails
- **ErrorBoundary**: Catches React rendering errors

All errors provide specific, actionable messages.
