// Simple test setup without mongodb-memory-server
const mongoose = require('mongoose');

// Setup before all tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  
  // Use test database credentials
  process.env.MONGO_ROOT_USERNAME = 'ecfr_admin';
  process.env.MONGO_ROOT_PASSWORD = 'ecfr_secure_password_2024';
  process.env.MONGO_DATABASE = 'ecfr_test_db';
  process.env.ELASTICSEARCH_PORT = '9200';
});

// Cleanup after all tests
afterAll(async () => {
  // Close MongoDB connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Clear database between tests
afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});