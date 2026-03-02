const path = require('path');

const testsDir = path.resolve(__dirname, 'api');

module.exports = {
  // Root directory for resolving
  rootDir: path.resolve(__dirname, '../..'),
  
  // Explicit roots so Jest finds both source and test files
  roots: [
    '<rootDir>/backend/src',
    '<rootDir>/tests/backend'
  ],

  // Test files location — use absolute glob
  testMatch: [
    path.resolve(testsDir, '**/*.test.js').replace(/\\/g, '/')
  ],

  // Setup files
  globalSetup: path.resolve(__dirname, 'setup/globalSetup.js'),
  globalTeardown: path.resolve(__dirname, 'setup/globalTeardown.js'),
  setupFiles: [
    path.resolve(__dirname, 'setup/envSetup.js')
  ],

  // Test environment
  testEnvironment: 'node',
  
  // Timeout for async tests (30s for DB operations)
  testTimeout: 30000,

  // Coverage
  collectCoverageFrom: [
    'backend/src/controllers/**/*.js',
    'backend/src/middleware/**/*.js',
    'backend/src/models/**/*.js',
    'backend/src/services/**/*.js',
    'backend/src/routes/**/*.js',
    '!**/*.test.js'
  ],
  coverageDirectory: path.resolve(__dirname, 'coverage'),
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],

  // Module resolution
  moduleDirectories: ['node_modules', 'backend/node_modules'],

  // Verbose output
  verbose: true,

  // Run tests serially to avoid DB conflicts
  maxWorkers: 1,

  // Transform (no transform needed for Node.js)
  transform: {},

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};
