// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawFlow {
  flowId: string;
  flowVersion: string;
  startNode: string;
  title?: string;
  nodes: Record<string, RawFlowNode>;  // MUST be object, array format is rejected
}

export interface RawFlowNode {
  type: string;
  [key: string]: unknown;
}

export interface QuestionNode extends RawFlowNode {
  type: 'QUESTION';
  text: string;
  answers: Record<string, string>;
}

export interface SafetyNode extends RawFlowNode {
  type: 'SAFETY';
  text: string;
  next: string;
}

export interface MeasureBranch {
  condition: string; // e.g. "< 11.8" or ">= 11.8"
  next: string;
}

export interface MeasureNode extends RawFlowNode {
  type: 'MEASURE';
  text: string;
  unit?: string;
  validRange: { min: number; max: number };
  branches: MeasureBranch[];
}

export interface FlowArtifact {
  // Universal required fields
  flow_id: string;
  flow_version: string;
  issue: string;
  stop_reason: string;
  last_confirmed_state: string;
  safety_notes: string[];
  // Optional common fields
  stabilization_actions?: string[];
  recommendations?: string[];
  notes?: string;
  // Flow-specific fields
  [key: string]: unknown;
}

export interface TerminalNode extends RawFlowNode {
  type: 'TERMINAL';
  result: string;
  artifact: FlowArtifact;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class FlowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowValidationError';
  }
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

/**
 * Supported operators: <  <=  >  >=  ==  !=
 * Example: evaluateCondition("< 11.8", 11.2) → true
 */
export function evaluateCondition(condition: string, value: number): boolean {
  const match = condition.trim().match(/^([<>!=]=?)\s*([\d.]+)$/);
  if (!match) {
    throw new FlowValidationError(
      `Invalid condition expression: "${condition}". ` +
      `Supported operators: <, <=, >, >=, ==, !=`
    );
  }
  const operator = match[1];
  const threshold = parseFloat(match[2]);
  switch (operator) {
    case '<':  return value <  threshold;
    case '<=': return value <= threshold;
    case '>':  return value >  threshold;
    case '>=': return value >= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default:
      throw new FlowValidationError(`Unknown operator: "${operator}"`);
  }
}

/**
 * Evaluates branches in order and returns the first matching node ID.
 * Returns null if no branch matches.
 */
export function resolveMeasureBranch(
  branches: MeasureBranch[],
  value: number
): string | null {
  for (const branch of branches) {
    if (evaluateCondition(branch.condition, value)) {
      return branch.next;
    }
  }
  return null;
}

// ─── Validator ────────────────────────────────────────────────────────────────

export class FlowValidator {

  static validate(raw: RawFlow): void {
    this.validateTopLevel(raw);
    this.validateNodes(raw.nodes);
    this.validateReachability(raw.startNode, raw.nodes);
    this.validateHasTerminal(raw.nodes);
  }

  // ── Top-level ──────────────────────────────────────────────────────────────

  private static validateTopLevel(raw: RawFlow): void {
    if (!raw.flowId || typeof raw.flowId !== 'string') {
      throw new FlowValidationError('Flow must have a string "flowId"');
    }
    if (!raw.flowVersion || typeof raw.flowVersion !== 'string') {
      throw new FlowValidationError('Flow must have a string "flowVersion"');
    }
    if (!raw.startNode || typeof raw.startNode !== 'string') {
      throw new FlowValidationError('Flow must have a string "startNode"');
    }
    if (!raw.nodes) {
      throw new FlowValidationError('Flow must have a "nodes" field');
    }
    
    // CRITICAL: Enforce dict format only, reject arrays
    if (Array.isArray(raw.nodes)) {
      throw new FlowValidationError(
        'Flow "nodes" must be an object (dictionary) keyed by node ID. ' +
        'Array format is not allowed. Convert to: { "node_id": { "type": "...", ... }, ... }'
      );
    }
    
    if (typeof raw.nodes !== 'object') {
      throw new FlowValidationError('Flow "nodes" must be an object');
    }
    
    if (Object.keys(raw.nodes).length === 0) {
      throw new FlowValidationError('"nodes" must not be empty');
    }
    if (!raw.nodes[raw.startNode]) {
      throw new FlowValidationError(
        `"startNode" value "${raw.startNode}" does not exist in nodes`
      );
    }
  }

  // ── Per-node dispatch ──────────────────────────────────────────────────────

