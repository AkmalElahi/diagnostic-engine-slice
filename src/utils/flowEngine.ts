import { SessionState, SessionEvent, SessionSummary } from '../types';
import { StorageService } from './StorageService';
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

  constructor(rawFlow: unknown) {
    try {
      // Validate raw flow JSON directly — no normaliser step
      FlowValidator.validate(rawFlow as RawFlow);
      this.flow  = rawFlow as RawFlow;
      // Resolve nodes once — handles both dict and array formats
      this.nodes = FlowValidator.resolveNodes(this.flow);
    } catch (error) {
      if (error instanceof FlowValidationError) throw error;
      throw new FlowEngineError(`Invalid flow definition: ${error}`);
    }
  }

  // ─── Session lifecycle ────────────────────────────────────────────────────

  startSession(): SessionState {
    try {
      const sessionState: SessionState = {
        flow_id:          this.flow.flowId,
        flow_version:     this.flow.flowVersion,
        session_id:       this.generateSessionId(),
        started_at:       new Date().toISOString(),
        current_node_id:  this.flow.startNode,
        events:           [],
        completed:        false,
        stopped:          false,
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

  /**
   * Processes a user response for the current node and advances session state.
   *
   * @param sessionState  Current session state
   * @param value         QUESTION: answer key string (e.g. "yes", "not_sure", "shore_power")
   *                      SAFETY:   any truthy value (user tapped Continue)
   *                      MEASURE:  numeric value as number or numeric string
   */
  processResponse(
    sessionState: SessionState,
    value: string | number | boolean
  ): SessionState {
    try {
      const currentNode = this.getCurrentNode(sessionState);
      this.validateResponse(currentNode, value);

      const event: SessionEvent = {
        node_id:   sessionState.current_node_id,
        type:      currentNode.type as SessionEvent['type'],
        value,
        timestamp: new Date().toISOString(),
      };

      // ── TERMINAL reached directly ────────────────────────────────────────
      if (currentNode.type === 'TERMINAL') {
        return this.processTerminalNode(sessionState, currentNode as TerminalNode, event);
      }

      // ── Resolve next node id ─────────────────────────────────────────────
      let nextNodeId: string;

      switch (currentNode.type) {
        case 'QUESTION': {
          const q = currentNode as QuestionNode;
          const answerKey = String(value);
          const next = q.answers[answerKey];
          if (!next) {
            throw new FlowEngineError(
              `QUESTION node "${sessionState.current_node_id}" has no answer for "${answerKey}". ` +
              `Valid keys: ${Object.keys(q.answers).join(', ')}`
            );
          }
          nextNodeId = next;
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
              `MEASURE node "${sessionState.current_node_id}": no branch matched value ${numValue}. ` +
              `Branches: ${m.branches.map(b => b.condition).join(', ')}`
            );
          }
          nextNodeId = resolved;
          break;
        }
        default:
          throw new FlowEngineError(`Unhandled node type: "${currentNode.type}"`);
      }

      // ── Advance state ────────────────────────────────────────────────────
      const updatedState: SessionState = {
        ...sessionState,
        current_node_id: nextNodeId,
        events: [...sessionState.events, event],
      };
      StorageService.saveSessionState(updatedState);

      // Auto-process TERMINAL nodes (they require no user input)
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

  // ─── STOP ─────────────────────────────────────────────────────────────────

  /**
   * Stops the session at the current node and produces a valid partial artifact.
   *
   * All flow-specific fields already collected are preserved from session events.
   * Fields not yet reached default to "Unknown".
   *
   * Satisfies the canonical pack requirement:
   *   "STOP must be available at any point and always produces an artifact"
   */
  stopSession(sessionState: SessionState): SessionState {
    try {
      const partialArtifact = this.buildStopArtifact(sessionState);

      const stoppedState: SessionState = {
        ...sessionState,
        stopped:          true,
        stopped_at:       new Date().toISOString(),
        stop_node_id:     sessionState.current_node_id,
        partial_artifact: partialArtifact,
      };

      StorageService.saveSessionState(stoppedState);
      this.generateStopSummary(stoppedState, partialArtifact);
      return stoppedState;
    } catch (error) {
      throw new FlowEngineError(`Failed to stop session: ${error}`);
    }
  }

  /**
   * Builds a partial artifact for a mid-flow STOP.
   *
   * Uses the first terminal node's artifact as a field template to get the
   * full set of flow-specific field names, then:
   *   1. Sets all fields to "Unknown" / [] as appropriate
   *   2. Restores universal fields with STOP-specific values
   *   3. Resolves template variables ({{node_id.value}}) from collected events
   */
  private buildStopArtifact(sessionState: SessionState): FlowArtifact {
    const template = this.getTemplateArtifact();

    // Build event map: node_id → answered value
    const eventMap = new Map<string, string | number | boolean>();
    for (const event of sessionState.events) {
      eventMap.set(event.node_id, event.value);
    }

    // Start from template, default every non-universal field to "Unknown"
    const artifact: Record<string, unknown> = { ...template };
    const universalFields = new Set([
      'flow_id', 'flow_version', 'issue', 'safety_notes',
    ]);

    for (const key of Object.keys(artifact)) {
      if (!universalFields.has(key)) {
        artifact[key] = Array.isArray(template[key as keyof FlowArtifact]) ? [] : 'Unknown';
      }
    }

    // Set STOP-specific universal fields
    artifact['stop_reason'] =
      `User stopped diagnostic at node: ${sessionState.current_node_id}`;
    artifact['last_confirmed_state'] =
      this.buildLastConfirmedState(sessionState);
    artifact['safety_notes'] = '';

    // Resolve template variables from collected events
    for (const [key, templateValue] of Object.entries(template)) {
      if (typeof templateValue === 'string' && templateValue.includes('{{')) {
        artifact[key] = templateValue.replace(
          /\{\{([^}]+)\}\}/g,
          (_match: string, expr: string) => {
            const nodeId = expr.trim().split('.')[0];
            const val = eventMap.get(nodeId);
            return val !== undefined ? String(val) : 'Unknown';
          }
        );
      }
    }

    return artifact as FlowArtifact;
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
    // Validator guarantees at least one TERMINAL — this is a safety fallback only
    return {
      flow_id:              this.flow.flowId,
      flow_version:         this.flow.flowVersion,
      issue:                this.flow.title ?? '',
      stop_reason:          '',
      last_confirmed_state: '',
      safety_notes:         '',
    };
  }

  // ─── Terminal processing ──────────────────────────────────────────────────

  private processTerminalNode(
    sessionState: SessionState,
    terminalNode: TerminalNode,
    incomingEvent?: SessionEvent
  ): SessionState {
    const event: SessionEvent = incomingEvent ?? {
      node_id:   sessionState.current_node_id,
      type:      'TERMINAL',
      value:     true,
      timestamp: new Date().toISOString(),
    };

    const completedState: SessionState = {
      ...sessionState,
      events:           [...sessionState.events, event],
      completed:        true,
      stopped:          false,
      completed_at:     new Date().toISOString(),
      terminal_node_id: sessionState.current_node_id,
      result:           terminalNode.result,
      artifact:         terminalNode.artifact,
    };

    StorageService.saveSessionState(completedState);
    this.generateSummary(completedState);
    return completedState;
  }

  // ─── Summary generation ───────────────────────────────────────────────────

  private generateSummary(sessionState: SessionState): SessionSummary {
    if (!sessionState.completed) {
      throw new FlowEngineError('Cannot generate summary for incomplete session');
    }
    const summary: SessionSummary = {
      flow_id:          sessionState.flow_id,
      flow_version:     sessionState.flow_version,
      session_id:       sessionState.session_id,
      started_at:       sessionState.started_at,
      completed_at:     sessionState.completed_at!,
      events:           sessionState.events,
      terminal_node_id: sessionState.terminal_node_id!,
      result:           sessionState.result!,
      artifact:         sessionState.artifact,
      stopped:          false,
    };
    StorageService.saveSessionSummary(summary);
    return summary;
  }

  private generateStopSummary(
    sessionState: SessionState,
    partialArtifact: FlowArtifact
  ): SessionSummary {
    const summary: SessionSummary = {
      flow_id:          sessionState.flow_id,
      flow_version:     sessionState.flow_version,
      session_id:       sessionState.session_id,
      started_at:       sessionState.started_at,
      completed_at:     sessionState.stopped_at!,
      events:           sessionState.events,
      terminal_node_id: sessionState.stop_node_id ?? sessionState.current_node_id,
      result:           `Diagnostic stopped at: ${sessionState.current_node_id}`,
      artifact:         partialArtifact,
      stopped:          true,
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
      // SAFETY and TERMINAL accept any value
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
      id:      this.flow.flowId,
      version: this.flow.flowVersion,
      title:   this.flow.title ?? '',
    };
  }
}
