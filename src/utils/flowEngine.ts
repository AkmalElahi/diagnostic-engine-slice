import { SessionState, SessionEvent, SessionSummary } from '../types';
import { StorageService } from './StorageService';
import { ArtifactFinalizationService } from './Artifactfinalizationservice';
import { ArtifactIdGenerator } from './ArtifactIdGenerator';
import { FlowChecksumValidator, ChecksumVerificationError } from './Flowchecksumvalidator';
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
import { RigIdentityService } from './RigIdentityService';


export { FlowValidationError, ChecksumVerificationError };

export class FlowEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowEngineError';
  }
}

export class FlowEngine {
  private flow: RawFlow;
  private nodes: Record<string, RawFlowNode>;
  private artifactService: ArtifactFinalizationService;

  private constructor(rawFlow: unknown) {
    try {
      FlowValidator.validate(rawFlow as RawFlow);
      this.flow = rawFlow as RawFlow;
      this.nodes = this.flow.nodes;
      const storage = createMMKV({ id: 'rv-diagnostic-engine' });
      this.artifactService = new ArtifactFinalizationService(storage);
    } catch (error) {
      if (error instanceof FlowValidationError) throw error;
      throw new FlowEngineError(`Invalid flow definition: ${error}`);
    }
  }

  static async createWithChecksum(
    rawFlow: unknown,
    expectedChecksum: string
  ): Promise<FlowEngine> {
    const flow = rawFlow as RawFlow;
    const flowJsonString = JSON.stringify(rawFlow);
    
    // Verify checksum before creating engine
    await FlowChecksumValidator.verifyChecksumOrThrow(
      flowJsonString,
      expectedChecksum,
      flow.flowId,
      flow.flowVersion
    );

    // Checksum verified - safe to create engine
    return new FlowEngine(rawFlow);
  }

  static createUnsafe(rawFlow: unknown): FlowEngine {
    const flow = rawFlow as RawFlow;
    console.warn(
      '[UNSAFE_FLOW_CREATION]',
      'Creating FlowEngine without checksum verification.',
      'This should only be used for testing.',
      { flow_id: flow.flowId, flow_version: flow.flowVersion }
    );
    return new FlowEngine(rawFlow);
  }

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

  // ─── Response processing ──────────────────────────────────────────────────

  async processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): Promise<SessionState> {
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
        return await this.processTerminalNode(sessionState, currentNode as TerminalNode, event);
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
        executed_nodes: [...sessionState.executed_nodes, executedNode],
      };
      
      StorageService.saveSessionState(updatedState);

      // Auto-process TERMINAL nodes
      const nextNode = this.nodes[nextNodeId];
      if (nextNode?.type === 'TERMINAL') {
        return await this.processTerminalNode(updatedState, nextNode as TerminalNode);
      }

      return updatedState;
    } catch (error) {
      if (error instanceof FlowEngineError) throw error;
      throw new FlowEngineError(`Failed to process response: ${error}`);
    }
  }

  private async processTerminalNode(
    sessionState: SessionState,
    terminalNode: TerminalNode,
    incomingEvent?: SessionEvent
  ): Promise<SessionState> {
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
    const finalizationResult = await this.artifactService.finalizeArtifact(
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


  stopSession(sessionState: SessionState): SessionState {
    const stopped: SessionState = {
      ...sessionState,
      stopped: true,
      stopped_at: new Date().toISOString(),
      stop_node_id: sessionState.current_node_id,
      partial_artifact: this.getTemplateArtifact(sessionState.current_node_id),
    };
    
    StorageService.saveSessionState(stopped);
    this.generateSummary(stopped);
    return stopped;
  }

  getCurrentNode(sessionState: SessionState): RawFlowNode {
    const node = this.nodes[sessionState.current_node_id];
    if (!node) {
      throw new FlowEngineError(
        `Node not found: "${sessionState.current_node_id}"`
      );
    }
    return node;
  }

  private validateResponse(node: RawFlowNode, value: unknown): void {
    if (node.type === 'QUESTION') {
      const q = node as QuestionNode;
      if (!q.answers[String(value)]) {
        throw new FlowEngineError(
          `Invalid answer "${value}" for question. Valid: ${Object.keys(q.answers).join(', ')}`
        );
      }
    } else if (node.type === 'MEASURE') {
      const m = node as MeasureNode;
      const num = Number(value);
      if (isNaN(num)) {
        throw new FlowEngineError('MEASURE requires numeric value');
      }
      if (num < m.validRange.min || num > m.validRange.max) {
        throw new FlowEngineError(
          `Value ${num} out of range [${m.validRange.min}, ${m.validRange.max}]`
        );
      }
    }
  }

  private getTemplateArtifact(nodeId: string): FlowArtifact | undefined {
    const node = this.nodes[nodeId];
    if (node?.type === 'TERMINAL') {
      return (node as TerminalNode).artifact;
    }
    return {
      vertical_id: 'RV',
      flow_id: this.flow.flowId,
      flow_version: this.flow.flowVersion,
      artifact_schema_version: '1.0',
      issue: 'Diagnostic stopped',
      stop_reason: 'User stopped',
      last_confirmed_state: 'Unknown',
      safety_notes: [],
      stabilization_actions: [],
      recommendations: [],
      notes: '',
    };
  }

  private generateSummary(sessionState: SessionState): void {
    const rigIdentity = RigIdentityService.getOrCreate();

    const summary: SessionSummary = {
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      session_id: sessionState.session_id,
      started_at: sessionState.started_at,
      completed_at: sessionState.completed_at || sessionState.stopped_at || '',
      events: sessionState.events,
      terminal_node_id: sessionState.terminal_node_id || sessionState.stop_node_id || '',
      result: sessionState.result || '',
      artifact: sessionState.artifact || sessionState.partial_artifact,
      stopped: sessionState.stopped,

      creator_name: rigIdentity.custom_name || 'Owner',
      creator_type: 'OWNER',
      date_time: new Date().toISOString(),
      rig_identity: rigIdentity.id,
    };
    
    StorageService.saveSessionSummary(summary);
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  static getHistory(): SessionSummary[] {
    return StorageService.getSessionHistory();
  }
}