  private static validateNodes(nodes: Record<string, RawFlowNode>): void {
    const allNodeIds = Object.keys(nodes);
    for (const [nodeId, node] of Object.entries(nodes)) {
      this.validateNode(nodeId, node, allNodeIds);
    }
  }

  private static validateNode(
    nodeId: string,
    node: RawFlowNode,
    allNodeIds: string[]
  ): void {
    if (!node.type) {
      throw new FlowValidationError(`Node "${nodeId}" is missing "type"`);
    }
    const allowed = ['QUESTION', 'SAFETY', 'MEASURE', 'TERMINAL'];
    if (!allowed.includes(node.type)) {
      throw new FlowValidationError(
        `Node "${nodeId}" has unknown type "${node.type}". Allowed: ${allowed.join(', ')}`
      );
    }
    switch (node.type) {
      case 'QUESTION': return this.validateQuestionNode(nodeId, node as QuestionNode, allNodeIds);
      case 'SAFETY':   return this.validateSafetyNode(nodeId, node as SafetyNode, allNodeIds);
      case 'MEASURE':  return this.validateMeasureNode(nodeId, node as MeasureNode, allNodeIds);
      case 'TERMINAL': return this.validateTerminalNode(nodeId, node as TerminalNode);
    }
  }

  // ── QUESTION ───────────────────────────────────────────────────────────────

