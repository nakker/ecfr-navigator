# eCFR Navigator Test Suite

Comprehensive test suite for the eCFR Navigator project with unit, integration, and e2e tests.

## Test Structure

```
tests/
├── unit/                  # Unit tests for individual modules
│   ├── shared/           # Shared module tests
│   │   ├── models/       # Database model tests
│   │   └── utils/        # Utility function tests
│   ├── backend/          # Backend service tests
│   ├── data-refresh/     # Data refresh service tests
│   ├── data-analysis/    # Data analysis service tests
│   └── frontend/         # Frontend component tests
├── integration/          # Integration tests
│   ├── backend/          # API endpoint tests
│   └── services/         # Service interaction tests
├── e2e/                  # End-to-end tests
├── fixtures/             # Test data and mocks
└── utils/                # Test utilities and helpers
```

## Running Tests

### Install Dependencies
```bash
cd tests
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Frontend tests
npm run test:frontend

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Environment

### Backend Tests
- Uses MongoDB Memory Server for database isolation
- Mocks Elasticsearch for search tests
- Runs with NODE_ENV=test

### Frontend Tests
- Uses jsdom for DOM simulation
- Mocks Next.js router
- React Testing Library for component tests

## Key Test Utilities

### TestDataBuilder
Creates consistent test data:
```javascript
const doc = TestDataBuilder.createDocument({
  titleNumber: 1,
  identifier: 'test-doc'
});
```

### DatabaseHelper
Manages test database:
```javascript
await DatabaseHelper.connectMongo(uri);
await DatabaseHelper.clearDatabase();
await DatabaseHelper.seedDatabase(Model, data);
```

### ElasticsearchHelper
Manages test search index:
```javascript
const esHelper = new ElasticsearchHelper();
await esHelper.connect();
await esHelper.createIndex('test_index');
await esHelper.indexDocument('test_index', doc);
```

## Writing New Tests

### Unit Test Example
```javascript
describe('MyModule', () => {
  it('should perform expected behavior', async () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = await myModule.process(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });
});
```

### Integration Test Example
```javascript
describe('API Endpoint', () => {
  it('should return expected response', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
  });
});
```

## Coverage Requirements

- Global: 80% minimum
- Branches: 80% minimum
- Functions: 80% minimum
- Lines: 80% minimum
- Statements: 80% minimum

## CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- GitHub Actions workflow

See `.github/workflows/test.yml` for configuration.

## Troubleshooting

### MongoDB Memory Server Issues
- Ensure sufficient memory available
- Check Node.js version compatibility
- Clear npm cache if download fails

### Elasticsearch Connection
- Verify Elasticsearch is running
- Check port 9200 is available
- Ensure security is disabled for tests

### Test Timeouts
- Default timeout: 30 seconds
- Increase for slow operations
- Use `jest.setTimeout()` for specific tests