// jest.setup.js - Jest test setup and configuration

// CRITICAL: Mock uuid FIRST before any code requires it
// This avoids ES6 export syntax errors in CommonJS environment
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${  Math.random().toString(36).substr(2, 9)}`)
}), { virtual: true });

// Set environment to test
process.env.NODE_ENV = 'test';
process.env.DISABLE_EMAIL = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'test-secret';

// mongodb-memory-server fixes (Windows/CI)
// Use stable released version and disable MD5 for unstable CDN or mirrors.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '4.4.18';
process.env.MONGOMS_MD5_CHECK = process.env.MONGOMS_MD5_CHECK || 'false';
// Do not set direct DOWNLOAD_URL. Use fastdl mirror and generated archive names.
process.env.MONGOMS_DOWNLOAD_URL = process.env.MONGOMS_DOWNLOAD_URL || '';
process.env.MONGOMS_DOWNLOAD_MIRROR = process.env.MONGOMS_DOWNLOAD_MIRROR || 'https://fastdl.mongodb.org';
// Force specific download dir to avoid contamination from user cache.
process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR || 'C:\\Users\\User\\Desktop\\Chuka_cribs\\tmp-mongodb-binaries';


// Increase test timeout for slower operations (such as downloading MongoDB binaries)
jest.setTimeout(900000);

// Mock console methods if needed
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
};

// Cleanup after all tests
afterAll(async () => {
  const mongoose = require('mongoose');
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Also close database module if any explicit cleanup path
  const connectDB = require('./config/database');
  if (connectDB && typeof connectDB.close === 'function') {
    await connectDB.close();
  }
});
