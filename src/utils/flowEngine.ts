import { artifactGenerator } from './ArtifactGenerator';
import { SessionState, SessionEvent, SessionSummary } from '../types';
import { StorageService } from '../services/StorageService';
import { ArtifactFinalizationService } from '../services/Artifactfinalizationservice';
import { ArtifactIdGenerator } from './ArtifactIdGenerator';
import { FlowChecksumValidator, ChecksumVerificationError } from '../validators/Flowchecksumvalidator';
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
} from '../validators/FlowValidator';
import { RigIdentityService } from '../services/RigIdentityService';

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
  // private artifactService: ArtifactFinalizationService;

  private constructor(rawFlow: unknown) {
    try {
      FlowValidator.validate(rawFlow as RawFlow);
      this.flow = rawFlow as RawFlow;
      this.nodes = this.flow.nodes;
      const storage = createMMKV({ id: 'rv-diagnostic-engine' });
      // this.artifactService = new ArtifactFinalizationService(storage);
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
    
    await FlowChecksumValidator.verifyChecksumOrThrow(
      flowJsonString,
      expectedChecksum,
      flow.flowId,
      flow.flowVersion
    );

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

  private deriveResultText(
    node: RawFlowNode,
    value: string | number | boolean,
  ): string {
    switch (node.type) {
      case 'QUESTION': {
        const answerKey = String(value);
        
        if (answerKey.toLowerCase() === 'yes') {
          return 'Confirmed';
        } else if (answerKey.toLowerCase() === 'no') {
          return 'Not detected';
        }
        
        return `Answered: ${answerKey}`;
      }
      
      case 'SAFETY':
        return 'Safety warning acknowledged.';
      
      case 'MEASURE': {
        const m = node as MeasureNode;
        const numValue = Number(value);
        const unit = m.unit || '';
        
        const matchedBranch = m.branches.find(branch => {
          return this.evaluateMeasureCondition(branch.condition, numValue);
        });
        
        if (matchedBranch) {
          return `Measured ${numValue}${unit}: ${this.interpretCondition(matchedBranch.condition)}`;
        }
        
        return `Measured ${numValue}${unit}`;
      }
      
      case 'TERMINAL':
        return 'Diagnostic completed';
      
      default:
        return 'Step processed';
    }
  }

  private extractKeyNodeText(node: RawFlowNode): string {
    const fullText = node.text as string;
    
    switch (node.type) {
      case 'QUESTION': {
        const sentences = fullText
          .split(/[.!?]\s*/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        const questionSentence = sentences.find(s => s.includes('?'));
        if (questionSentence) {
          return questionSentence.trim();
        }

        const lastSentence = sentences[sentences.length - 1];
        return lastSentence;      
      }
      
      case 'SAFETY': {
        const sentences = fullText
          .split(/[.!]\s*/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        const critical = sentences.find(s => 
          s.toLowerCase().includes('do not') ||
          s.toLowerCase().includes('disconnect') ||
          s.toLowerCase().includes('stop')
        );
        
        if (critical) return critical;
        
        return sentences[0] || fullText;
      }
      
      case 'MEASURE':
      case 'TERMINAL':
        return fullText;
      
      default:
        return fullText;
    }
  }

  private evaluateMeasureCondition(condition: string, value: number): boolean {
    const ltMatch = condition.match(/^<\s*([\d.]+)$/);
    if (ltMatch) return value < parseFloat(ltMatch[1]);
    
    const lteMatch = condition.match(/^<=\s*([\d.]+)$/);
    if (lteMatch) return value <= parseFloat(lteMatch[1]);
    
    const gtMatch = condition.match(/^>\s*([\d.]+)$/);
    if (gtMatch) return value > parseFloat(gtMatch[1]);
    
    const gteMatch = condition.match(/^>=\s*([\d.]+)$/);
    if (gteMatch) return value >= parseFloat(gteMatch[1]);
    
    const rangeMatch = condition.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return value >= min && value <= max;
    }
    
    return false;
  }

  private interpretCondition(condition: string): string {
    if (condition.includes('<')) {
      return 'Below threshold';
    }
    if (condition.includes('>')) {
      return 'Above threshold';
    }
    if (condition.includes('-')) {
      return 'Within normal range';
    }
    return 'Condition met';
  }

  async processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): Promise<SessionState> {
    try {
      const currentNode = this.getCurrentNode(sessionState);
      this.validateResponse(currentNode, value);

      if (currentNode.type === 'TERMINAL') {
        const terminalEvent: SessionEvent = {
          node_id: sessionState.current_node_id,
          node_text: this.extractKeyNodeText(currentNode),
          type: 'TERMINAL',
          value: true,
          result_text: 'Diagnostic completed',
          timestamp: new Date().toISOString(),
        };
        return await this.processTerminalNode(sessionState, currentNode as TerminalNode, terminalEvent);
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

      const event: SessionEvent = {
        node_id: sessionState.current_node_id,
        node_text: this.extractKeyNodeText(currentNode) as string,
        type: currentNode.type as SessionEvent['type'],
        value,
        result_text: this.deriveResultText(currentNode, value),
        timestamp: new Date().toISOString(),
      };

      const executedNode = {
        node_id: sessionState.current_node_id,
        node_type: currentNode.type,
        executed_at: new Date().toISOString(),
        value,
      };

      const updatedState: SessionState = {
        ...sessionState,
        current_node_id: nextNodeId,
        events: [...sessionState.events, event],
        executed_nodes: [...sessionState.executed_nodes, executedNode],
      };
      
      StorageService.saveSessionState(updatedState);

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
      node_text: terminalNode.result,
      type: 'TERMINAL',
      value: true,
      result_text: 'Diagnostic completed',
      timestamp: new Date().toISOString(),
    };

    sessionState.stop_reason = 'User completed diagnostic';
    sessionState.last_confirmed_state = terminalNode.result;

    // AUTO-DETECT: Does terminal node have an artifact template?
    // const hasTemplate = terminalNode.artifact !== undefined && 
    //                     terminalNode.artifact !== null &&
    //                     Object.keys(terminalNode.artifact).length > 0;
    
    let artifact: FlowArtifact;
    // let finalizationResult: any = undefined;

    // if (hasTemplate) {
    //   finalizationResult = await this.artifactService.finalizeArtifact(
    //     sessionState,
    //     terminalNode
    //   );
    //   artifact = finalizationResult.finalization_result.final_artifact as FlowArtifact;
      
    // } else {
      artifact = this.generateDiagnosticArtifact(sessionState, terminalNode);
    // }

    const completedState: SessionState = {
      ...sessionState,
      events: [...sessionState.events, event],
      completed: true,
      stopped: false,
      completed_at: new Date().toISOString(),
      terminal_node_id: sessionState.current_node_id,
      result: terminalNode.result,
      artifact: artifact,
    };

    StorageService.saveSessionState(completedState);
    this.generateSummary(completedState);
    return completedState;
  }

  private generateDiagnosticArtifact(
    sessionState: SessionState,
    terminalNode: TerminalNode
  ): FlowArtifact {
    
    const diagnosticSessionState = this.convertToDiagnosticSessionState(sessionState);
    const diagnosticFlowData = this.convertToDiagnosticFlow();
    
    const diagnosticArtifact = artifactGenerator.generate(diagnosticSessionState, diagnosticFlowData);
    
    const flowArtifact: FlowArtifact = {
      artifact_id: sessionState.artifact_id,
      artifact_hash: '',
      vertical_id: 'RV',
      issue: diagnosticArtifact.result.primary_finding,
      flow_id: this.flow.flowId,
      flow_version: this.flow.flowVersion,
      artifact_schema_version: diagnosticArtifact.artifact_schema_version,
      stop_reason: sessionState.stop_reason,
      last_confirmed_state: sessionState.last_confirmed_state,
      
      confidence_level: diagnosticArtifact.result.confidence_level,
      primary_finding: diagnosticArtifact.result.primary_finding,
      explanation: diagnosticArtifact.result.explanation,
      
      safety_notes: [],
      stabilization_actions: [],
      recommendations: [diagnosticArtifact.result.recommended_next_step],
      notes: diagnosticArtifact.result.explanation,
    };
    
    return flowArtifact;
  }

  private convertToDiagnosticSessionState(sessionState: SessionState): any {
    return {
      sessionId: sessionState.session_id,
      flowId: sessionState.flow_id,
      flowVersion: sessionState.flow_version,
      currentNodeId: sessionState.current_node_id,
      
      events: sessionState.events.map(event => ({
        node_id: event.node_id,
        type: event.type,
        value: this.extractEventValue(event, sessionState),
        timestamp: event.timestamp,
        node_text: event.node_text,
        result_text: event.result_text
      })),
      
      startTime: sessionState.started_at,
      lastUpdateTime: sessionState.completed_at || new Date().toISOString(),
      isComplete: sessionState.completed
    };
  }

  private extractEventValue(event: SessionEvent, sessionState: SessionState): string {
    if (event.type === 'QUESTION' && event.node_id in sessionState.answers) {
      return sessionState.answers[event.node_id];
    }
    
    if (event.type === 'MEASURE' && event.node_id in sessionState.measurements) {
      return String(sessionState.measurements[event.node_id]);
    }
    
    return String(event.value);
  }

  private convertToDiagnosticFlow(): any {
    return {
      flow_id: this.flow.flowId,
      flow_version: this.flow.flowVersion,
      flow_name: this.getFlowDisplayName(),
      nodes: this.nodes
    };
  }

  private getFlowDisplayName(): string {
    const names: Record<string, string> = {
      'electrical_system': 'Electrical System',
      'water_system': 'Water System',
      'propane_system': 'Propane System',
      'slides_leveling': 'Slides and Leveling'
    };
    return names[this.flow.flowId] || this.flow.flowId;
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
