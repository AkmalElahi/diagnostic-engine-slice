import { FlowDefinition, FlowNode, SessionState, SessionSummary, TerminalNode } from "./types";

export class DiagnosticEngine {
  private flow: FlowDefinition;

  constructor(flow: FlowDefinition) {
    this.flow = flow;
  }

  getNode(nodeId: string): FlowNode | null {
    return this.flow.nodes[nodeId] || null;
  }

  getStartNodeId(): string {
    return this.flow.start_node;
  }

  getNextNode(currentNodeId: string, value: string | number | boolean): string | null {
    const node = this.getNode(currentNodeId);
    if (!node) return null;

    switch (node.type) {
      case 'QUESTION':
        return value === true ? node.yes : node.no;
      
      case 'SAFETY':
        return node.next;
      
      case 'MEASURE':
        const numValue = Number(value);
        if (numValue < node.min) {
          return node.branches.below;
        } else if (numValue >= node.min && numValue <= node.max) {
          return node.branches.within;
        } else {
          return node.branches.below; // Treat above max as below for simplicity
        }
      
      case 'TERMINAL':
        return null;
      
      default:
        return null;
    }
  }

  createSession(): SessionState {
    return {
      flow_id: this.flow.flow_id,
      flow_version: this.flow.flow_version,
      session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      started_at: new Date().toISOString(),
      current_node_id: this.flow.start_node,
      events: [],
      completed: false
    };
  }

  generateSummary(session: SessionState, terminalNode: TerminalNode): SessionSummary {
    return {
      flow_id: session.flow_id,
      flow_version: session.flow_version,
      session_id: session.session_id,
      started_at: session.started_at,
      completed_at: new Date().toISOString(),
      events: session.events,
      terminal_node_id: session.current_node_id,
      result: terminalNode.result
    };
  }
}