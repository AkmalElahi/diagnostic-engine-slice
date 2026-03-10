export const FLOW_CHECKSUMS: Record<string, string> = {
  'flow_1_no_power_inside_rv': '450f8a54124d280910f022f59c99ed4053e343bb4ab2f000c72e19ab60af157d',
  'flow_2_water_system_issue': '654e6cd5c07ae2e0f7996fab20b85ff35e3fa13e5026b296ca91efa78883f04f',
  'flow_3_propane_system_issue': '2bcc4dc010a2f29a33576a86cadbd04eb33681871a8c47bf708d1582114cd4f1',
  'flow_4_slides_leveling_issue': 'a9eb27fe0822a1ed09f58a1449a2dae65cc77219bda05f303c396dbbaa8554fd',
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