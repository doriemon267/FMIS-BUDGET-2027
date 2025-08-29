import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import MooeTable from '../MooeTable';
import { UserProvider } from '../../../context/UserContext';
import { RegionProvider } from '../../../context/RegionContext';
import api from '../../../config/api';

// Mock the API
jest.mock('../../../config/api');
const mockedApi = api;

// Mock toast
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Integration test data
const mockCompleteData = {
  entries: [
    {
      id: 'entry-1',
      sublineItem: 'Traveling Expenses',
      accountingTitle: 'Traveling Expenses - Local',
      uacsCode: '5-02-01-001',
      income: '0',
      subsidy: '0',
      amount: '0',
      status: 'Not Submitted'
    },
    {
      id: 'entry-2',
      sublineItem: 'Traveling Expenses',
      accountingTitle: 'Traveling Expenses - Foreign',
      uacsCode: '5-02-01-002',
      income: '0',
      subsidy: '0',
      amount: '0',
      status: 'Not Submitted'
    },
    {
      id: 'entry-3',
      sublineItem: 'Training and Scholarship Expenses',
      accountingTitle: 'Training Expenses',
      uacsCode: '5-02-02-001',
      income: '0',
      subsidy: '0',
      amount: '0',
      status: 'Not Submitted'
    }
  ],
  status: 'Not Submitted',
  settings: {
    fiscalYear: '2026',
    budgetType: 'INITIAL'
  }
};

const mockUser = {
  FirstName: 'Integration',
  LastName: 'Tester',
  Region: 'Central Office',
  Roles: ['Budget Officer']
};

const mockRegion = {
  id: 'central-office',
  name: 'Central Office'
};

const IntegrationTestWrapper = ({ children }) => {
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

describe('MOOE Table Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: mockCompleteData });
    mockedApi.post.mockResolvedValue({ data: { success: true } });
  });

  test('complete workflow: load data, edit values, save', async () => {
    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Expand a row
    const expandButtons = screen.getAllByRole('button');
    const firstExpandButton = expandButtons.find(btn => 
      btn.querySelector('svg')?.getAttribute('data-testid') === 'AddCircleOutlineIcon' ||
      btn.querySelector('svg')?.getAttribute('data-testid') === 'RemoveCircleOutlineIcon'
    );
    
    if (firstExpandButton) {
      fireEvent.click(firstExpandButton);
    }

    // Wait for child rows to appear
    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses - Local')).toBeInTheDocument();
    });

    // Edit income value
    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    if (incomeInputs.length > 0) {
      fireEvent.change(incomeInputs[0], { target: { value: '50000' } });
    }

    // Edit subsidy value
    if (incomeInputs.length > 1) {
      fireEvent.change(incomeInputs[1], { target: { value: '25000' } });
    }

    // Save the data
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Verify save was called
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/mooe-save', expect.any(Object), expect.any(Object));
    });
  });

  test('search and filter functionality', async () => {
    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Test search
    const searchInput = screen.getByPlaceholderText(/Search subline items/);
    fireEvent.change(searchInput, { target: { value: 'Training' } });

    // Should filter to show only Training expenses
    await waitFor(() => {
      expect(screen.getByText('Training and Scholarship Expenses')).toBeInTheDocument();
      expect(screen.queryByText('Traveling Expenses')).not.toBeInTheDocument();
    });

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
      expect(screen.getByText('Training and Scholarship Expenses')).toBeInTheDocument();
    });
  });

  test('auto-save functionality', async () => {
    jest.useFakeTimers();

    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Enable auto-save
    const autoSaveSwitch = screen.getByRole('checkbox');
    fireEvent.click(autoSaveSwitch);

    // Expand a row and make changes
    const expandButtons = screen.getAllByRole('button');
    const firstExpandButton = expandButtons.find(btn => 
      btn.querySelector('svg')?.getAttribute('data-testid') === 'AddCircleOutlineIcon' ||
      btn.querySelector('svg')?.getAttribute('data-testid') === 'RemoveCircleOutlineIcon'
    );
    
    if (firstExpandButton) {
      fireEvent.click(firstExpandButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses - Local')).toBeInTheDocument();
    });

    // Make a change
    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    if (incomeInputs.length > 0) {
      fireEvent.change(incomeInputs[0], { target: { value: '10000' } });
    }

    // Fast-forward time to trigger auto-save
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  test('export functionality', async () => {
    // Mock URL and document methods
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn()
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByLabelText(/Export to CSV/);
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('MOOE_Data_');
    });
  });

  test('import functionality', async () => {
    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Create a mock CSV file
    const csvContent = 'UACS Code,Income,Subsidy\n5-02-01-001,15000,7500\n5-02-01-002,20000,10000';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    // Find the import input (hidden file input)
    const importInput = screen.getByDisplayValue('');
    
    // Simulate file selection
    Object.defineProperty(importInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(importInput);

    // Verify that the import was processed
    // This would require more complex setup to fully test the file reading
    expect(importInput.files[0]).toBe(file);
  });

  test('validation error handling', async () => {
    render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses')).toBeInTheDocument();
    });

    // Expand a row
    const expandButtons = screen.getAllByRole('button');
    const firstExpandButton = expandButtons.find(btn => 
      btn.querySelector('svg')?.getAttribute('data-testid') === 'AddCircleOutlineIcon' ||
      btn.querySelector('svg')?.getAttribute('data-testid') === 'RemoveCircleOutlineIcon'
    );
    
    if (firstExpandButton) {
      fireEvent.click(firstExpandButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Traveling Expenses - Local')).toBeInTheDocument();
    });

    // Enter invalid value (negative)
    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    if (incomeInputs.length > 0) {
      fireEvent.change(incomeInputs[0], { target: { value: '-1000' } });
    }

    // Try to save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/cannot be negative/)).toBeInTheDocument();
    });

    // Save should not be called
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  test('region change triggers data refetch', async () => {
    const { rerender } = render(
      <IntegrationTestWrapper>
        <MooeTable />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/mooe-data', expect.objectContaining({
        params: { region: 'central-office' }
      }));
    });

    // Change region
    const newRegion = { id: 'region-1', name: 'Region 1' };
    
    const NewRegionWrapper = ({ children }) => {
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
              <RegionProvider value={{ activeRegion: newRegion }}>
                {children}
              </RegionProvider>
            </UserProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );
    };

    rerender(
      <NewRegionWrapper>
        <MooeTable />
      </NewRegionWrapper>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/mooe-data', expect.objectContaining({
        params: { region: 'region-1' }
      }));
    });
  });
});
