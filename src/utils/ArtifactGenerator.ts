import tierClassificationData from './tier-classification.json';
import explanationTemplates from './explanation-templates.json';

enum PriorityTier {
  DIRECT_FAILURE = 1,
  STRONG_INDICATOR = 2,
  SUPPORTING_SYMPTOM = 3,
  UNKNOWN = 4
}

type ConfidenceLevel = 
  | "Strongly suggests"
  | "Suggests"
  | "Could not identify a clear cause";

interface Finding {
  tier: PriorityTier;
  nodeId: string;
  description: string;
  value: string;
  findingKey: string;
  recommendation?: string;
}

interface VoltageInterpretation {
  voltage: number;
  isNormal: boolean;
  isLow: boolean;
  interpretation: string;
}

interface TierClassificationEntry {
  tier: number;
  condition: {
    value: string;
  };
  description: string;
  finding_key: string;
  recommendation: string;
}

interface SessionEvent {
  node_id: string;
  type: 'ANSWER' | 'MEASURE' | 'SAFETY' | 'STOP';
  value: string;
  timestamp: string;
  node_text?: string;
  result_text?: string;
}

interface SessionState {
  sessionId: string;
  flowId: string;
  flowVersion: string;
  currentNodeId: string;
  events: SessionEvent[];
  startTime: string;
  lastUpdateTime: string;
  isComplete: boolean;
  finalizedArtifact?: Artifact;
}

interface Flow {
  flow_id: string;
  flow_version: string;
  flow_name: string;
  nodes: Record<string, FlowNode>;
}

interface FlowNode {
  node_id: string;
  type: string;
  text: string;
  answers?: string[];
  next?: Record<string, string>;
  safety_notes?: string;
}

interface Artifact {
  artifact_schema_version: string;
  flow_id: string;
  flow_version: string;
  session_id: string;
  timestamp: string;
  result: {
    confidence_level: ConfidenceLevel;
    primary_finding: string;
    explanation: string;
    recommended_next_step: string;
  };
}

export class ArtifactGenerator {
  
  private tierClassifications: Record<string, TierClassificationEntry>;
  private explanations: Record<string, string>;
  
  constructor() {
    this.tierClassifications = tierClassificationData as Record<string, TierClassificationEntry>;
    this.explanations = explanationTemplates as Record<string, string>;
  }

  public generate(sessionState: SessionState, flowData: Flow): Artifact {
    
    if (this.checkStopCondition(sessionState)) {
      return this.buildStopArtifact(sessionState, flowData);
    }

    const findings = this.classifyFindings(sessionState, flowData);
    const primaryFinding = this.selectPrimaryFinding(findings);

    if (!primaryFinding) {
      return this.buildNoFindingArtifact(sessionState, flowData);
    }

    const confidence = this.assignConfidence(primaryFinding, findings, sessionState);

    const voltage = this.extractBatteryVoltage(sessionState);
    const voltageInterpretation = voltage !== null
      ? this.interpretBatteryVoltage(voltage, primaryFinding)
      : null;

    const explanation = this.buildExplanation(
      primaryFinding,
      voltageInterpretation,
      findings
    );

    const nextStep = this.getCrossSystemRecommendation(primaryFinding, flowData)
      || primaryFinding.recommendation
      || "Contact a qualified RV technician for further diagnosis and repair";

    return this.buildArtifactOutput(
      sessionState,
      flowData,
      primaryFinding,
      confidence,
      explanation,
      nextStep
    );
  }

