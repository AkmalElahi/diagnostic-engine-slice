import { FlowDefinition, FlowNode, MeasureNode, QuestionNode, SafetyNode, TerminalNode } from '../types';

export class FlowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowValidationError';
  }
}

export class FlowValidator {
  static validate(flow: FlowDefinition): asserts flow is FlowDefinition {
    this.validateNodes(flow);
    this.validateReachability(flow);
    this.validateTerminalNodes(flow);
  }


  private static validateNodes(flow: FlowDefinition): void {
    const nodeIds = Object.keys(flow.nodes);

    if (!flow.nodes[flow.start_node]) {
      throw new FlowValidationError(`start_node "${flow.start_node}" does not exist in nodes`);
    }

    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      this.validateNode(nodeId, node as FlowNode, nodeIds);
    }
  }

 
  private static validateNode(nodeId: string, node: FlowNode, allNodeIds: string[]): void {
    switch (node.type) {
      case 'QUESTION':
        this.validateQuestionNode(nodeId, node, allNodeIds);
        break;
      case 'SAFETY':
        this.validateSafetyNode(nodeId, node, allNodeIds);
        break;
      case 'MEASURE':
        this.validateMeasureNode(nodeId, node, allNodeIds);
        break;
      case 'TERMINAL':
        this.validateTerminalNode(nodeId, node);
        break;
    }
  }

  private static validateQuestionNode(nodeId: string, node: QuestionNode, allNodeIds: string[]): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`QUESTION node "${nodeId}" must have text`);
    }

    if (!node.yes || typeof node.yes !== 'string') {
      throw new FlowValidationError(`QUESTION node "${nodeId}" must have yes branch`);
    }

    if (!node.no || typeof node.no !== 'string') {
      throw new FlowValidationError(`QUESTION node "${nodeId}" must have no branch`);
    }

    if (!allNodeIds.includes(node.yes)) {
      throw new FlowValidationError(`QUESTION node "${nodeId}" yes branch "${node.yes}" does not exist`);
    }

    if (!allNodeIds.includes(node.no)) {
      throw new FlowValidationError(`QUESTION node "${nodeId}" no branch "${node.no}" does not exist`);
    }
  }

  private static validateSafetyNode(nodeId: string, node: SafetyNode, allNodeIds: string[]): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`SAFETY node "${nodeId}" must have text`);
    }

    if (!node.next || typeof node.next !== 'string') {
      throw new FlowValidationError(`SAFETY node "${nodeId}" must have next`);
    }

    if (!allNodeIds.includes(node.next)) {
      throw new FlowValidationError(`SAFETY node "${nodeId}" next "${node.next}" does not exist`);
    }
  }

  private static validateMeasureNode(nodeId: string, node: MeasureNode, allNodeIds: string[]): void {
    if (!node.text || typeof node.text !== 'string') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have text`);
    }

    if (typeof node.min !== 'number') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have numeric min`);
    }

    if (typeof node.max !== 'number') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have numeric max`);
    }

    if (node.min >= node.max) {
      throw new FlowValidationError(`MEASURE node "${nodeId}" min must be less than max`);
    }

    if (!node.branches || typeof node.branches !== 'object') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have branches`);
    }

    if (!node.branches.below || typeof node.branches.below !== 'string') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have branches.below`);
    }

    if (!node.branches.within || typeof node.branches.within !== 'string') {
      throw new FlowValidationError(`MEASURE node "${nodeId}" must have branches.within`);
    }

    if (!allNodeIds.includes(node.branches.below)) {
      throw new FlowValidationError(`MEASURE node "${nodeId}" branches.below "${node.branches.below}" does not exist`);
    }

    if (!allNodeIds.includes(node.branches.within)) {
      throw new FlowValidationError(`MEASURE node "${nodeId}" branches.within "${node.branches.within}" does not exist`);
    }
  }

  private static validateTerminalNode(nodeId: string, node: TerminalNode): void {
    if (!node.result || typeof node.result !== 'string') {
      throw new FlowValidationError(`TERMINAL node "${nodeId}" must have result text`);
    }
  }

  private static validateReachability(flow: FlowDefinition): void {
    const visited = new Set<string>();
    const queue = [flow.start_node];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      const node = flow.nodes[nodeId];

      switch (node.type) {
        case 'QUESTION':
          queue.push(node.yes, node.no);
          break;
        case 'SAFETY':
          queue.push(node.next);
          break;
        case 'MEASURE':
          queue.push(node.branches.below, node.branches.within);
          break;
        case 'TERMINAL':
          // Terminal nodes have no branches
          break;
      }
    }

    const allNodeIds = Object.keys(flow.nodes);
    const unreachable = allNodeIds.filter(id => !visited.has(id));

    if (unreachable.length > 0) {
    }
  }

  private static validateTerminalNodes(flow: FlowDefinition): void {
    const hasTerminal = Object.values(flow.nodes).some(
      (node: FlowNode) => node.type === 'TERMINAL'
    );

    if (!hasTerminal) {
      throw new FlowValidationError('Flow must have at least one TERMINAL node');
    }
  }
}