  private static validateQuestionNode(
    nodeId: string,
    node: QuestionNode,
    allNodeIds: string[]
  ): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`QUESTION node "${nodeId}" must have a string "text"`);
    }
    if (!node.answers || typeof node.answers !== 'object' || Array.isArray(node.answers)) {
      throw new FlowValidationError(
        `QUESTION node "${nodeId}" must have an "answers" object mapping answer keys to node IDs`
      );
    }
    if (Object.keys(node.answers).length === 0) {
      throw new FlowValidationError(`QUESTION node "${nodeId}" "answers" must not be empty`);
    }
    for (const [answerKey, nextNodeId] of Object.entries(node.answers)) {
      if (!nextNodeId || typeof nextNodeId !== 'string') {
        throw new FlowValidationError(
          `QUESTION node "${nodeId}" answer "${answerKey}" must map to a non-empty string node ID`
        );
      }
      if (!allNodeIds.includes(nextNodeId)) {
        throw new FlowValidationError(
          `QUESTION node "${nodeId}" answer "${answerKey}" references non-existent node "${nextNodeId}"`
        );
      }
    }
  }

  // ── SAFETY ─────────────────────────────────────────────────────────────────

  private static validateSafetyNode(
    nodeId: string,
    node: SafetyNode,
    allNodeIds: string[]
  ): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`SAFETY node "${nodeId}" must have a string "text"`);
    }
    if (!node.next || typeof node.next !== 'string') {
      throw new FlowValidationError(
        `SAFETY node "${nodeId}" must have a string "next" field. ` +
        `Note: use "next", not "nextNode"`
      );
    }
    if (!allNodeIds.includes(node.next)) {
      throw new FlowValidationError(
        `SAFETY node "${nodeId}" "next" references non-existent node "${node.next}"`
      );
    }
  }

  // ── MEASURE ────────────────────────────────────────────────────────────────

  private static validateMeasureNode(
    nodeId: string,
    node: MeasureNode,
    allNodeIds: string[]
  ): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have a string "text"`);
    }
    if (!node.validRange || typeof node.validRange !== 'object') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have a "validRange" object`);
    }
    if (typeof node.validRange.min !== 'number') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" "validRange.min" must be a number`);
    }
    if (typeof node.validRange.max !== 'number') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" "validRange.max" must be a number`);
    }
    if (node.validRange.min >= node.validRange.max) {
      throw new FlowValidationError(
        `MEASURE node "${nodeId}" "validRange.min" (${node.validRange.min}) ` +
        `must be less than "validRange.max" (${node.validRange.max})`
      );
    }
    if (!Array.isArray(node.branches) || node.branches.length === 0) {
      throw new FlowValidationError(
        `MEASURE node "${nodeId}" "branches" must be a non-empty array of {condition, next} objects`
      );
    }
    for (let i = 0; i < node.branches.length; i++) {
      const branch = node.branches[i];
      if (!branch.condition || typeof branch.condition !== 'string') {
        throw new FlowValidationError(
          `MEASURE node "${nodeId}" branch[${i}] must have a string "condition"`
        );
      }
      if (!branch.next || typeof branch.next !== 'string') {
        throw new FlowValidationError(
          `MEASURE node "${nodeId}" branch[${i}] must have a string "next"`
        );
      }
      if (!allNodeIds.includes(branch.next)) {
        throw new FlowValidationError(
          `MEASURE node "${nodeId}" branch[${i}] "next" references non-existent node "${branch.next}"`
        );
      }
      try {
        evaluateCondition(branch.condition, 0);
      } catch {
        throw new FlowValidationError(
          `MEASURE node "${nodeId}" branch[${i}] has invalid condition: "${branch.condition}"`
        );
      }
    }
  }

  // ── TERMINAL ───────────────────────────────────────────────────────────────

  private static validateTerminalNode(nodeId: string, node: TerminalNode): void {
    if (!node.result || typeof node.result !== 'string') {
      throw new FlowValidationError(`TERMINAL node "${nodeId}" must have a string "result"`);
    }
    if (!node.artifact || typeof node.artifact !== 'object' || Array.isArray(node.artifact)) {
      throw new FlowValidationError(`TERMINAL node "${nodeId}" must have an "artifact" object`);
    }
    this.validateArtifact(nodeId, node.artifact);
  }

  private static validateArtifact(nodeId: string, artifact: FlowArtifact): void {
    const required: (keyof FlowArtifact)[] = [
      'flow_id', 'flow_version', 'issue', 'stop_reason', 'last_confirmed_state', 'safety_notes',
    ];
    for (const field of required) {
      if (artifact[field] === undefined || artifact[field] === null) {
        throw new FlowValidationError(
          `TERMINAL node "${nodeId}" artifact missing required field "${field}"`
        );
      }
      if (typeof artifact[field] !== 'string') {
        throw new FlowValidationError(
          `TERMINAL node "${nodeId}" artifact field "${field}" must be a string`
        );
      }
    }
    if (artifact.stabilization_actions !== undefined) {
      if (!Array.isArray(artifact.stabilization_actions)) {
        throw new FlowValidationError(
          `TERMINAL node "${nodeId}" artifact "stabilization_actions" must be an array when present`
        );
      }
      for (const item of artifact.stabilization_actions) {
        if (typeof item !== 'string') {
          throw new FlowValidationError(
            `TERMINAL node "${nodeId}" artifact "stabilization_actions" must contain only strings`
          );
        }
      }
    }
    if (artifact.recommendations !== undefined) {
      if (!Array.isArray(artifact.recommendations)) {
        throw new FlowValidationError(
          `TERMINAL node "${nodeId}" artifact "recommendations" must be an array when present`
        );
      }
      for (const item of artifact.recommendations) {
        if (typeof item !== 'string') {
          throw new FlowValidationError(
            `TERMINAL node "${nodeId}" artifact "recommendations" must contain only strings`
          );
        }
      }
    }
    if (artifact.notes !== undefined && typeof artifact.notes !== 'string') {
      throw new FlowValidationError(
        `TERMINAL node "${nodeId}" artifact "notes" must be a string when present`
      );
    }
  }

  // ── Reachability ───────────────────────────────────────────────────────────

  private static validateReachability(
    startNode: string,
    nodes: Record<string, RawFlowNode>
  ): void {
    const visited = new Set<string>();
    const queue = [startNode];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = nodes[nodeId];
      if (!node) continue;
      switch (node.type) {
        case 'QUESTION':
          queue.push(...Object.values((node as QuestionNode).answers));
          break;
        case 'SAFETY':
          queue.push((node as SafetyNode).next);
          break;
        case 'MEASURE':
          queue.push(...(node as MeasureNode).branches.map(b => b.next));
          break;
      }
    }
    const unreachable = Object.keys(nodes).filter(id => !visited.has(id));
    if (unreachable.length > 0) {
      throw new FlowValidationError(
        `Unreachable nodes detected: ${unreachable.join(', ')}`
      );
    }
  }

  // ── At least one terminal ──────────────────────────────────────────────────

  private static validateHasTerminal(nodes: Record<string, RawFlowNode>): void {
    if (!Object.values(nodes).some(n => n.type === 'TERMINAL')) {
      throw new FlowValidationError('Flow must have at least one TERMINAL node');
    }
  }
}
