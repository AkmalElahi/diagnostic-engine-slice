// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeType = 'QUESTION' | 'SAFETY' | 'MEASURE' | 'TERMINAL';

export interface QuestionNode {
  type: 'QUESTION';
  text: string;
  answers: Record<string, string>; // arbitrary answer key → next node id
}

export interface SafetyNode {
  type: 'SAFETY';
  text: string;
  next: string;
}

export interface MeasureBranch {
  condition: string; // e.g. "< 11.8", ">= 11.8"
  next: string;
}

export interface MeasureNode {
  type: 'MEASURE';
  text: string;
  unit?: string;
  validRange: {
    min: number;
    max: number;
  };
  branches: MeasureBranch[];
}

export interface FlowArtifact {
  // Universal required fields (all flows, all terminals)
  flow_id: string;
  flow_version: string;
  issue: string;
  stop_reason: string;
  last_confirmed_state: string;
  safety_notes: string;
  // Optional common fields (validated for type when present)
  stabilization_actions?: string[];
  recommendations?: string[];
  notes?: string;
  // Flow-specific fields
  [key: string]: unknown;
}

export interface TerminalNode {
  type: 'TERMINAL';
  result: string;
  artifact: FlowArtifact;
}

export type FlowNode = QuestionNode | SafetyNode | MeasureNode | TerminalNode;

// ─── Flow Definition ──────────────────────────────────────────────────────────

export interface FlowDefinition {
  flowId: string;
  flowVersion: string;
  startNode: string;
  title?: string;
  nodes: Record<string, FlowNode> | FlowNode[]; // dict (F1/F2) or array (F3/F4)
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionEvent {
  node_id: string;
  type: NodeType;
  value: string | number | boolean;
  timestamp: string;
}

export interface SessionState {
  flow_id: string;
  flow_version: string;
  session_id: string;
  started_at: string;
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

export interface SessionSummary {
  flow_id: string;
  flow_version: string;
  session_id: string;
  started_at: string;
  completed_at: string;
  events: SessionEvent[];
  terminal_node_id: string;
  result: string;
  artifact?: FlowArtifact;  // present on both completion and stop
  stopped: boolean;
}
