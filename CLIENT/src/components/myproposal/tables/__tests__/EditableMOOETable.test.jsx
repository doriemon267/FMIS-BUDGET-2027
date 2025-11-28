import React from 'react';
import { render, screen } from '@testing-library/react';
import EditableMOOETable from '../EditableMOOETable';

const data = [
  {
    sublineItem: "Other Maintenance and Operating Expenses - Meals & Snacks",
    accountingTitle: 'Other Maintenance and Operating Expenses - Meals & Snacks',
    uacsCode: '5-02-99-990-1',
    income: 0,
    subsidy: 0,
    amount: 0,
    changeType: 'unchanged'
  },
];

describe('EditableMOOETable', () => {
  test('hides generic Other UACS code (5-02-99-990 and variants) for Other Maintenance and Operating Expenses', () => {
    render(<EditableMOOETable data={data} />);

    // The generic 'Other' uacs code should not be displayed
    expect(screen.queryByText('5-02-99-990')).not.toBeInTheDocument();
    expect(screen.queryByText('5-02-99-990-1')).not.toBeInTheDocument();

    // Ensure accounting title text is displayed in the table header or rows
    expect(screen.getAllByText(/Other Maintenance and Operating Expenses/).length).toBeGreaterThan(0);
  });
});
