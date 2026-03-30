import { MMKV } from 'react-native-mmkv';
import { SessionState } from '../types';
import { ArtifactIdGenerator } from './ArtifactIdGenerator';

const STORAGE_KEYS = {
  SESSION_STATE: 'diagnostic_session_state',
  ARTIFACT_ID: 'diagnostic_artifact_id',
} as const;

export class SessionPersistence {
  private storage: MMKV;

  constructor(storage: MMKV) {
    this.storage = storage;
  }

  initializeSession(
    flowId: string,
    flowVersion: string,
    existingArtifactId?: string
  ): SessionState {
    const artifactId = ArtifactIdGenerator.ensureValid(existingArtifactId);
    const sessionId = ArtifactIdGenerator.generate(); // Different from artifact_id
    const now = new Date().toISOString();

    const sessionState: SessionState = {
      flow_id: flowId,
      flow_version: flowVersion,
      session_id: sessionId,
      artifact_id: artifactId, // IMMUTABLE - never changes
      started_at: now,
      current_node_id: '',
      events: [],
      completed: false,
      stopped: false,
      stop_reason: '',
      executed_nodes: [],
      last_confirmed_state: '',
      answers: {},
      measurements: {},
    };

    // Persist immediately
    this.saveSession(sessionState);
    this.saveArtifactId(artifactId);

    return sessionState;
  }

  saveSession(sessionState: SessionState): void {
    const json = JSON.stringify(sessionState);
    this.storage.set(STORAGE_KEYS.SESSION_STATE, json);
  }

  saveArtifactId(artifactId: string): void {
    this.storage.set(STORAGE_KEYS.ARTIFACT_ID, artifactId);
  }

  loadSession(): SessionState | null {
    const json = this.storage.getString(STORAGE_KEYS.SESSION_STATE);
    if (!json) {
      return null;
    }

    try {
      const sessionState = JSON.parse(json) as SessionState;
      return sessionState;
    } catch (error) {
      console.error('Failed to parse session state:', error);
      return null;
    }
  }

  loadArtifactId(): string | null {
    return this.storage.getString(STORAGE_KEYS.ARTIFACT_ID) || null;
  }

  hasResumableSession(): boolean {
    const sessionState = this.loadSession();
    return sessionState !== null && !sessionState.completed;
  }

  resumeSession(): SessionState | null {
    const sessionState = this.loadSession();
    if (!sessionState) {
      return null;
    }

    const storedArtifactId = this.loadArtifactId();

    // Validate artifact_id immutability
    if (storedArtifactId && sessionState.artifact_id !== storedArtifactId) {
      throw new Error(
        'Artifact ID mismatch - possible data corruption. ' +
        `Session: ${sessionState.artifact_id}, Stored: ${storedArtifactId}`
      );
    }

    return sessionState;
  }

  clearSession(preserveArtifactId: boolean = false): void {
    this.storage.remove(STORAGE_KEYS.SESSION_STATE);
    
    if (!preserveArtifactId) {
      this.storage.remove(STORAGE_KEYS.ARTIFACT_ID);
    }
  }

  updateSession(updates: Partial<SessionState>): void {
    const current = this.loadSession();
    if (!current) {
      throw new Error('No session to update');
    }

    // Prevent artifact_id mutation
    if (updates.artifact_id && updates.artifact_id !== current.artifact_id) {
      throw new Error(
        'Cannot change artifact_id after session initialization. ' +
        `Current: ${current.artifact_id}, Attempted: ${updates.artifact_id}`
      );
    }

    const updated: SessionState = {
      ...current,
      ...updates,
      artifact_id: current.artifact_id, // Force immutability
    };

    this.saveSession(updated);
  }

  getSessionStats(): {
    has_session: boolean;
    artifact_id: string | null;
    completed: boolean;
    stopped: boolean;
    event_count: number;
  } {
    const session = this.loadSession();
    const artifactId = this.loadArtifactId();

    return {
      has_session: session !== null,
      artifact_id: artifactId,
      completed: session?.completed || false,
      stopped: session?.stopped || false,
      event_count: session?.events.length || 0,
    };
  }
}