import { FlowChecksumValidator, ChecksumVerificationError } from './Flowchecksumvalidator';
import { EnumValidator } from './EnumValidators';


export interface RawFlow {
  flowId: string;
  flowVersion: string;
  startNode: string;
  title?: string;
  nodes: Record<string, RawFlowNode>;
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
  condition: string;
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
  vertical_id: string;
  flow_id: string;
  flow_version: string;
  artifact_schema_version: string;
  issue: string;
  stop_reason: string;
  last_confirmed_state: string;
  safety_notes: string[];
  stabilization_actions?: string[];
  recommendations?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface TerminalNode extends RawFlowNode {
  type: 'TERMINAL';
  result: string;
  artifact: FlowArtifact;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class FlowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowValidationError';
  }
}

export class EnumValidationError extends FlowValidationError {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly allowedValues: string[]
  ) {
    super(
      `Invalid enum value for field "${field}": "${value}". ` +
      `Allowed values: ${allowedValues.join(', ')}`
    );
    this.name = 'EnumValidationError';
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ChecksumVerificationError };

// ─── Condition evaluator ──────────────────────────────────────────────────────

export function evaluateCondition(condition: string, value: number): boolean {
  const match = condition.trim().match(/^([<>!=]=?)\s*([\d.]+)$/);
  if (!match) {
    throw new Error(`Invalid condition syntax: "${condition}"`);
  }
  const op = match[1];
  const threshold = parseFloat(match[2]);
  switch (op) {
    case '<':  return value < threshold;
    case '<=': return value <= threshold;
    case '>':  return value > threshold;
    case '>=': return value >= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default:   throw new Error(`Unsupported operator: "${op}"`);
  }
}

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

export class FlowValidator {
  // Track registered flow IDs for uniqueness validation
  private static registeredFlowIds = new Set<string>();
  static async validate(raw: RawFlow, expectedChecksum?: string): Promise<void> {
    // Step 1: Checksum verification (if provided)
    if (expectedChecksum) {
      const flowJsonString = JSON.stringify(raw);
      await FlowChecksumValidator.verifyChecksumOrThrow(
        flowJsonString,
        expectedChecksum,
        raw.flowId,
        raw.flowVersion
      );
    }

    // Step 2: Schema validation
    this.validateTopLevel(raw);
    this.validateFlowIdUniqueness(raw.flowId);
    this.validateNodes(raw.nodes);
    this.validateReachability(raw.startNode, raw.nodes);
    this.validateHasTerminal(raw.nodes);

    // Step 3: Enum validation for terminal nodes
    this.validateTerminalEnums(raw.nodes);

    // Register flow ID as validated
    this.registeredFlowIds.add(raw.flowId);
  }

  /**
   * Validate flow without checksum verification (for backward compatibility)
   * 
   * @param raw - Flow definition object
   */
  static validateSync(raw: RawFlow): void {
    this.validateTopLevel(raw);
    this.validateFlowIdUniqueness(raw.flowId);
    this.validateNodes(raw.nodes);
    this.validateReachability(raw.startNode, raw.nodes);
    this.validateHasTerminal(raw.nodes);
    this.validateTerminalEnums(raw.nodes);
    this.registeredFlowIds.add(raw.flowId);
  }

  /**
   * Clear registered flow IDs (for testing)
   */
  static clearRegistry(): void {
    this.registeredFlowIds.clear();
  }

  // ── Flow ID uniqueness ─────────────────────────────────────────────────────

  private static validateFlowIdUniqueness(flowId: string): void {
    if (this.registeredFlowIds.has(flowId)) {
      throw new FlowValidationError(
        `Duplicate flow ID detected: "${flowId}". ` +
        `Each flow must have a unique flowId.`
      );
    }
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
        `MEASURE node "${nodeId}" "branches" must be a non-empty array`
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
    }
  }

  // ── TERMINAL ───────────────────────────────────────────────────────────────

  private static validateTerminalNode(nodeId: string, node: TerminalNode): void {
    if (!node.result || typeof node.result !== 'string') {
      throw new FlowValidationError(`TERMINAL node "${nodeId}" must have a string "result"`);
    }
    if (!node.artifact || typeof node.artifact !== 'object') {
      throw new FlowValidationError(`TERMINAL node "${nodeId}" must have an "artifact" object`);
    }

    const artifact = node.artifact;

    // Validate required base fields
    const requiredStringFields = [
      'issue',
      'flow_id',
      'flow_version',
      'artifact_schema_version',
      'stop_reason',
      'last_confirmed_state',
    ];

    for (const field of requiredStringFields) {
      if (!(field in artifact)) {
        throw new FlowValidationError(
          `TERMINAL node "${nodeId}" artifact missing required field "${field}"`
        );
      }
    }

    // Validate safety_notes array
    if (!Array.isArray(artifact.safety_notes)) {
      throw new FlowValidationError(
        `TERMINAL node "${nodeId}" artifact "safety_notes" must be an array`
      );
    }
  }

  // ── MS 5.7: Enum validation ────────────────────────────────────────────────

  /**
   * Validate enum fields in terminal artifacts using EnumValidator
   */
  private static validateTerminalEnums(nodes: Record<string, RawFlowNode>): void {
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (node.type === 'TERMINAL') {
        const terminalNode = node as TerminalNode;
        const artifact = terminalNode.artifact;

        // Validate vertical_id if present
        if ('vertical_id' in artifact && artifact.vertical_id) {
          const result = EnumValidator.validate('vertical_id', artifact.vertical_id);
          if (!result.is_valid) {
            const allowedValues = EnumValidator.getAllowedValues('vertical_id') || [];
            throw new EnumValidationError(
              'vertical_id',
              artifact.vertical_id,
              allowedValues
            );
          }
        }
        // Additional enum fields can be validated here as needed
      }
    }
  }

  // ── Reachability ───────────────────────────────────────────────────────────

  private static validateReachability(
    startNode: string,
    nodes: Record<string, RawFlowNode>
  ): void {
    const visited = new Set<string>();
    const queue: string[] = [startNode];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = nodes[current];
      const nextNodes = this.getNextNodes(node);
      for (const next of nextNodes) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    const allNodeIds = Object.keys(nodes);
    const unreachable = allNodeIds.filter(id => !visited.has(id));
    
    if (unreachable.length > 0) {
      throw new FlowValidationError(
        `Unreachable nodes detected: ${unreachable.join(', ')}. ` +
        `All nodes must be reachable from startNode "${startNode}"`
      );
    }
  }

  private static getNextNodes(node: RawFlowNode): string[] {
    switch (node.type) {
      case 'QUESTION': {
        const q = node as QuestionNode;
        return Object.values(q.answers);
      }
      case 'SAFETY': {
        const s = node as SafetyNode;
        return [s.next];
      }
      case 'MEASURE': {
        const m = node as MeasureNode;
        return m.branches.map(b => b.next);
      }
      case 'TERMINAL': {
        return [];
      }
      default: {
        return [];
      }
    }
  }

  // ── Has terminal ───────────────────────────────────────────────────────────

  private static validateHasTerminal(nodes: Record<string, RawFlowNode>): void {
    const hasTerminal = Object.values(nodes).some(node => node.type === 'TERMINAL');
    if (!hasTerminal) {
      throw new FlowValidationError('Flow must have at least one TERMINAL node');
    }
  }
}