  private classifyFindings(sessionState: SessionState, flowData: Flow): Finding[] {
    const findings: Finding[] = [];

    for (const event of sessionState.events) {
      if (event.type !== 'ANSWER' && event.type !== 'MEASURE') {
        continue;
      }

      const tier = this.getTierForResponse(event.node_id, event.value);
      
      if (tier === null || tier === PriorityTier.UNKNOWN) {
        continue;
      }

      const classification = this.tierClassifications[event.node_id];
      
      findings.push({
        tier,
        nodeId: event.node_id,
        description: classification.description,
        value: event.value,
        findingKey: classification.finding_key,
        recommendation: classification.recommendation
      });
    }

    const voltage = this.extractBatteryVoltage(sessionState);
    if (voltage !== null && voltage <= 12.0) {
      findings.push({
        tier: PriorityTier.STRONG_INDICATOR,
        nodeId: 'battery_voltage',
        description: 'Low battery condition',
        value: voltage.toString(),
        findingKey: 'low_battery',
        recommendation: 'Charge or replace the house battery and retest systems'
      });
    }

    return findings;
  }

  private selectPrimaryFinding(findings: Finding[]): Finding | null {
    if (findings.length === 0) {
      return null;
    }

    const sorted = [...findings].sort((a, b) => a.tier - b.tier);

    return sorted[0];
  }

  private getTierForResponse(nodeId: string, value: string): PriorityTier | null {
    
    if (value === "Not sure") {
      return PriorityTier.UNKNOWN;
    }

    const classification = this.tierClassifications[nodeId];
    
    if (!classification) {
      return null;
    }

    if (classification.condition.value === value) {
      return classification.tier as PriorityTier;
    }

    return null;
  }

  private assignConfidence(
    primaryFinding: Finding,
    allFindings: Finding[],
    sessionState: SessionState
  ): ConfidenceLevel {
    
    const notSureCount = this.countNotSureResponses(sessionState);
    const hasConflicts = this.hasConflictingSignals(allFindings, sessionState);

    if (notSureCount >= 3) {
      return "Could not identify a clear cause";
    }

    if (primaryFinding.tier === PriorityTier.UNKNOWN) {
      return "Could not identify a clear cause";
    }

    const strongFindings = allFindings.filter(
      f => f.tier <= PriorityTier.STRONG_INDICATOR
    );

    if (strongFindings.length >= 2 && !hasConflicts && notSureCount === 0) {
      return "Strongly suggests";
    }

    if (hasConflicts || notSureCount >= 1) {
      return "Suggests";
    }

    return "Suggests";
  }

  private countNotSureResponses(sessionState: SessionState): number {
    return sessionState.events.filter(
      event => event.value === "Not sure"
    ).length;
  }

  private hasConflictingSignals(findings: Finding[], sessionState: SessionState): boolean {
    
    const voltage = this.extractBatteryVoltage(sessionState);
    if (voltage !== null && voltage >= 12.6 && voltage <= 12.8) {
      const hasSymptoms = findings.some(f => f.tier === PriorityTier.SUPPORTING_SYMPTOM);
      if (hasSymptoms) {
        return true;
      }
    }

    const strongFindings = findings.filter(f => f.tier <= PriorityTier.STRONG_INDICATOR);
    if (strongFindings.length > 1) {
      const uniqueKeys = new Set(strongFindings.map(f => f.findingKey.split('_')[0]));
      if (uniqueKeys.size > 1) {
        return true;
      }
    }

    return false;
  }

  private getCrossSystemRecommendation(
    primaryFinding: Finding,
    flowData: Flow
  ): string | null {
    
    const flowId = flowData.flow_id;
    const findingKey = primaryFinding.findingKey;

    if (flowId === 'water_system' && findingKey.includes('pump_no_power')) {
      return "Run the Electrical diagnostic to check power supply to the pump";
    }

    if (flowId === 'propane_system' && findingKey.includes('no_control_power')) {
      return "Run the Electrical diagnostic to check control power";
    }

    if (flowId === 'slides_leveling' && findingKey.includes('weak_power')) {
      return "Run the Electrical diagnostic to check system power";
    }

    if (flowId === 'slides_leveling' && findingKey.includes('not_level')) {
      return "Run the Leveling diagnostic to verify RV is level";
    }

    if (flowId === 'water_system' && findingKey.includes('freeze')) {
      return "Check heating system for freeze protection";
    }

    return null;
  }

