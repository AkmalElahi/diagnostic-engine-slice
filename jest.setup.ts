jest.mock('expo-crypto', () => {
  // Counter MUST be inside the mock factory
  let counter = 0;
  
  return {
    randomUUID: jest.fn(() => {
      counter++;
      return `f47ac10b-58cc-4372-a567-0e02b2c3d${String(counter).padStart(3, '0')}`;
    }),
    
    digestStringAsync: jest.fn(async (algorithm: string, data: string) => {
      // Simple deterministic mock SHA-256 hash based on input
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
      }
      // Convert to positive number and pad to 64 hex chars
      const hexHash = Math.abs(hash).toString(16).padStart(64, '0');
      return hexHash;
    }),
    
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
      SHA1: 'SHA-1',
      MD5: 'MD5',
      SHA512: 'SHA-512',
    },
  };
});

// ─── Mock react-native-mmkv ───────────────────────────────────────────────────

jest.mock('react-native-mmkv', () => {
  const storage = new Map<string, string>();
  
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      getString: jest.fn((key: string) => {
        return storage.get(key);
      }),
      delete: jest.fn((key: string) => {
        storage.delete(key);
      }),
      remove: jest.fn((key: string) => {
        storage.delete(key);
      }),
      clearAll: jest.fn(() => {
        storage.clear();
      }),
    })),
    
    createMMKV: jest.fn(() => ({
      set: jest.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      getString: jest.fn((key: string) => {
        return storage.get(key);
      }),
      delete: jest.fn((key: string) => {
        storage.delete(key);
      }),
      remove: jest.fn((key: string) => {
        storage.delete(key);
      }),
      clearAll: jest.fn(() => {
        storage.clear();
      }),
    })),
  };
});

export {};