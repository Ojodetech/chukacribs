// Mock uuid before any tests run to avoid ES6 export issues
jest.mock('uuid', () => ({
  v4: () => `test-uuid-${  Math.random().toString(36).substr(2, 9)}`
}), { virtual: true });
