import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-toastify';
import Mooe from '../MooeTable';
import { UserProvider } from '../../../context/UserContext';
import { RegionProvider } from '../../../context/RegionContext';

// Mock dependencies
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('../../../config/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock data
const mockMooeData = {
  formattedData: [
    {
      id: 'test-1',
      sublineItem: 'Test Subline',
      children: [
        {
          id: 'child-1',
          accountingTitle: 'Test Account',
          uacsCode: '5-02-01-001',
          income: '1000',
          subsidy: '500',
          amount: '1500',
          status: 'Not Submitted'
        }
      ]
    }
  ],
  status: 'Not Submitted',
  fiscalYear: '2026',
  budgetType: 'INITIAL'
};

const mockUser = {
  FirstName: 'Test',
  LastName: 'User',
  Region: 'Central Office',
  Roles: ['Budget Officer']
};

const mockRegion = {
  id: 'central-office',
  name: 'Central Office'
};

// Test wrapper component
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <UserProvider value={{ currentUser: mockUser }}>
          <RegionProvider value={{ activeRegion: mockRegion }}>
            {children}
          </RegionProvider>
        </UserProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Mooe Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    expect(screen.getByText('Loading MOOE data...')).toBeInTheDocument();
  });

  test('renders error state when data fetch fails', async () => {
    const api = require('../../../config/api');
    api.get.mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('⚠️ Error loading MOOE data')).toBeInTheDocument();
    });
  });

  test('renders data table when data is loaded', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('SUBLINE ITEM')).toBeInTheDocument();
      expect(screen.getByText('ACCOUNTING TITLE')).toBeInTheDocument();
      expect(screen.getByText('UACS CODE')).toBeInTheDocument();
      expect(screen.getByText('INCOME')).toBeInTheDocument();
      expect(screen.getByText('SUBSIDY')).toBeInTheDocument();
      expect(screen.getByText('AMOUNT')).toBeInTheDocument();
    });
  });

  test('handles search functionality', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search subline items/);
      expect(searchInput).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search subline items/);
    fireEvent.change(searchInput, { target: { value: 'Test' } });

    expect(searchInput.value).toBe('Test');
  });

  test('handles save functionality', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });
    api.post.mockResolvedValue({ data: { success: true } });

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/mooe-save', expect.any(Object), expect.any(Object));
    });
  });

  test('validates input values', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('SUBLINE ITEM')).toBeInTheDocument();
    });

    // Test negative value validation
    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    if (incomeInputs.length > 0) {
      fireEvent.change(incomeInputs[0], { target: { value: '-100' } });
      
      await waitFor(() => {
        expect(screen.getByText(/cannot be negative/)).toBeInTheDocument();
      });
    }
  });

  test('handles export functionality', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });

    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement and click
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn()
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      const exportButton = screen.getByLabelText(/Export to CSV/);
      expect(exportButton).toBeInTheDocument();
    });

    const exportButton = screen.getByLabelText(/Export to CSV/);
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('exported successfully'));
    });
  });

  test('handles auto-save toggle', async () => {
    const api = require('../../../config/api');
    api.get.mockResolvedValue({
      data: {
        entries: mockMooeData.formattedData[0].children,
        status: mockMooeData.status,
        settings: {
          fiscalYear: mockMooeData.fiscalYear,
          budgetType: mockMooeData.budgetType
        }
      }
    });

    render(
      <TestWrapper>
        <Mooe />
      </TestWrapper>
    );

    await waitFor(() => {
      const autoSaveToggle = screen.getByText('Auto-save');
      expect(autoSaveToggle).toBeInTheDocument();
    });

    const autoSaveSwitch = screen.getByRole('checkbox');
    fireEvent.click(autoSaveSwitch);

    expect(autoSaveSwitch.checked).toBe(true);
  });
});
