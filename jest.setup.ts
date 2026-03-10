let uuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => {
    uuidCounter++;
    return `f47ac10b-58cc-4372-a567-0e02b2c3d${String(uuidCounter).padStart(3, '0')}`;
  }),
  digestStringAsync: jest.fn(async (algorithm: string, data: string) => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  })),
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

export {};