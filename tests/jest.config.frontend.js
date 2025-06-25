module.exports = {
  // Test environment for React
  testEnvironment: 'jsdom',
  
  // Root directory
  rootDir: '../services/frontend',
  
  // Module name mapper for TypeScript paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/../../tests/utils/setupFrontend.js'],
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: ['next/babel']
    }]
  },
  
  // Test patterns
  testMatch: [
    '<rootDir>/../../tests/unit/frontend/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/../../tests/integration/frontend/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  
  // Coverage
  collectCoverageFrom: [
    'components/**/*.(js|jsx|ts|tsx)',
    'pages/**/*.(js|jsx|ts|tsx)',
    'utils/**/*.(js|jsx|ts|tsx)',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$'
  ]
};