import { createMMKV } from 'react-native-mmkv';
import { EquipmentItem, SessionState, SessionSummary } from '../types';

// Initialize MMKV storage
const storage = createMMKV({
  id: 'rv-diagnostic-engine',
});

const STORAGE_KEYS = {
  SESSION_STATE: 'session_state',
  SESSION_HISTORY: 'session_history',
  PROFILE_COMPLETED: 'rv_profile_completed',
  EQUIPMENT_INVENTORY: 'equipment_inventory',
} as const;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage service for offline-first persistence using MMKV
 */
export class StorageService {
  static saveSessionState(state: SessionState): void {
    try {
      const json = JSON.stringify(state);
      // console.log("STORING SESSION FOR SESSION ID", state.session_id)
      storage.set(STORAGE_KEYS.SESSION_STATE, json);
    } catch (error) {
      console.error('Error saving session state:', error);
      throw new StorageError('Failed to save session state');
    }
  }

  static getProfileCompleted(): boolean {
    try {
      return storage.getBoolean(STORAGE_KEYS.PROFILE_COMPLETED) ?? false;
    } catch (error) {
      console.error(
        '[StorageService] Failed to get profile completion status:',
        error,
      );
      return false;
    }
  }

  static setProfileCompleted(completed: boolean): void {
    try {
      storage.set(STORAGE_KEYS.PROFILE_COMPLETED, completed);
      console.log('[StorageService] Profile completion status set:', completed);
    } catch (error) {
      console.error(
        '[StorageService] Failed to set profile completion status:',
        error,
      );
    }
  }

  static resetProfileCompletion(): void {
    try {
      storage.remove(STORAGE_KEYS.PROFILE_COMPLETED);
      console.log('[StorageService] Profile completion status reset');
    } catch (error) {
      console.error(
        '[StorageService] Failed to reset profile completion status:',
        error,
      );
    }
  }

  static getEquipmentInventory(): EquipmentItem[] {
    try {
      const data = storage.getString(STORAGE_KEYS.EQUIPMENT_INVENTORY);
      if (!data) return [];
      
      return JSON.parse(data) as EquipmentItem[];
    } catch (error) {
      console.error('[StorageService] Failed to get equipment inventory:', error);
      return [];
    }
  }

  static saveEquipmentInventory(items: EquipmentItem[]): void {
    try {
      storage.set(STORAGE_KEYS.EQUIPMENT_INVENTORY, JSON.stringify(items));
      console.log('[StorageService] Equipment inventory saved:', items.length, 'items');
    } catch (error) {
      console.error('[StorageService] Failed to save equipment inventory:', error);
      throw error;
    }
  }

  static clearEquipmentInventory(): void {
    try {
      storage.remove(STORAGE_KEYS.EQUIPMENT_INVENTORY);
      console.log('[StorageService] Equipment inventory cleared');
    } catch (error) {
      console.error('[StorageService] Failed to clear equipment inventory:', error);
    }
  }

  static loadSessionState(): SessionState | null {
    try {
      const json = storage.getString(STORAGE_KEYS.SESSION_STATE);
      if (!json) return null;

      const state = JSON.parse(json) as SessionState;
      // console.log("LOAD SESSION FOR SESSION ID", state.session_id)
      return state;
    } catch (error) {
      return null;
    }
  }

  static clearSessionState(): void {
    try {
      storage.remove(STORAGE_KEYS.SESSION_STATE);
    } catch (error) {
      throw new StorageError('Failed to clear session state');
    }
  }

  static saveSessionSummary(summary: SessionSummary): void {
    try {
      const history = this.getSessionHistory();

      const exists = history.some((s) => s.session_id === summary.session_id);
      if (exists) {
        return;
      }
      // console.log(`GENERATED FINAL SUMMARY FOR SESSION ID ${summary.session_id}`, summary)
      history.push(summary);
      storage.set(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
    } catch (error) {
      throw new StorageError('Failed to save session summary');
    }
  }

  static getSessionHistory(): SessionSummary[] {
    try {
      const json = storage.getString(STORAGE_KEYS.SESSION_HISTORY);
      if (!json) return [];
      return JSON.parse(json) as SessionSummary[];
    } catch (error) {
      return [];
    }
  }

  static clearSessionHistory(): void {
    try {
      storage.remove(STORAGE_KEYS.SESSION_HISTORY);
    } catch (error) {
      throw new StorageError('Failed to clear session history');
    }
  }

  static clearAll(): void {
    try {
      storage.clearAll();
    } catch (error) {
      throw new StorageError('Failed to clear all storage');
    }
  }
}
