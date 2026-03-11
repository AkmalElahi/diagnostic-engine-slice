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
  vertical_id?: string;
  issue: string;
  stop_reason: string;
  last_confirmed_state: string;
  safety_notes: string[];
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
  artifact_id: string;
  stop_reason:string;
  executed_nodes: ExecutedNode[];
  last_confirmed_state:string;
  answers: Record<string, any>;
  measurements: Record<string, number | null>;

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

export interface CanonicalSerializationResult {
  canonical_json: string;
  sha256_hash: string;
  artifact_hash?: string;
}
export interface DeterminismValidationResult {
  is_valid: boolean;
  stored_hash: string;
  exported_hash: string;
  error_message?: string;
}
export interface SerializationOptions {
  field_order: string[];
  compute_artifact_hash?: boolean;
}
export class SerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializationError';
  }
}

export class DeterminismError extends Error {
  constructor(
    message: string,
    public stored_hash: string,
    public exported_hash: string
  ) {
    super(message);
    this.name = 'DeterminismError';
  }
}

export interface ArtifactSessionState { 
  artifact_id: string;                   
  flow_id: string;                       
  flow_version: string;                  
  executed_nodes: ExecutedNode[];        
  answers: Record<string, any>;
  measurements: Record<string, number | null>;
  stop_reason: string;                   
  last_confirmed_state: string;          
}

export interface ExecutedNode {
  node_id: string;
  node_type: string;
  executed_at: string;
  value?: any;
}
export interface TerminalArtifactTemplate {
  vertical_id?: string;
  issue: string;
  [key: string]: any;
  safety_notes: string[];
  stabilization_actions?: string[];
  recommendations?: string[];
  notes?: string;
}
export interface FieldMapping {
  artifact_field: string;           
  source_node_id: string;
  field_type: 'string' | 'number' | 'enum' | 'array';
}
export interface FinalizationResult {
  final_artifact: Record<string, any>;   
  canonical_json: string;                
  sha256_hash: string;                   
  warnings: string[];
}

export interface ArtifactFinalizationResult {
  finalization_result: FinalizationResult;
  artifact_id: string;
  flow_id: string;
  flow_version: string;
  session_id: string;
  finalized_at: string;
}

export class FinalizationError extends Error {
  constructor(
    message: string,
    public validation_errors: string[]
  ) {
    super(message);
    this.name = 'FinalizationError';
  }
}

/**
 * Enum validation error with details
 */
export class EnumValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: string,
    public allowed_values: string[]
  ) {
    super(message);
    this.name = 'EnumValidationError';
  }
}

/**
 * Enum validation result
 */
export interface EnumValidationResult {
  is_valid: boolean;
  normalized_value?: string;
  error_message?: string;
  allowed_values?: string[];
}

export const DEFAULT_STRINGS = {
  STABILIZATION_ACTION: 'Avoid further operation until evaluated by a technician.',
  RECOMMENDATION: 'Schedule a technician and share this artifact so they can triage the issue quickly.',
} as const;

export const REQUIRED_BASE_FIELDS = [
  'artifact_id',
  'artifact_hash',
  'vertical_id',
  'issue',
  'flow_id',
  'flow_version',
  'artifact_schema_version',
  'stop_reason',
  'last_confirmed_state',
] as const;


export const REQUIRED_SUFFIX_FIELDS = [
  'safety_notes',
  'stabilization_actions',
  'recommendations',
  'notes',
] as const;