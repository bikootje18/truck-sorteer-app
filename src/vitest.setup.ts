// Node's built-in localStorage stub shadows jsdom's Storage in vitest; provide a functional in-memory one.
if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  // Create a mock storage object that wraps the original
  const data: Record<string, string> = {};

  // Copy existing data
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) data[key] = localStorage.getItem(key) || '';
  }

  const mockStorage = {
    clear: function() {
      Object.keys(data).forEach(key => delete data[key]);
    },
    getItem: function(key: string) {
      return data[key] ?? null;
    },
    setItem: function(key: string, value: string) {
      data[key] = String(value);
    },
    removeItem: function(key: string) {
      delete data[key];
    },
    key: function(index: number) {
      return Object.keys(data)[index] ?? null;
    },
  };

  Object.defineProperty(mockStorage, 'length', {
    get: function() {
      return Object.keys(data).length;
    },
    configurable: true,
  });

  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}
