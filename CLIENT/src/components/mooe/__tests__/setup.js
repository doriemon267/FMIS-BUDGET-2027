// Test setup file for MOOE components
import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('Warning: An invalid form control') ||
       args[0].includes('InputProps') ||
       args[0].includes('inputProps'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('InputProps') ||
       args[0].includes('inputProps'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock URL methods for file download/upload tests
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader for import tests
global.FileReader = class FileReader {
  constructor() {
    this.readAsText = jest.fn();
    this.result = '';
    this.onload = null;
  }
  
  readAsText(file) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Mock Blob for export tests
global.Blob = class Blob {
  constructor(content, options) {
    this.content = content;
    this.options = options;
  }
};

// Helper function to create mock events
export const createMockEvent = (type, properties = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
};

// Helper function to create mock file
export const createMockFile = (content, filename, type = 'text/csv') => {
  const file = new File([content], filename, { type });
  return file;
};

// Helper function to wait for async operations
export const waitForAsync = (ms = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Mock data generators
export const generateMockMooeData = (count = 3) => {
  const data = [];
  for (let i = 1; i <= count; i++) {
    data.push({
      id: `entry-${i}`,
      sublineItem: `Test Subline ${i}`,
      accountingTitle: `Test Account ${i}`,
      uacsCode: `5-02-0${i}-001`,
      income: (i * 1000).toString(),
      subsidy: (i * 500).toString(),
      amount: (i * 1500).toString(),
      status: 'Not Submitted'
    });
  }
  return data;
};

export const generateMockUser = (overrides = {}) => {
  return {
    FirstName: 'Test',
    LastName: 'User',
    Region: 'Central Office',
    Roles: ['Budget Officer'],
    ...overrides
  };
};

export const generateMockRegion = (overrides = {}) => {
  return {
    id: 'central-office',
    name: 'Central Office',
    ...overrides
  };
};

// Custom render function with providers
export const renderWithProviders = (ui, options = {}) => {
  const {
    user = generateMockUser(),
    region = generateMockRegion(),
    queryClient,
    ...renderOptions
  } = options;

  const QueryClient = require('@tanstack/react-query').QueryClient;
  const QueryClientProvider = require('@tanstack/react-query').QueryClientProvider;
  const BrowserRouter = require('react-router-dom').BrowserRouter;
  const UserProvider = require('../../../context/UserContext').UserProvider;
  const RegionProvider = require('../../../context/RegionContext').RegionProvider;

  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }) => (
    <BrowserRouter>
      <QueryClientProvider client={testQueryClient}>
        <UserProvider value={{ currentUser: user }}>
          <RegionProvider value={{ activeRegion: region }}>
            {children}
          </RegionProvider>
        </UserProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );

  return require('@testing-library/react').render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Test utilities for common assertions
export const expectToBeInDocument = (element) => {
  expect(element).toBeInTheDocument();
};

export const expectNotToBeInDocument = (element) => {
  expect(element).not.toBeInTheDocument();
};

export const expectToHaveValue = (element, value) => {
  expect(element).toHaveValue(value);
};

export const expectToBeDisabled = (element) => {
  expect(element).toBeDisabled();
};

export const expectToBeEnabled = (element) => {
  expect(element).toBeEnabled();
};

// Mock API responses
export const mockApiSuccess = (data) => {
  const api = require('../../../config/api');
  api.get.mockResolvedValue({ data });
  api.post.mockResolvedValue({ data: { success: true } });
  return api;
};

export const mockApiError = (error) => {
  const api = require('../../../config/api');
  api.get.mockRejectedValue(error);
  api.post.mockRejectedValue(error);
  return api;
};

// Cleanup function
export const cleanup = () => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
};
