# MOOE Table Component Tests

This directory contains comprehensive tests for the MOOE (Maintenance and Other Operating Expenses) table components.

## Test Structure

### 📁 Test Files

- **`MooeTable.test.jsx`** - Unit tests for the main MOOE table component
- **`MooeRow.test.jsx`** - Unit tests for individual table rows
- **`integration.test.jsx`** - Integration tests for complete workflows
- **`setup.js`** - Test configuration and utilities
- **`README.md`** - This documentation file

## 🧪 Test Coverage

### MooeTable Component Tests

#### ✅ Core Functionality
- [x] Loading state rendering
- [x] Error state handling with retry functionality
- [x] Data table rendering with proper headers
- [x] Search functionality across multiple fields
- [x] Save functionality with validation
- [x] Auto-save toggle and timer functionality
- [x] Export to CSV with enhanced formatting
- [x] Import from CSV with validation
- [x] Input validation (negative values, large numbers)

#### ✅ User Interactions
- [x] Search input changes
- [x] Filter button interactions
- [x] Expand/collapse all functionality
- [x] Auto-save switch toggle
- [x] Export button click
- [x] Import file selection
- [x] Save button with validation checks

#### ✅ Data Management
- [x] Query invalidation on region change
- [x] State synchronization
- [x] Validation error display
- [x] Unsaved changes tracking
- [x] Last saved timestamp

### MooeRow Component Tests

#### ✅ Display Logic
- [x] Parent row rendering with totals
- [x] Child row rendering when expanded
- [x] Currency formatting (₱ symbol, commas, decimals)
- [x] Status-based input enabling/disabling
- [x] Custom entry title editing

#### ✅ Interactions
- [x] Expand/collapse toggle
- [x] Income input changes
- [x] Subsidy input changes
- [x] Add Other MOOE button functionality
- [x] Custom title changes for editable entries

#### ✅ Calculations
- [x] Total income calculation
- [x] Total subsidy calculation
- [x] Total amount calculation (income + subsidy)
- [x] Real-time calculation updates

#### ✅ Conditional Rendering
- [x] Add Other MOOE button visibility
- [x] Input field disabling based on status
- [x] Income input disabling when locked
- [x] Custom vs standard entry handling

### Integration Tests

#### ✅ Complete Workflows
- [x] Load data → Edit values → Save workflow
- [x] Search and filter functionality
- [x] Auto-save with timer simulation
- [x] Export functionality with file download
- [x] Import functionality with file processing
- [x] Validation error handling
- [x] Region change triggering data refetch

#### ✅ Error Scenarios
- [x] Network errors during data fetch
- [x] Validation errors preventing save
- [x] Invalid file format during import
- [x] API errors during save operations

## 🚀 Running Tests

### Prerequisites
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Files
```bash
# Unit tests only
npm test MooeTable.test.jsx
npm test MooeRow.test.jsx

# Integration tests only
npm test integration.test.jsx
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

## 🔧 Test Configuration

### Setup File (`setup.js`)
The setup file includes:
- **Global Mocks**: IntersectionObserver, ResizeObserver, matchMedia
- **Storage Mocks**: localStorage, sessionStorage
- **File API Mocks**: FileReader, Blob, URL methods
- **Helper Functions**: Mock data generators, custom render functions
- **Utility Functions**: Common assertions, API mocking

### Mock Strategy
- **API Calls**: Mocked using Jest mocks
- **React Query**: Custom QueryClient with disabled retries
- **Context Providers**: Wrapped with test data
- **File Operations**: Mocked for import/export testing
- **Timers**: Jest fake timers for auto-save testing

## 📊 Test Scenarios

### 1. Data Loading
```javascript
// Tests loading states, error handling, and successful data display
test('renders loading state initially')
test('renders error state when data fetch fails')
test('renders data table when data is loaded')
```

### 2. User Input Validation
```javascript
// Tests various input validation scenarios
test('validates input values')
test('handles negative values')
test('handles extremely large values')
test('shows validation errors')
```

### 3. Data Persistence
```javascript
// Tests save functionality and data synchronization
test('handles save functionality')
test('auto-save functionality')
test('tracks unsaved changes')
test('region change triggers data refetch')
```

### 4. Import/Export
```javascript
// Tests file operations
test('handles export functionality')
test('handles import functionality')
test('validates CSV format')
test('processes imported data correctly')
```

## 🐛 Common Test Issues

### Issue: Tests failing due to async operations
**Solution**: Use `waitFor` and proper async/await patterns
```javascript
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Issue: Mock not working properly
**Solution**: Ensure mocks are cleared between tests
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Issue: File operations not testable
**Solution**: Use the provided mock utilities in `setup.js`
```javascript
import { createMockFile } from './setup';
const file = createMockFile('csv,content', 'test.csv');
```

## 📈 Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## 🔄 Continuous Integration

These tests are designed to run in CI/CD pipelines:
- Fast execution (< 30 seconds total)
- No external dependencies
- Deterministic results
- Comprehensive error scenarios

## 📝 Adding New Tests

When adding new functionality to MOOE components:

1. **Add unit tests** for individual functions/components
2. **Add integration tests** for complete user workflows
3. **Update this documentation** with new test scenarios
4. **Ensure coverage** meets the established thresholds

### Test Naming Convention
```javascript
// Unit tests
test('should [expected behavior] when [condition]')

// Integration tests
test('[workflow name]: [step 1] → [step 2] → [expected result]')
```

## 🎯 Best Practices

1. **Test user behavior**, not implementation details
2. **Use descriptive test names** that explain the scenario
3. **Mock external dependencies** but test component logic
4. **Test error scenarios** as thoroughly as success scenarios
5. **Keep tests isolated** and independent
6. **Use setup utilities** to reduce code duplication

## 🔍 Debugging Tests

### Enable Debug Mode
```javascript
import { screen } from '@testing-library/react';
screen.debug(); // Prints current DOM state
```

### Check Query Failures
```javascript
// Use getBy* for elements that should exist
// Use queryBy* for elements that might not exist
expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
```

### Async Debugging
```javascript
await waitFor(() => {
  console.log('Current state:', screen.getByTestId('debug-element'));
});
```

The test suite provides comprehensive coverage of the MOOE table functionality, ensuring reliability and preventing regressions as the codebase evolves.
