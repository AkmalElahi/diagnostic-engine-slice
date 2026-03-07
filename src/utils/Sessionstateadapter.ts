import { SessionState, ArtifactSessionState, ExecutedNode } from '../types';

export class SessionStateAdapter {
  static toArtifactSessionState(
    sessionState: SessionState,
  ): ArtifactSessionState {
    return {
      artifact_id: sessionState.artifact_id,
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      executed_nodes: sessionState.executed_nodes,
      answers: sessionState.answers,
      measurements: sessionState.measurements,
      stop_reason: sessionState.stop_reason,
      last_confirmed_state: sessionState.last_confirmed_state,
    };
  }

  static validateForFinalization(sessionState: SessionState): void {
    const required = [
      'artifact_id',
      'flow_id',
      'flow_version',
      'stop_reason',
      'last_confirmed_state',
    ];

    const missing: string[] = [];

    for (const field of required) {
      if (!sessionState[field as keyof SessionState]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `SessionState missing required fields for finalization: ${missing.join(', ')}`,
      );
    }

    // Validate executed_nodes exists and is an array
    if (!Array.isArray(sessionState.executed_nodes)) {
      throw new Error('SessionState.executed_nodes must be an array');
    }

    // Validate answers exists
    if (
      typeof sessionState.answers !== 'object' ||
      sessionState.answers === null
    ) {
      throw new Error('SessionState.answers must be an object');
    }

    // Validate measurements exists
    if (
      typeof sessionState.measurements !== 'object' ||
      sessionState.measurements === null
    ) {
      throw new Error('SessionState.measurements must be an object');
    }
  }

  static extractExecutedNodes(events: SessionState['events']): ExecutedNode[] {
    return events.map((event) => ({
      node_id: event.node_id,
      node_type: event.type,
      executed_at: event.timestamp,
      value: event.value,
    }));
  }

  static extractAnswers(events: SessionState['events']): Record<string, any> {
    const answers: Record<string, any> = {};

    for (const event of events) {
      if (event.type === 'QUESTION') {
        answers[event.node_id] = event.value;
      }
    }

    return answers;
  }

  static extractMeasurements(
    events: SessionState['events'],
  ): Record<string, number | null> {
    const measurements: Record<string, number | null> = {};

    for (const event of events) {
      if (event.type === 'MEASURE') {
        // Measurements should be numbers, but handle edge cases
        const value = typeof event.value === 'number' ? event.value : null;
        measurements[event.node_id] = value;
      }
    }

    return measurements;
  }
  
  static buildFromEvents(sessionState: SessionState): ArtifactSessionState {
    return {
      artifact_id: sessionState.artifact_id,
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      executed_nodes: this.extractExecutedNodes(sessionState.events),
      answers: this.extractAnswers(sessionState.events),
      measurements: this.extractMeasurements(sessionState.events),
      stop_reason: sessionState.stop_reason || 'Unknown',
      last_confirmed_state: sessionState.last_confirmed_state || 'Unknown',
    };
  }
}
