
import { MMKV } from 'react-native-mmkv';
import { ArtifactFinalizer } from './ArtifactFinalizer';
import { CanonicalSerializer } from './CanonicalSerializer';
import { EnumValidator } from './EnumValidators';
import { SessionPersistence } from './Sessionpersistence';
import { SessionStateAdapter } from './Sessionstateadapter';
import {
  SessionState,
  TerminalNode,
  FinalizationError,
  ArtifactFinalizationResult,
} from '../types';


export class ArtifactFinalizationService {
  private persistence: SessionPersistence;

  constructor(storage: MMKV) {
    this.persistence = new SessionPersistence(storage);
  }

  initializeSession(flowId: string, flowVersion: string): SessionState {
    return this.persistence.initializeSession(flowId, flowVersion);
  }

  resumeSession(): SessionState | null {
    if (!this.persistence.hasResumableSession()) {
      return null;
    }
    return this.persistence.resumeSession();
  }

  updateSession(sessionState: SessionState): void {
    this.persistence.saveSession(sessionState);
  }

  finalizeArtifact(
    sessionState: SessionState,
    terminalNode: TerminalNode
  ): ArtifactFinalizationResult {
    SessionStateAdapter.validateForFinalization(sessionState);
    const artifactSessionState = SessionStateAdapter.toArtifactSessionState(sessionState);
    const template = terminalNode.artifact;
    const fieldOrder = ArtifactFinalizer.extractFieldOrder(template);
    const finalizationResult = ArtifactFinalizer.finalize(
      template,
      artifactSessionState,
      fieldOrder
    );

    const enumErrors = EnumValidator.validateArtifact(finalizationResult.final_artifact);
    if (enumErrors.length > 0) {
      const errorMessages = enumErrors.map(e => e.message);
      throw new FinalizationError(
        'Enum validation failed after finalization',
        errorMessages
      );
    }

    EnumValidator.normalizeArtifact(finalizationResult.final_artifact);

    return {
      finalization_result: finalizationResult,
      artifact_id: sessionState.artifact_id,
      flow_id: sessionState.flow_id,
      flow_version: sessionState.flow_version,
      session_id: sessionState.session_id,
      finalized_at: new Date().toISOString(),
    };
  }

  async finalizeAndStore(
    sessionState: SessionState,
    terminalNode: TerminalNode,
    onStore: (result: ArtifactFinalizationResult) => Promise<void>
  ): Promise<ArtifactFinalizationResult> {
    const result = this.finalizeArtifact(sessionState, terminalNode);
    await onStore(result);
    this.persistence.clearSession(true); // Preserve artifact_id
    return result;
  }

  verifyDeterminism(
    storedJson: string,
    exportedJson: string
  ): { is_valid: boolean; stored_hash: string; exported_hash: string } {
    const validation = CanonicalSerializer.validateDeterminism(storedJson, exportedJson);
    return {
      is_valid: validation.is_valid,
      stored_hash: validation.stored_hash,
      exported_hash: validation.exported_hash,
    };
  }

  getSessionStats(): {
    has_session: boolean;
    artifact_id: string | null;
    completed: boolean;
    stopped: boolean;
    event_count: number;
  } {
    return this.persistence.getSessionStats();
  }

  exportArtifact(
    storedJson: string,
    artifact: Record<string, any>,
    fieldOrder: string[]
  ): string {
    return CanonicalSerializer.exportWithVerification(storedJson, artifact, fieldOrder);
  }
}