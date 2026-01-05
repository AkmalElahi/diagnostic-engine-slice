export type NodeType = 'QUESTION' | 'SAFETY' | 'MEASURE' | 'TERMINAL';

export interface QuestionNode {
  type: 'QUESTION';
  text: string;
  yes: string;
  no: string;
}

export interface SafetyNode {
  type: 'SAFETY';
  text: string;
  next: string;
}

export interface MeasureNode {
  type: 'MEASURE';
  text: string;
  min: number;
  max: number;
  branches: {
    below: string;
    within: string;
  };
}

export interface TerminalNode {
  type: 'TERMINAL';
  result: string;
}

export type FlowNode = QuestionNode | SafetyNode | MeasureNode | TerminalNode;

export interface FlowDefinition {
  flow_id: string;
  flow_version: string;
  start_node: string;
  nodes: {
    [key: string]: FlowNode;
  };
}

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
  completed_at?: string;
  terminal_node_id?: string;
  result?: string;
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
}