  private extractBatteryVoltage(sessionState: SessionState): number | null {
    const voltageEvent = sessionState.events.find(
      event => event.type === 'MEASURE' && event.node_id === '1.8'
    );

    if (!voltageEvent) {
      return null;
    }

    const voltage = parseFloat(voltageEvent.value);
    return isNaN(voltage) ? null : voltage;
  }

  private interpretBatteryVoltage(
    voltage: number,
    primaryFinding: Finding
  ): VoltageInterpretation {
    
    const isNormal = voltage >= 12.6 && voltage <= 12.8;
    const isLow = voltage <= 12.0;

    let interpretation = "";

    if (isNormal) {
      interpretation = `Battery voltage (${voltage.toFixed(1)}V) appears normal.`;
      
      if (primaryFinding.tier === PriorityTier.SUPPORTING_SYMPTOM) {
        interpretation += " However, symptoms suggest investigating further.";
      }
    }

    if (isLow) {
      interpretation = `Battery voltage (${voltage.toFixed(1)}V) is below normal range, indicating a low battery condition.`;
    }

    if (!isNormal && !isLow) {
      interpretation = `Battery voltage (${voltage.toFixed(1)}V) is below optimal range.`;
    }

    return {
      voltage,
      isNormal,
      isLow,
      interpretation
    };
  }

  private buildExplanation(
    primaryFinding: Finding,
    voltageInterpretation: VoltageInterpretation | null,
    allFindings: Finding[]
  ): string {
    
    const baseExplanation = this.explanations[primaryFinding.findingKey] 
      || primaryFinding.description;

    let explanation = baseExplanation;

    if (voltageInterpretation) {
      explanation += ` ${voltageInterpretation.interpretation}`;
    }

    const supportingFindings = allFindings.filter(
      f => f.nodeId !== primaryFinding.nodeId && f.tier <= PriorityTier.SUPPORTING_SYMPTOM
    );

    if (supportingFindings.length > 0 && supportingFindings.length <= 2) {
    }

    return explanation;
  }

  private buildArtifactOutput(
    sessionState: SessionState,
    flowData: Flow,
    primaryFinding: Finding,
    confidence: ConfidenceLevel,
    explanation: string,
    nextStep: string
  ): Artifact {
    
    return {
      artifact_schema_version: "1.0",
      flow_id: flowData.flow_id,
      flow_version: flowData.flow_version,
      session_id: sessionState.sessionId,
      timestamp: new Date().toISOString(),
      
      result: {
        confidence_level: confidence,
        primary_finding: primaryFinding.description,
        explanation: explanation,
        recommended_next_step: nextStep
      }
    };
  }

  private buildNoFindingArtifact(sessionState: SessionState, flowData: Flow): Artifact {
    return {
      artifact_schema_version: "1.0",
      flow_id: flowData.flow_id,
      flow_version: flowData.flow_version,
      session_id: sessionState.sessionId,
      timestamp: new Date().toISOString(),
      
      result: {
        confidence_level: "Could not identify a clear cause",
        primary_finding: "Unable to determine cause",
        explanation: "The diagnostic was unable to identify a clear cause based on the responses provided.",
        recommended_next_step: "Contact a qualified RV technician for further diagnosis and repair"
      }
    };
  }

  private checkStopCondition(sessionState: SessionState): boolean {
    return sessionState.events.some(event => event.type === 'STOP');
  }

  private buildStopArtifact(sessionState: SessionState, flowData: Flow): Artifact {
    return {
      artifact_schema_version: "1.0",
      flow_id: flowData.flow_id,
      flow_version: flowData.flow_version,
      session_id: sessionState.sessionId,
      timestamp: new Date().toISOString(),
      
      result: {
        confidence_level: "Strongly suggests",
        primary_finding: "Diagnostic stopped",
        explanation: "Do not continue. A potential safety concern was identified during this diagnostic. Further inspection is recommended before continuing.",
        recommended_next_step: "Contact a qualified RV technician immediately"
      }
    };
  }
}

export const artifactGenerator = new ArtifactGenerator();