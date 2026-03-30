import { RigIdentity } from '../types';
import { createMMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';

export class RigIdentityService {
  private static readonly STORAGE_KEY = 'rig_identity';
  private static storage = createMMKV({ id: 'rv-diagnostic-engine' });

  static getOrCreate(): RigIdentity {
    const existing = this.storage.getString(this.STORAGE_KEY);
    
    if (existing) {
      try {
        return JSON.parse(existing) as RigIdentity;
      } catch (error) {
        console.error('[RigIdentityService] Failed to parse stored identity, creating new:', error);
        // Corrupted data - create fresh identity
      }
    }
    
    const newIdentity: RigIdentity = {
      id: Crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    
    this.storage.set(this.STORAGE_KEY, JSON.stringify(newIdentity));
    
    console.log('[RigIdentityService] Created new rig identity:', newIdentity.id);
    return newIdentity;
  }

  static update(updates: Partial<Omit<RigIdentity, 'id' | 'created_at'>>): void {
    const current = this.getOrCreate();
    
    const updated: RigIdentity = {
      ...current,
      ...updates,
      // Prevent overwriting immutable fields
      id: current.id,
      created_at: current.created_at,
    };
    
    this.storage.set(this.STORAGE_KEY, JSON.stringify(updated));
    console.log('[RigIdentityService] Updated rig identity');
  }

  static get(): RigIdentity | null {
    const existing = this.storage.getString(this.STORAGE_KEY);
    if (!existing) return null;
    
    try {
      return JSON.parse(existing) as RigIdentity;
    } catch {
      return null;
    }
  }

  static clear(): void {
    this.storage.remove(this.STORAGE_KEY);
    console.warn('[RigIdentityService] Rig identity cleared - all artifacts orphaned!');
  }
}