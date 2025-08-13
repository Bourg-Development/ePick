# Testing Guide

This directory contains all tests for the ePick application.

## Structure

```
tests/
├── unit/               # Unit tests for individual functions/modules
│   ├── services/      # Service layer tests
│   └── utils/         # Utility function tests
├── integration/       # Integration tests for API endpoints
│   └── api/          # API endpoint tests
├── setup.js          # Test setup and configuration
└── README.md         # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

## Writing Tests

### Unit Tests
Unit tests should test individual functions or classes in isolation:

```javascript
describe('FunctionName', () => {
  test('should do something specific', () => {
    const result = functionName(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Integration Tests
Integration tests should test API endpoints with a real or mocked database:

```javascript
describe('API Endpoint', () => {
  test('should respond correctly', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('expected');
  });
});
```

## Test Database

Tests use a separate database configuration defined in `.env.test`. The test database is automatically created and migrated before running integration tests.

## Mocking

Common mocks are set up in `setup.js`:
- Console methods are mocked to reduce noise
- Database connections are properly closed after tests

## Coverage

Test coverage reports are generated in the `coverage/` directory. Aim for:
- 80% overall coverage
- 90% coverage for critical services (auth, token, crypto)
- 100% coverage for utility functions

## CI/CD

Tests run automatically on:
- Every push to main/master/develop branches
- Every pull request
- Can be run manually via GitHub Actions

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Test names should clearly describe what they test
3. **Speed**: Keep tests fast by mocking external dependencies
4. **Coverage**: Write tests for both success and failure cases
5. **Maintenance**: Update tests when changing functionality