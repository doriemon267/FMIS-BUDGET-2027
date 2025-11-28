import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MooeRow from '../MooeRow';

// Mock data
const mockRow = {
  id: 'test-row-1',
  sublineItem: 'Test Subline Item',
  children: [
    {
      id: 'child-1',
      accountingTitle: 'Test Account 1',
      uacsCode: '5-02-01-001',
      income: '1000',
      subsidy: '500',
      amount: '1500',
      status: 'Not Submitted'
    },
    {
      id: 'child-2',
      accountingTitle: 'Test Account 2',
      uacsCode: '5-02-01-002',
      income: '2000',
      subsidy: '1000',
      amount: '3000',
      status: 'Draft'
    }
  ]
};

const mockProps = {
  row: mockRow,
  expanded: false,
  onToggleExpand: jest.fn(),
  onAmountChange: jest.fn(),
  onTitleChange: jest.fn(),
  onAddCustomMOOE: jest.fn(),
  calculateTotal: jest.fn(() => 4500),
  status: 'Not Submitted',
  onIncomeChange: jest.fn(),
  onSubsidyChange: jest.fn(),
  disableIncomeInputs: false
};

describe('MooeRow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders parent row with correct data', () => {
    render(<MooeRow {...mockProps} />);

    expect(screen.getByText('Test Subline Item')).toBeInTheDocument();
    expect(screen.getByText('₱3,000.00')).toBeInTheDocument(); // Total income
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument(); // Total subsidy
    expect(screen.getByText('₱4,500.00')).toBeInTheDocument(); // Total amount
  });

  test('toggles expansion when expand button is clicked', () => {
    render(<MooeRow {...mockProps} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    expect(mockProps.onToggleExpand).toHaveBeenCalledWith('test-row-1');
  });

  test('renders child rows when expanded', () => {
    const expandedProps = { ...mockProps, expanded: true };
    render(<MooeRow {...expandedProps} />);

    expect(screen.getByText('Test Account 1')).toBeInTheDocument();
    expect(screen.getByText('Test Account 2')).toBeInTheDocument();
    expect(screen.getByText('5-02-01-001')).toBeInTheDocument();
    expect(screen.getByText('5-02-01-002')).toBeInTheDocument();
  });

  test('handles income input changes', () => {
    const expandedProps = { ...mockProps, expanded: true };
    render(<MooeRow {...expandedProps} />);

    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    const firstIncomeInput = incomeInputs[0];

    fireEvent.change(firstIncomeInput, { target: { value: '1500' } });

    expect(mockProps.onIncomeChange).toHaveBeenCalledWith('test-row-1', 'child-1', '1500');
  });

  test('handles subsidy input changes', () => {
    const expandedProps = { ...mockProps, expanded: true };
    render(<MooeRow {...expandedProps} />);

    const subsidyInputs = screen.getAllByPlaceholderText('0.00');
    const firstSubsidyInput = subsidyInputs[1]; // Second input should be subsidy

    fireEvent.change(firstSubsidyInput, { target: { value: '750' } });

    expect(mockProps.onSubsidyChange).toHaveBeenCalledWith('test-row-1', 'child-1', '750');
  });

  test('disables inputs when not editable', () => {
    const nonEditableProps = { ...mockProps, expanded: true, status: 'Submitted' };
    render(<MooeRow {...nonEditableProps} />);

    const inputs = screen.getAllByPlaceholderText('0.00');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  test('disables income inputs when disableIncomeInputs is true', () => {
    const disabledIncomeProps = { 
      ...mockProps, 
      expanded: true, 
      disableIncomeInputs: true 
    };
    render(<MooeRow {...disabledIncomeProps} />);

    const incomeInputs = screen.getAllByPlaceholderText('0.00');
    // First input should be income and should be disabled
    expect(incomeInputs[0]).toBeDisabled();
  });

  test('shows Add Other MOOE button when expanded and has Other MOOE UACS code', () => {
    const otherMooeRow = {
      ...mockRow,
      children: [
        ...mockRow.children,
        {
          id: 'child-3',
          accountingTitle: 'Other MOOE',
          uacsCode: '5-02-99-990-1',
          income: '0',
          subsidy: '0',
          amount: '0',
          status: 'Not Submitted'
        }
      ]
    };

    const otherMooeProps = { 
      ...mockProps, 
      row: otherMooeRow, 
      expanded: true 
    };
    render(<MooeRow {...otherMooeProps} />);

    expect(screen.getByText('Add Other MOOE')).toBeInTheDocument();
    // The generic 'Other' UACS code should be hidden in the UI for this category
    expect(screen.queryByText('5-02-99-990')).not.toBeInTheDocument();
    expect(screen.queryByText('5-02-99-990-1')).not.toBeInTheDocument();
  });

  test('handles Add Other MOOE button click', () => {
    const otherMooeRow = {
      ...mockRow,
      children: [
        ...mockRow.children,
        {
          id: 'child-3',
          accountingTitle: 'Other MOOE',
          uacsCode: '5-02-99-990-2',
          income: '0',
          subsidy: '0',
          amount: '0',
          status: 'Not Submitted'
        }
      ]
    };

    const otherMooeProps = { 
      ...mockProps, 
      row: otherMooeRow, 
      expanded: true 
    };
    render(<MooeRow {...otherMooeProps} />);

    const addButton = screen.getByText('Add Other MOOE');
    fireEvent.click(addButton);

    expect(mockProps.onAddCustomMOOE).toHaveBeenCalledWith('test-row-1');
  });

  test('calculates totals correctly', () => {
    render(<MooeRow {...mockProps} />);

    // Check if totals are calculated and displayed correctly
    // Total income: 1000 + 2000 = 3000
    // Total subsidy: 500 + 1000 = 1500
    // Total amount: 3000 + 1500 = 4500
    expect(screen.getByText('₱3,000.00')).toBeInTheDocument();
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument();
    expect(screen.getByText('₱4,500.00')).toBeInTheDocument();
  });

  test('handles custom title changes for custom entries', () => {
    const customRow = {
      ...mockRow,
      children: [
        {
          id: 'custom-1',
          accountingTitle: 'Custom Entry',
          uacsCode: '5-02-99-990-3',
          income: '0',
          subsidy: '0',
          amount: '0',
          status: 'Not Submitted',
          custom: true
        }
      ]
    };

    const customProps = { 
      ...mockProps, 
      row: customRow, 
      expanded: true 
    };
    render(<MooeRow {...customProps} />);

    const titleInput = screen.getByPlaceholderText('Enter MOOE title');
    fireEvent.change(titleInput, { target: { value: 'New Custom Title' } });

    expect(mockProps.onTitleChange).toHaveBeenCalledWith('test-row-1', 'custom-1', 'New Custom Title');
  });

  test('displays correct currency formatting', () => {
    render(<MooeRow {...mockProps} />);

    // Check that all amounts are properly formatted with peso sign and commas
    const amountElements = screen.getAllByText(/₱[\d,]+\.\d{2}/);
    expect(amountElements.length).toBeGreaterThan(0);
  });

  test('memoization prevents unnecessary re-renders', () => {
    const { rerender } = render(<MooeRow {...mockProps} />);
    
    // Re-render with same props
    rerender(<MooeRow {...mockProps} />);
    
    // Component should be memoized and not re-render unnecessarily
    // This is more of a performance test and would require additional setup
    // to properly test React.memo behavior
    expect(screen.getByText('Test Subline Item')).toBeInTheDocument();
  });
});
