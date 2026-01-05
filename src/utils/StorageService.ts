import { createMMKV } from 'react-native-mmkv';
import { SessionState, SessionSummary } from '../types';

// Initialize MMKV storage
const storage = createMMKV({
  id: 'rv-diagnostic-engine',
  encryptionKey: undefined,
});

const STORAGE_KEYS = {
  SESSION_STATE: 'session_state',
  SESSION_HISTORY: 'session_history',
} as const;

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
      throw new Error('Failed to save session state');
    }
  }

  static loadSessionState(): SessionState | null {
    try {
      const json = storage.getString(STORAGE_KEYS.SESSION_STATE);
      if (!json) return null;
      return JSON.parse(json) as SessionState;
    } catch (error) {
      console.error('Error loading session state:', error);
      return null;
    }
  }

  static clearSessionState(): void {
    try {
      storage.remove(STORAGE_KEYS.SESSION_STATE);
    } catch (error) {
      console.error('Error clearing session state:', error);
    }
  }

  static saveSessionSummary(summary: SessionSummary): void {
    try {
      const history = this.getSessionHistory();
      history.push(summary);
      storage.set(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving session summary:', error);
      throw new Error('Failed to save session summary');
    }
  }

  static getSessionHistory(): SessionSummary[] {
    try {
      const json = storage.getString(STORAGE_KEYS.SESSION_HISTORY);
      if (!json) return [];
      return JSON.parse(json) as SessionSummary[];
    } catch (error) {
      console.error('Error loading session history:', error);
      return [];
    }
  }

  static clearSessionHistory(): void {
    try {
      storage.remove(STORAGE_KEYS.SESSION_HISTORY);
    } catch (error) {
      console.error('Error clearing session history:', error);
    }
  }

  static clearAll(): void {
    try {
      storage.clearAll();
    } catch (error) {
      console.error('Error clearing all storage:', error);
    }
  }
}
