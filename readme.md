# RV Diagnostic Engine

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

## How It Works

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

### State
- ✅ Single session state object
- ✅ Local persistence (MMKV)
- ✅ Atomic writes

### Resume Test
- ✅ Kill app mid-flow
- ✅ Resume exact node

### Summary
- ✅ Matches schema
- ✅ Correct ordering
