module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '../',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'services/**/src/**/*.js',
    'services/**/routes/**/*.js',
    'services/**/services/**/*.js',
    'services/**/middleware/**/*.js',
    'services/shared/**/*.js',
    '!services/**/node_modules/**',
    '!services/**/coverage/**',
    '!services/**/dist/**',
    '!services/frontend/**' // Frontend tests will use different config
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module paths
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/services/shared/$1'
  },
  
  // Module directories for resolving node_modules
  moduleDirectories: [
    'node_modules',
    '<rootDir>/tests/node_modules',
    '<rootDir>/services/shared/node_modules',
    '<rootDir>/services/backend/node_modules',
    '<rootDir>/services/data-refresh/node_modules',
    '<rootDir>/services/data-analysis/node_modules'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/utils/setup.js'],
  
  // Timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true
};