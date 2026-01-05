import {
  FlowDefinition,
  FlowNode,
  SessionState,
  SessionEvent,
  SessionSummary,
} from '../types';
import { StorageService } from './StorageService';

export class FlowEngine {
  private flowDefinition: FlowDefinition;

  constructor(flowDefinition: FlowDefinition) {
    this.flowDefinition = flowDefinition;
  }

  startSession(): SessionState {
    const sessionId = this.generateSessionId();
    const startedAt = new Date().toISOString();

    const sessionState: SessionState = {
      flow_id: this.flowDefinition.flow_id,
      flow_version: this.flowDefinition.flow_version,
      session_id: sessionId,
      started_at: startedAt,
      current_node_id: this.flowDefinition.start_node,
      events: [],
      completed: false,
    };

    StorageService.saveSessionState(sessionState);
    return sessionState;
  }

  resumeSession(): SessionState | null {
    return StorageService.loadSessionState();
  }

  getCurrentNode(sessionState: SessionState): FlowNode {
    const node = this.flowDefinition.nodes[sessionState.current_node_id];
    if (!node) {
      throw new Error(`Node not found: ${sessionState.current_node_id}`);
    }
    return node;
  }

  processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): SessionState {
    const currentNode = this.getCurrentNode(sessionState);
    
    const event: SessionEvent = {
      node_id: sessionState.current_node_id,
      type: currentNode.type,
      value: value,
      timestamp: new Date().toISOString(),
    };

    let nextNodeId: string | null = null;

    switch (currentNode.type) {
      case 'QUESTION':
        nextNodeId = value === true ? currentNode.yes : currentNode.no;
        break;

      case 'SAFETY':
        nextNodeId = currentNode.next;
        break;

      case 'MEASURE':
        const numValue = Number(value);
        if (numValue < currentNode.min || numValue > currentNode.max) {
          nextNodeId = currentNode.branches.below;
        } else {
          nextNodeId = currentNode.branches.within;
        }
        break;

      case 'TERMINAL':
        const terminalState: SessionState = {
          ...sessionState,
          events: [...sessionState.events, event],
          completed: true,
          completed_at: new Date().toISOString(),
          terminal_node_id: sessionState.current_node_id,
          result: currentNode.result,
        };

        console.log('Session completed:', terminalState);
        StorageService.saveSessionState(terminalState);
        this.generateSummary(terminalState);
        return terminalState;
    }

    // Update state with next node
    const updatedState: SessionState = {
      ...sessionState,
      current_node_id: nextNodeId!,
      events: [...sessionState.events, event],
    };

    StorageService.saveSessionState(updatedState);

    const nextNode = this.flowDefinition.nodes[nextNodeId!];
    if (nextNode && nextNode.type === 'TERMINAL') {
      console.log('Next node is TERMINAL, auto-processing...');
      return this.processTerminalNode(updatedState, nextNode);
    }

    return updatedState;
  }

  private processTerminalNode(sessionState: SessionState, terminalNode: any): SessionState {
    const event: SessionEvent = {
      node_id: sessionState.current_node_id,
      type: 'TERMINAL',
      value: true,
      timestamp: new Date().toISOString(),
    };

    const completedState: SessionState = {
      ...sessionState,
      events: [...sessionState.events, event],
      completed: true,
      completed_at: new Date().toISOString(),
      terminal_node_id: sessionState.current_node_id,
      result: terminalNode.result,
    };

    StorageService.saveSessionState(completedState);
    this.generateSummary(completedState);
    
    return completedState;
  }

  private generateSummary(sessionState: SessionState): SessionSummary {
    if (!sessionState.completed) {
      throw new Error('Cannot generate summary for incomplete session');
    }

    const summary: SessionSummary = {
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      session_id: sessionState.session_id,
      started_at: sessionState.started_at,
      completed_at: sessionState.completed_at!,
      events: sessionState.events,
      terminal_node_id: sessionState.terminal_node_id!,
      result: sessionState.result!,
    };

    StorageService.saveSessionSummary(summary);
    
    return summary;
  }

  clearSession(): void {
    StorageService.clearSessionState();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getHistory(): SessionSummary[] {
    return StorageService.getSessionHistory();
  }
}

