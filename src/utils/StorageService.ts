import { createMMKV } from 'react-native-mmkv';
import { SessionState, SessionSummary } from '../types';
import { Platform } from 'react-native';

// Initialize MMKV storage
const storage = createMMKV({
  id: 'rv-diagnostic-engine',
});

const STORAGE_KEYS = {
  SESSION_STATE: 'session_state',
  SESSION_HISTORY: 'session_history',
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
      storage.set(STORAGE_KEYS.SESSION_STATE, json);
    } catch (error) {
      console.error('Error saving session state:', error);
      throw new StorageError('Failed to save session state');
    }
  }

  static loadSessionState(): SessionState | null {
    try {
      const json = storage.getString(STORAGE_KEYS.SESSION_STATE);
      if (!json) return null;
      
      const state = JSON.parse(json) as SessionState;
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
      
      const exists = history.some(s => s.session_id === summary.session_id);
      if (exists) {
        return;
      }
      console.log(`GENERATED SUMMARY FOR THE SESSION ${Platform.OS}`, summary)
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
