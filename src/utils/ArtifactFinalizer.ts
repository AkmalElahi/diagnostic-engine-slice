import { CanonicalSerializer } from './CanonicalSerializer';
import {
  SessionState,
  TerminalArtifactTemplate,
  FieldMapping,
  FinalizationResult,
  FinalizationError,
  DEFAULT_STRINGS,
  REQUIRED_BASE_FIELDS,
  REQUIRED_SUFFIX_FIELDS,
  ArtifactSessionState,
} from '../types';

export class ArtifactFinalizer {
  private static ARTIFACT_SCHEMA_VERSION = '1.0';
  static async finalize(
    terminalArtifactTemplate: TerminalArtifactTemplate,
    sessionState: ArtifactSessionState,
    fieldOrder: string[],
    fieldMappings?: FieldMapping[],
  ): Promise<FinalizationResult> {
    const warnings: string[] = [];
    const finalArtifact = this.buildFinalArtifact(
      terminalArtifactTemplate,
      sessionState,
      fieldMappings,
    );
    this.validateRequiredFields(finalArtifact);
    this.enforceNonEmptyArrays(finalArtifact, warnings);
    this.validateNoPlaceholders(finalArtifact);
    this.validateFieldOrdering(finalArtifact, fieldOrder);
    const { canonical_json, sha256_hash } = await CanonicalSerializer.serialize(
      finalArtifact,
      fieldOrder,
      true,
    );

    const finalArtifactWithHash = JSON.parse(canonical_json);

    return {
      final_artifact: finalArtifactWithHash,
      canonical_json: canonical_json,
      sha256_hash: sha256_hash,
      warnings,
    };
  }

  private static buildFinalArtifact(
    template: TerminalArtifactTemplate,
    sessionState: ArtifactSessionState,
    fieldMappings?: FieldMapping[],
  ): Record<string, any> {
    const artifact: Record<string, any> = {};

    artifact.artifact_id = sessionState.artifact_id;
    artifact.artifact_hash = ''; // Will be computed by CanonicalSerializer
    artifact.vertical_id = template.vertical_id;
    artifact.issue = template.issue;
    artifact.flow_id = sessionState.flow_id;
    artifact.flow_version = sessionState.flow_version;
    artifact.artifact_schema_version = this.ARTIFACT_SCHEMA_VERSION;
    artifact.stop_reason = sessionState.stop_reason;
    artifact.last_confirmed_state = sessionState.last_confirmed_state;

    if (fieldMappings) {
      for (const mapping of fieldMappings) {
        artifact[mapping.artifact_field] = this.getFieldValue(
          mapping,
          sessionState,
        );
      }
    } else {
      for (const [key, value] of Object.entries(template)) {
        if (
          !REQUIRED_BASE_FIELDS.includes(key as any) &&
          !REQUIRED_SUFFIX_FIELDS.includes(key as any)
        ) {
          artifact[key] = value;
        }
      }
    }

    artifact.safety_notes = [...(template.safety_notes || [])];
    artifact.stabilization_actions = [
      ...(template.stabilization_actions || []),
    ];
    artifact.recommendations = [...(template.recommendations || [])];
    artifact.notes = template.notes || '';

    return artifact;
  }

  private static getFieldValue(
    mapping: FieldMapping,
    sessionState: ArtifactSessionState,
  ): any {
    const executedNode = sessionState.executed_nodes.find(
      (node) => node.node_id === mapping.source_node_id,
    );

    if (!executedNode) {
      return this.getUnknownValue(mapping.field_type);
    }

    if (mapping.source_node_id in sessionState.answers) {
      return sessionState.answers[mapping.source_node_id];
    }

    if (mapping.source_node_id in sessionState.measurements) {
      const value = sessionState.measurements[mapping.source_node_id];
      return value; // Can be number or null
    }

    return this.getUnknownValue(mapping.field_type);
  }

  private static getUnknownValue(fieldType: string): any {
    switch (fieldType) {
      case 'string':
      case 'enum':
        return 'Unknown';
      case 'number':
        return null;
      case 'array':
        return [];
      default:
        return 'Unknown';
    }
  }

  private static validateRequiredFields(artifact: Record<string, any>): void {
    const errors: string[] = [];

    for (const field of REQUIRED_BASE_FIELDS) {
      if (!(field in artifact)) {
        errors.push(`Missing required base field: ${field}`);
      }
    }

    for (const field of REQUIRED_SUFFIX_FIELDS) {
      if (!(field in artifact)) {
        errors.push(`Missing required suffix field: ${field}`);
      }
    }

    if (errors.length > 0) {
      throw new FinalizationError('Required field validation failed', errors);
    }
  }

  private static enforceNonEmptyArrays(
    artifact: Record<string, any>,
    warnings: string[],
  ): void {
    // Enforce stabilization_actions non-empty
    if (
      !Array.isArray(artifact.stabilization_actions) ||
      artifact.stabilization_actions.length === 0
    ) {
      warnings.push('stabilization_actions was empty, injected default');
      artifact.stabilization_actions = [DEFAULT_STRINGS.STABILIZATION_ACTION];
    }
    if (
      !Array.isArray(artifact.recommendations) ||
      artifact.recommendations.length === 0
    ) {
      warnings.push('recommendations was empty, injected default');
      artifact.recommendations = [DEFAULT_STRINGS.RECOMMENDATION];
    }
  }

  private static validateNoPlaceholders(artifact: Record<string, any>): void {
    const errors: string[] = [];
    const placeholderPattern = /\{\{[^}]+\}\}/;

    const checkValue = (value: any, path: string) => {
      if (typeof value === 'string') {
        if (placeholderPattern.test(value)) {
          errors.push(`Placeholder token found at ${path}: ${value}`);
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          checkValue(item, `${path}[${idx}]`);
        });
      } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    for (const [key, value] of Object.entries(artifact)) {
      checkValue(value, key);
    }

    if (errors.length > 0) {
      throw new FinalizationError(
        'Placeholder token validation failed - final artifact must contain zero double brace tokens',
        errors,
      );
    }
  }

  private static validateFieldOrdering(
    artifact: Record<string, any>,
    fieldOrder: string[],
  ): void {
    const artifactKeys = Object.keys(artifact);
    const errors: string[] = [];

    for (const key of artifactKeys) {
      if (!fieldOrder.includes(key)) {
        errors.push(`Field ${key} not in canonical field order`);
      }
    }

    if (errors.length > 0) {
      throw new FinalizationError('Field ordering validation failed', errors);
    }
  }

  static extractFieldOrder(template: TerminalArtifactTemplate): string[] {
    const fieldOrder: string[] = [];

    fieldOrder.push(
      'artifact_id',
      'artifact_hash',
      'vertical_id',
      'issue',
      'flow_id',
      'flow_version',
      'artifact_schema_version',
      'stop_reason',
      'last_confirmed_state',
    );

    // Add flow-specific fields (everything except base and suffix)
    for (const key of Object.keys(template)) {
      if (
        !REQUIRED_BASE_FIELDS.includes(key as any) &&
        !REQUIRED_SUFFIX_FIELDS.includes(key as any)
      ) {
        fieldOrder.push(key);
      }
    }

    fieldOrder.push(
      'safety_notes',
      'stabilization_actions',
      'recommendations',
      'notes',
    );

    return fieldOrder;
  }
}
