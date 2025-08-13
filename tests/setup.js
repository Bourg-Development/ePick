// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open database connections
  const db = require('../src/db');
  if (db.sequelize) {
    await db.sequelize.close();
  }
});