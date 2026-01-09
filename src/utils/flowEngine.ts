import {
  FlowDefinition,
  FlowNode,
  SessionState,
  SessionEvent,
  SessionSummary,
} from '../types';
import { StorageService } from './StorageService';
import { FlowValidator, FlowValidationError } from './flowValidator';

export class FlowEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowEngineError';
  }
}

export class FlowEngine {
  private flowDefinition: FlowDefinition;

  constructor(flowDefinition: FlowDefinition) {
    try {
      // Validate flow on construction
      FlowValidator.validate(flowDefinition);
      this.flowDefinition = flowDefinition;
    } catch (error) {
      if (error instanceof FlowValidationError) {
        throw error;
      }
      throw new FlowEngineError(`Invalid flow definition: ${error}`);
    }
  }

  startSession(): SessionState {
    try {
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
    } catch (error) {
      throw new FlowEngineError(`Failed to start session: ${error}`);
    }
  }

  resumeSession(): SessionState | null {
    try {
      const session = StorageService.loadSessionState();
      if (session) {
        if (session.flow_id !== this.flowDefinition.flow_id) {
          return null;
        }
      }
      return session;
    } catch (error) {
      return null;
    }
  }

  getCurrentNode(sessionState: SessionState): FlowNode {
    const node = this.flowDefinition.nodes[sessionState.current_node_id];
    if (!node) {
      throw new FlowEngineError(`Node not found: ${sessionState.current_node_id}`);
    }
    return node;
  }

  processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): SessionState {
    try {
      const currentNode = this.getCurrentNode(sessionState);
      
      this.validateResponse(currentNode, value);
      
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

          StorageService.saveSessionState(terminalState);
          this.generateSummary(terminalState);
          return terminalState;
      }

      const updatedState: SessionState = {
        ...sessionState,
        current_node_id: nextNodeId!,
        events: [...sessionState.events, event],
      };

      StorageService.saveSessionState(updatedState);

      // Auto-process TERMINAL nodes
      const nextNode = this.flowDefinition.nodes[nextNodeId!];
      if (nextNode && nextNode.type === 'TERMINAL') {
        return this.processTerminalNode(updatedState, nextNode);
      }

      return updatedState;
    } catch (error) {
      throw new FlowEngineError(`Failed to process response: ${error}`);
    }
  }

  private validateResponse(node: FlowNode, value: string | number | boolean): void {
    switch (node.type) {
      case 'QUESTION':
        if (typeof value !== 'boolean') {
          throw new FlowEngineError('QUESTION node requires boolean response');
        }
        break;
      case 'MEASURE':
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new FlowEngineError('MEASURE node requires numeric response');
        }
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new FlowEngineError('MEASURE node requires valid number');
        }
        break;
    }
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
      throw new FlowEngineError('Cannot generate summary for incomplete session');
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

  getFlowInfo(): { id: string; version: string; name?: string } {
    return {
      id: this.flowDefinition.flow_id,
      version: this.flowDefinition.flow_version,
      name: this.flowDefinition.flow_id.replace(/_/g, ' ').toUpperCase(),
    };
  }
}
