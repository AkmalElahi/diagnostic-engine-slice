# RV Tech Vault — Diagnostic Engine Developer Documentation

**Version**: 2.0  
**Applies to**: Flows 1–4, FlowEngine.ts, FlowValidator.ts

---

## 1. Architecture Overview

```
Raw Flow JSON (canonical writing pack)
        │
        ▼
  FlowValidator          ← validates structure, routing, and artifact contract
        │                   handles both dict and array node formats natively
        ▼
   FlowEngine            ← executes session, routes answers, enforces STOP
        │
        ▼
 StorageService          ← MMKV offline-first persistence
        │
        ▼
SessionSummary + Artifact  ← immutable technician-ready output
```

The engine is **immutable infrastructure**. All diagnostic content lives in flow JSON files. Do not add diagnostic logic, question text, or routing rules to the engine.

---

## 2. Flow JSON Structure

### 2.1 Top-Level Fields

```json
{
  "flowId": "flow_1_no_power_inside_rv",
  "flowVersion": "2.0",
  "title": "No Power Inside RV",
  "startNode": "capability_gate",
  "nodes": { ... }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `flowId` | string | ✓ | Unique flow identifier |
| `flowVersion` | string | ✓ | Semantic version string |
| `title` | string | ✓ | Human-readable flow name |
| `startNode` | string | ✓ | Must reference an existing node ID |
| `nodes` | object or array | ✓ | Dict (Flows 1 & 2) or array with `id` field per node (Flows 3 & 4) |

The engine and validator handle both `nodes` formats natively — no conversion needed.

### 2.2 Node Types

#### QUESTION Node
```json
"node_id": {
  "type": "QUESTION",
  "text": "Question text shown to user.",
  "answers": {
    "yes": "next_node_id",
    "no": "terminal_node_id",
    "not_sure": "fallback_node_id"
  }
}
```
- `answers` is a plain object mapping any string keys to node IDs
- Any number of answer keys is valid (yes/no, yes/no/not_sure, or semantic keys)
- Every value must reference an existing node ID

#### SAFETY Node
```json
"node_id": {
  "type": "SAFETY",
  "text": "Safety warning shown to user.",
  "next": "next_node_id"
}
```
- Uses `"next"` — **not** `"nextNode"` (validator will reject `"nextNode"` explicitly)
- User taps Continue; no branching

#### MEASURE Node
```json
"node_id": {
  "type": "MEASURE",
  "text": "Enter the battery voltage in volts.",
  "unit": "volts",
  "validRange": { "min": 10.0, "max": 15.0 },
  "branches": [
    { "condition": "< 11.8",  "next": "charging_response_check" },
    { "condition": ">= 11.8", "next": "battery_connection_observation" }
  ]
}
```
- `validRange` enforces input bounds — values outside are rejected before branch evaluation
- `branches` evaluated in order; first matching condition wins
- Supported operators: `<`, `<=`, `>`, `>=`, `==`, `!=`
- Branches should be exhaustive — if no branch matches, the engine throws

#### TERMINAL Node
```json
"node_id": {
  "type": "TERMINAL",
  "result": "Short human-readable result string",
  "artifact": { ... }
}
```
- Requires an `artifact` object (see Section 3)
- No routing fields — terminal nodes end the session

---

## 3. Artifact Contract

Every TERMINAL node must produce an artifact. The engine also synthesises a partial artifact on STOP.

### 3.1 Universal Required Fields (all flows, all terminals)

| Field | Type | Description |
|---|---|---|
| `flow_id` | string | Must match the flow's `flowId` |
| `flow_version` | string | Must match the flow's `flowVersion` |
| `issue` | string | The flow title (e.g. "No Power Inside RV") |
| `stop_reason` | string | Why this terminal was reached |
| `last_confirmed_state` | string | Last known system state before terminal |
| `safety_notes` | string | Safety observations (empty string if none) |

### 3.2 Optional Common Fields (validated for type when present)

| Field | Type | Description |
|---|---|---|
| `stabilization_actions` | string[] | Actions user can take safely right now |
| `recommendations` | string[] | Technician guidance |
| `notes` | string | Free-form notes |

These fields are **optional** — not all flows include them. The validator checks their type only when present.

### 3.3 Flow-Specific Fields

Each flow defines its own diagnostic context fields:

| Flow | Flow-Specific Fields |
|---|---|
| Flow 1 — No Power | `power_source_context`, `voltage_known`, `voltage_value`, `charging_response`, `disconnect_status`, `battery_connection_observation`, `fuse_panel_status` |
| Flow 2 — Water System | `water_path`, `symptom_scope`, `pump_switch_status`, `pump_sound`, `tank_level_known`, `tank_level_status`, `city_spigot_pressure`, `hose_condition`, `water_mode_setting`, `regulator_or_filter_present` |
| Flow 3 — Propane | `propane_hazard_observed`, `propane_level_known`, `propane_level_status`, `tank_valve_position`, `affected_appliances_scope`, `appliance_selected`, `appliance_behavior_observed` |
| Flow 4 — Slides & Leveling | `system_type`, `primary_symptom`, `response_observed`, `interlock_present` |

Flow-specific fields are not validated for presence — only universal fields are enforced.

### 3.4 Template Variables

Flow uses template variables to carry session values into artifact fields:
```
"{{power_source_context.value}}"    → resolved from node answer at runtime
"{{measure_battery_voltage.value}}" → resolved from MEASURE input
```
The engine resolves these during STOP artifact generation. For completed sessions, terminal artifacts already have the correct values baked in.

---

## 4. STOP Behavior

STOP must be available from **any node** at any time and must always produce a valid artifact.

### 4.1 Triggering STOP

```typescript
const stoppedState = engine.stopSession(sessionState);
// stoppedState.stopped === true
// stoppedState.partial_artifact contains the synthesised artifact
```

### 4.2 What STOP produces

A `SessionSummary` with `stopped: true` and a partial artifact where:
- Universal required fields are always populated
- `stop_reason` = `"User stopped diagnostic at node: <node_id>"`
- `last_confirmed_state` = last answered node + value + current node
- Flow-specific fields already collected = their actual values
- Flow-specific fields not yet reached = `"Unknown"`
- Optional array fields not yet collected = `[]`

### 4.3 STOP artifact example

```json
{
  "flow_id": "flow_1_no_power_inside_rv",
  "flow_version": "2.0",
  "issue": "No Power Inside RV",
  "stop_reason": "User stopped diagnostic at node: battery_connection_observation",
  "last_confirmed_state": "Last answered: voltage_access_check = yes. Stopped at: battery_connection_observation.",
  "safety_notes": "",
  "power_source_context": "shore_power",
  "voltage_known": "yes",
  "voltage_value": "12.1",
  "charging_response": "Unknown",
  "disconnect_status": "Unknown",
  "battery_connection_observation": "Unknown",
  "fuse_panel_status": "Unknown"
}
```

---

## 5. Engine API

### Construction
```typescript
// Pass raw flow JSON directly — validator runs on construction
const engine = new FlowEngine(rawFlowJson);
```

### Session Management
```typescript
const session = engine.startSession();       // start new session
const session = engine.resumeSession();      // resume after app kill (null if none)
engine.clearSession();                       // clear current session
```

### Navigation
```typescript
const node = engine.getCurrentNode(session);

