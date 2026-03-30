export const FLOW_CHECKSUMS: Record<string, string> = {
  'flow_1_no_power_inside_rv': '0e8e2ad6062f08385e23e4691a3d415fa91091dec62878ad912c2318f2a6e2f6',  // Use React Native's hash
  'flow_2_water_system_issue': 'b6bad7434d9c239037fd89a71383d3fc3263fef70d6ead3d1978a732027d4ef3',
  'flow_3_propane_system_issue': '66e2ab48ee466965473bdacf7a9592ab2e7b3705cfcc9faa9aaf1bcb93731357',
  'flow_4_slides_leveling_issue': '10986c83c3529f8399cc91cfe62c37354499c942df8313f0f4555fea8a3d096a',
};

export class FlowChecksumStore {
  static getChecksum(flowId: string): string | undefined {
    return FLOW_CHECKSUMS[flowId];
  }

  static hasChecksum(flowId: string): boolean {
    return flowId in FLOW_CHECKSUMS;
  }

  static getRegisteredFlows(): string[] {
    return Object.keys(FLOW_CHECKSUMS);
  }

  static validateRegistry(requiredFlowIds: string[]): void {
    const missing = requiredFlowIds.filter(flowId => !this.hasChecksum(flowId));
    
    if (missing.length > 0) {
      throw new Error(
        `Missing checksums for required flows: ${missing.join(', ')}. ` +
        `Run compute_flow_checksums_v1_0.py to generate checksums.`
      );
    }
  }
  
  static registerChecksum(flowId: string, checksum: string): void {
    FLOW_CHECKSUMS[flowId] = checksum.toLowerCase().trim();
  }
}