import { MaintenanceEntry, MaintenanceArtifact, MaintenanceType } from '../types';
import { RigIdentityService } from '../services/RigIdentityService';
import { StorageService } from '../services/StorageService';
import * as Crypto from 'expo-crypto';

export class MaintenanceService {
  static getAllMaintenanceEntries(): MaintenanceEntry[] {
    try {
      const entries = StorageService.getMaintenanceHistory();
      
      const currentRig = RigIdentityService.getOrCreate();
      return entries
        .filter((entry:any) => entry.rig_id === currentRig.id)
        .sort((a:any, b:any) => {
          const dateA = new Date(b.artifact.maintenance_date).getTime();
          const dateB = new Date(a.artifact.maintenance_date).getTime();
          return dateA - dateB;
        });
        
    } catch (error) {
      console.error('[MaintenanceService] Failed to get maintenance entries:', error);
      return [];
    }
  }

  static getEntryById(id: string): MaintenanceEntry | null {
    const entries = this.getAllMaintenanceEntries();
    return entries.find(entry => entry.id === id) || null;
  }

  static getEntriesByType(type: MaintenanceType): MaintenanceEntry[] {
    return this.getAllMaintenanceEntries().filter(
      entry => entry.artifact.maintenance_type === type
    );
  }

  static getEntriesByEquipment(equipmentId: string): MaintenanceEntry[] {
    return this.getAllMaintenanceEntries().filter(
      entry => entry.artifact.equipment_id === equipmentId
    );
  }

  static addMaintenanceEntry(
    data: Omit<MaintenanceArtifact, 
      'maintenance_artifact_schema_version' | 
      'creator_name' | 
      'creator_type' | 
      'date_time' | 
      'rig_identity'
    >
  ): MaintenanceEntry {
    try {
      const currentRig = RigIdentityService.getOrCreate();
      const now = new Date().toISOString();
      const artifact: MaintenanceArtifact = {
        maintenance_artifact_schema_version: '1.0',
        creator_name: currentRig.custom_name || 'Owner',
        creator_type: 'OWNER',
        date_time: now,
        rig_identity: currentRig.id,
        ...data,
      };
      
      // Create maintenance entry
      const entry: MaintenanceEntry = {
        id: Crypto.randomUUID(),
        rig_id: currentRig.id,
        created_at: now,
        artifact,
      };
      
      // Save to storage
      const entries = StorageService.getMaintenanceHistory();
      entries.push(entry);
      StorageService.saveMaintenanceHistory(entries);
      
      console.log('[MaintenanceService] Added maintenance entry:', entry.id, data.maintenance_type);
      return entry;
      
    } catch (error) {
      console.error('[MaintenanceService] Failed to add maintenance entry:', error);
      throw new Error('Failed to add maintenance entry');
    }
  }

  static updateMaintenanceEntry(
    id: string,
    updates: Partial<Omit<MaintenanceArtifact, 
      'maintenance_artifact_schema_version' | 
      'creator_name' | 
      'creator_type' | 
      'date_time' | 
      'rig_identity'
    >>
  ): MaintenanceEntry | null {
    try {
      const entries = StorageService.getMaintenanceHistory();
      const index = entries.findIndex(entry => entry.id === id);
      
      if (index === -1) {
        console.warn('[MaintenanceService] Maintenance entry not found:', id);
        return null;
      }
      
      // Update artifact with new data
      entries[index].artifact = {
        ...entries[index].artifact,
        ...updates,
      };
      
      StorageService.saveMaintenanceHistory(entries);
      
      console.log('[MaintenanceService] Updated maintenance entry:', id);
      return entries[index];
      
    } catch (error) {
      console.error('[MaintenanceService] Failed to update maintenance entry:', error);
      throw new Error('Failed to update maintenance entry');
    }
  }

  static deleteMaintenanceEntry(id: string): boolean {
    try {
      const entries = StorageService.getMaintenanceHistory();
      const filteredEntries = entries.filter(entry => entry.id !== id);
      
      if (filteredEntries.length === entries.length) {
        console.warn('[MaintenanceService] Maintenance entry not found:', id);
        return false;
      }
      
      StorageService.saveMaintenanceHistory(filteredEntries);
      
      console.log('[MaintenanceService] Deleted maintenance entry:', id);
      return true;
      
    } catch (error) {
      console.error('[MaintenanceService] Failed to delete maintenance entry:', error);
      throw new Error('Failed to delete maintenance entry');
    }
  }

  static getMaintenanceCount(): number {
    return this.getAllMaintenanceEntries().length;
  }

  static getMaintenanceCountsByType(): Record<MaintenanceType, number> {
    const entries = this.getAllMaintenanceEntries();
    
    return {
      REPAIR: entries.filter(e => e.artifact.maintenance_type === 'REPAIR').length,
      UPGRADE: entries.filter(e => e.artifact.maintenance_type === 'UPGRADE').length,
      PREVENTATIVE: entries.filter(e => e.artifact.maintenance_type === 'PREVENTATIVE').length,
      INSTALLATION: entries.filter(e => e.artifact.maintenance_type === 'INSTALLATION').length,
    };
  }

  static clearAllMaintenanceEntries(): void {
    try {
      StorageService.clearMaintenanceHistory();
      console.log('[MaintenanceService] All maintenance entries cleared');
    } catch (error) {
      console.error('[MaintenanceService] Failed to clear maintenance entries:', error);
    }
  }
}