// QUESTION: pass the answer key string
const next = engine.processResponse(session, "yes");
const next = engine.processResponse(session, "not_sure");
const next = engine.processResponse(session, "shore_power");

// SAFETY: pass true (user tapped Continue)
const next = engine.processResponse(session, true);

// MEASURE: pass numeric value
const next = engine.processResponse(session, 12.4);
```

### STOP
```typescript
const stoppedState = engine.stopSession(session);
```

### History
```typescript
const history = FlowEngine.getHistory(); // all completed + stopped sessions
```

---

## 6. SessionState Shape

```typescript
interface SessionState {
  flow_id: string;
  flow_version: string;
  session_id: string;
  started_at: string;           // ISO timestamp
  current_node_id: string;
  events: SessionEvent[];
  completed: boolean;
  stopped: boolean;

  // Set on normal completion
  completed_at?: string;
  terminal_node_id?: string;
  result?: string;
  artifact?: FlowArtifact;

  // Set on STOP
  stopped_at?: string;
  stop_node_id?: string;
  partial_artifact?: FlowArtifact;
}

interface SessionEvent {
  node_id: string;
  type: 'QUESTION' | 'SAFETY' | 'MEASURE' | 'TERMINAL';
  value: string | number | boolean;
  timestamp: string;            // ISO timestamp
}
```

---

## 7. Validation Rules Summary

| Rule | Detail |
|---|---|
| `flowId`, `flowVersion`, `startNode` present | Must be non-empty strings |
| `nodes` is dict or array | Array nodes must each have an `"id"` field |
| `startNode` references existing node | Validated against resolved node dict |
| All node types are valid | Only QUESTION / SAFETY / MEASURE / TERMINAL allowed |
| QUESTION `answers` non-empty object | All values must reference existing nodes |
| SAFETY uses `"next"` for next node | Validator throws with explicit message if wrong |
| MEASURE `validRange.min < max` | Both must be numbers |
| MEASURE `branches` non-empty array | All conditions parseable, all `next` exist |
| All nodes reachable from `startNode` | Full graph traversal, unreachable nodes throw |
| At least one TERMINAL node | Flow must have an exit point |
| TERMINAL has `result` string | Required |
| TERMINAL has `artifact` object | Required with 6 universal fields as strings |
| Optional artifact fields correct type | When present: arrays must be string[], notes must be string |

---

## 8. Safe Implementation Rules

### DO
- Pass raw flow JSON directly to `new FlowEngine(rawJson)`
- Call `engine.stopSession()` whenever the user taps Stop/Exit
- Render `Object.keys(node.answers)` as buttons for QUESTION nodes
- Pass the selected key string to `processResponse(session, answerKey)`
- Check `sessionState.completed` and `sessionState.stopped` to show summary

### DO NOT
- Modify flow JSON files after they are marked CANONICAL
- Add diagnostic logic, question text, or routing to the engine
- Hard-code `"yes"` / `"no"` as the only valid answer values
- Skip calling `stopSession()` when user exits — always capture state

### Safe Modification Boundary

```
IMMUTABLE (do not touch):           SAFE TO MODIFY:
─────────────────────────────────   ─────────────────────────────────
FlowEngine.ts                       Flow JSON files (content only)
FlowValidator.ts                    StorageService.ts (storage keys)
types.ts                            UI components (rendering only)
StorageService.ts (interface)       FlowSelector (flow list)
```

---

## 9. Adding a New Flow

1. Author the flow following the canonical writing pack process
2. Ensure all terminal nodes include the full artifact contract (Section 3.1)
3. Use `"next"` on all SAFETY nodes
4. Pass the raw JSON to `new FlowEngine(rawJson)` — validation will catch any issues
5. Register the flow in the `FlowSelector` component

**No engine or validator changes are required to add a new flow.**