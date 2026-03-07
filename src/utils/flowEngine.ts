import { SessionState, SessionEvent, SessionSummary } from '../types';
import { StorageService } from './StorageService';
import { ArtifactFinalizationService } from './Artifactfinalizationservice';
import { ArtifactIdGenerator } from './ArtifactIdGenerator';
import { createMMKV } from 'react-native-mmkv';
import {
  RawFlow,
  RawFlowNode,
  QuestionNode,
  SafetyNode,
  MeasureNode,
  TerminalNode,
  FlowArtifact,
  FlowValidator,
  FlowValidationError,
  resolveMeasureBranch,
} from './FlowValidator';

// ─── Error ────────────────────────────────────────────────────────────────────

export class FlowEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowEngineError';
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class FlowEngine {
  private flow: RawFlow;
  private nodes: Record<string, RawFlowNode>;
  private artifactService: ArtifactFinalizationService;

  constructor(rawFlow: unknown) {
    try {
      // Validate raw flow JSON directly
      FlowValidator.validate(rawFlow as RawFlow);
      this.flow = rawFlow as RawFlow;
      this.nodes = this.flow.nodes;
      
      // Initialize MS5 artifact finalization service
      const storage = createMMKV({ id: 'rv-diagnostic-engine' });
      this.artifactService = new ArtifactFinalizationService(storage);
    } catch (error) {
      if (error instanceof FlowValidationError) throw error;
      throw new FlowEngineError(`Invalid flow definition: ${error}`);
    }
  }

  // ─── Session lifecycle ────────────────────────────────────────────────────

  startSession(): SessionState {
    try {
      const artifactId = ArtifactIdGenerator.generate();
      
      const sessionState: SessionState = {
        flow_id: this.flow.flowId,
        flow_version: this.flow.flowVersion,
        session_id: this.generateSessionId(),
        artifact_id: artifactId,
        started_at: new Date().toISOString(),
        current_node_id: this.flow.startNode,
        events: [],
        completed: false,
        stopped: false,
        stop_reason: '',
        executed_nodes: [],
        last_confirmed_state: '',
        answers: {},
        measurements: {},
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
      if (!session) return null;
      // Only resume sessions for this flow that are still in progress
      if (session.flow_id !== this.flow.flowId) return null;
      if (session.completed || session.stopped) return null;
      return session;
    } catch {
      return null;
    }
  }

  clearSession(): void {
    StorageService.clearSessionState();
  }

  // ─── Node access ──────────────────────────────────────────────────────────

  getCurrentNode(sessionState: SessionState): RawFlowNode {
    const node = this.nodes[sessionState.current_node_id];
    if (!node) {
      throw new FlowEngineError(`Node not found: "${sessionState.current_node_id}"`);
    }
    return node;
  }

  // ─── Response processing ──────────────────────────────────────────────────

  processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): SessionState {
    try {
      const currentNode = this.getCurrentNode(sessionState);
      this.validateResponse(currentNode, value);

      const event: SessionEvent = {
        node_id: sessionState.current_node_id,
        type: currentNode.type as SessionEvent['type'],
        value,
        timestamp: new Date().toISOString(),
      };

      const executedNode = {
        node_id: sessionState.current_node_id,
        node_type: currentNode.type,
        executed_at: new Date().toISOString(),
        value,
      };

      if (currentNode.type === 'TERMINAL') {
        return this.processTerminalNode(sessionState, currentNode as TerminalNode, event);
      }

      let nextNodeId: string;

      switch (currentNode.type) {
        case 'QUESTION': {
          const q = currentNode as QuestionNode;
          const answerKey = String(value);
          const next = q.answers[answerKey];
          if (!next) {
            throw new FlowEngineError(
              `QUESTION node "${sessionState.current_node_id}" has no answer for "${answerKey}"`
            );
          }
          nextNodeId = next;
          
          sessionState.answers[sessionState.current_node_id] = answerKey;
          break;
        }
        case 'SAFETY': {
          nextNodeId = (currentNode as SafetyNode).next;
          break;
        }
        case 'MEASURE': {
          const m = currentNode as MeasureNode;
          const numValue = Number(value);
          if (isNaN(numValue)) {
            throw new FlowEngineError(
              `MEASURE node "${sessionState.current_node_id}" requires a numeric value`
            );
          }
          const resolved = resolveMeasureBranch(m.branches, numValue);
          if (!resolved) {
            throw new FlowEngineError(
              `MEASURE node "${sessionState.current_node_id}": no branch matched value ${numValue}`
            );
          }
          nextNodeId = resolved;
          
          sessionState.measurements[sessionState.current_node_id] = numValue;
          break;
        }
        default:
          throw new FlowEngineError(`Unhandled node type: "${currentNode.type}"`);
      }

      const updatedState: SessionState = {
        ...sessionState,
        current_node_id: nextNodeId,
        events: [...sessionState.events, event],
        executed_nodes: [...sessionState.executed_nodes, executedNode],  // MS5: Track execution
      };
      
      StorageService.saveSessionState(updatedState);

      const nextNode = this.nodes[nextNodeId];
      if (nextNode?.type === 'TERMINAL') {
        return this.processTerminalNode(updatedState, nextNode as TerminalNode);
      }

      return updatedState;
    } catch (error) {
      if (error instanceof FlowEngineError) throw error;
      throw new FlowEngineError(`Failed to process response: ${error}`);
    }
  }


  private processTerminalNode(
    sessionState: SessionState,
    terminalNode: TerminalNode,
    incomingEvent?: SessionEvent
  ): SessionState {
    const event: SessionEvent = incomingEvent ?? {
      node_id: sessionState.current_node_id,
      type: 'TERMINAL',
      value: true,
      timestamp: new Date().toISOString(),
    };

    // MS5: Set required fields before finalization
    sessionState.stop_reason = 'User completed diagnostic';
    sessionState.last_confirmed_state = terminalNode.result;

    // MS5: Finalize artifact using ArtifactFinalizationService
    const finalizationResult = this.artifactService.finalizeArtifact(
      sessionState,
      terminalNode
    );

    const completedState: SessionState = {
      ...sessionState,
      events: [...sessionState.events, event],
      completed: true,
      stopped: false,
      completed_at: new Date().toISOString(),
      terminal_node_id: sessionState.current_node_id,
      result: terminalNode.result,
      artifact: finalizationResult.finalization_result.final_artifact as FlowArtifact,
    };

    StorageService.saveSessionState(completedState);
    this.generateSummary(completedState);
    return completedState;
  }

  // ─── STOP ─────────────────────────────────────────────────────────────────

  stopSession(sessionState: SessionState): SessionState {
    try {
      const partialArtifact = this.buildStopArtifact(sessionState);

      const stoppedState: SessionState = {
        ...sessionState,
        stopped: true,
        stopped_at: new Date().toISOString(),
        stop_node_id: sessionState.current_node_id,
        partial_artifact: partialArtifact,
      };

      StorageService.saveSessionState(stoppedState);
      this.generateStopSummary(stoppedState, partialArtifact);
      return stoppedState;
    } catch (error) {
      throw new FlowEngineError(`Failed to stop session: ${error}`);
    }
  }

  private buildStopArtifact(sessionState: SessionState): FlowArtifact {
    const template = this.getTemplateArtifact();

    const artifact: Record<string, unknown> = { ...template };
    
    artifact['stop_reason'] = `User stopped diagnostic at node: ${sessionState.current_node_id}`;
    artifact['last_confirmed_state'] = this.buildLastConfirmedState(sessionState);
    artifact['safety_notes'] = [];

    // Use interpolateArtifact to resolve placeholders
    const resolvedArtifact = this.interpolateArtifact(sessionState, artifact);

    return resolvedArtifact as FlowArtifact;
  }

  private buildLastConfirmedState(sessionState: SessionState): string {
    const events = sessionState.events;
    if (events.length === 0) {
      return `Stopped at: ${sessionState.current_node_id}. No responses recorded.`;
    }
    const last = events[events.length - 1];
    return (
      `Last answered: ${last.node_id} = ${last.value}. ` +
      `Stopped at: ${sessionState.current_node_id}.`
    );
  }

  private getTemplateArtifact(): FlowArtifact {
    for (const node of Object.values(this.nodes)) {
      if (node.type === 'TERMINAL') {
        return { ...(node as TerminalNode).artifact };
      }
    }
    return {
      vertical_id: 'RV',
      artifact_schema_version:'1.0',
      flow_id: this.flow.flowId,
      flow_version: this.flow.flowVersion,
      issue: this.flow.title ?? '',
      stop_reason: '',
      last_confirmed_state: '',
      safety_notes: [],
    };
  }

  private getNodeValue(sessionState: SessionState, nodeId: string): string | number | null {
    for (let i = sessionState.events.length - 1; i >= 0; i--) {
      const event = sessionState.events[i];
      if (event.node_id === nodeId) {
        return typeof event.value === 'boolean' ? String(event.value) : event.value;
      }
    }
    return null;
  }

  private interpolateArtifact(sessionState: SessionState, artifact: any): any {
    const clone = JSON.parse(JSON.stringify(artifact));

    const interpolate = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{([^.]+)\.value\}\}/g, (_match: string, nodeId: string) => {
          const value = this.getNodeValue(sessionState, nodeId.trim());
          return value !== null ? String(value) : 'Unknown';
        });
      }
      if (Array.isArray(obj)) {
        return obj.map(interpolate);
      }
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, val] of Object.entries(obj)) {
          result[key] = interpolate(val);
        }
        return result;
      }
      return obj;
    };

    return interpolate(clone);
  }

  // ─── Summary generation ───────────────────────────────────────────────────

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
      artifact: sessionState.artifact,
      stopped: false,
    };
    StorageService.saveSessionSummary(summary);
    return summary;
  }

  private generateStopSummary(
    sessionState: SessionState,
    partialArtifact: FlowArtifact
  ): SessionSummary {
    const summary: SessionSummary = {
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      session_id: sessionState.session_id,
      started_at: sessionState.started_at,
      completed_at: sessionState.stopped_at!,
      events: sessionState.events,
      terminal_node_id: sessionState.stop_node_id ?? sessionState.current_node_id,
      result: `Diagnostic stopped at: ${sessionState.current_node_id}`,
      artifact: partialArtifact,
      stopped: true,
    };
    StorageService.saveSessionSummary(summary);
    return summary;
  }

  // ─── Response validation ──────────────────────────────────────────────────

  private validateResponse(node: RawFlowNode, value: string | number | boolean): void {
    switch (node.type) {
      case 'QUESTION': {
        const q = node as QuestionNode;
        const answerKey = String(value);
        if (!q.answers[answerKey]) {
          throw new FlowEngineError(
            `Invalid answer "${answerKey}". Valid answers: ${Object.keys(q.answers).join(', ')}`
          );
        }
        break;
      }
      case 'MEASURE': {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new FlowEngineError('MEASURE node requires a numeric value');
        }
        const m = node as MeasureNode;
        if (numValue < m.validRange.min || numValue > m.validRange.max) {
          throw new FlowEngineError(
            `Value ${numValue} is outside valid range [${m.validRange.min}, ${m.validRange.max}]`
          );
        }
        break;
      }
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getHistory(): SessionSummary[] {
    return StorageService.getSessionHistory();
  }

  getFlowInfo(): { id: string; version: string; title: string } {
    return {
      id: this.flow.flowId,
      version: this.flow.flowVersion,
      title: this.flow.title ?? '',
    };
  }
}