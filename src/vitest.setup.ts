import { vi } from 'vitest';

// Polyfill localStorage if it doesn't exist or is incomplete
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const mockStorage: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    },
    key: (index: number) => {
      const keys = Object.keys(mockStorage);
      return keys[index] || null;
    },
    length: 0,
  };
  Object.defineProperty(storage, 'length', {
    get: () => Object.keys(mockStorage).length,
  });
  Object.defineProperty(global, 'localStorage', {
    value: storage,
    writable: true,
  });
}
