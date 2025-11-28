import React from 'react';
import { render, screen } from '@testing-library/react';
import ComparisonMOOETable from '../ComparisonMOOETable';

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

describe('ComparisonMOOETable', () => {
  test('hides generic Other UACS code (5-02-99-990 and variants) for Other Maintenance and Operating Expenses groups', () => {
    render(<ComparisonMOOETable data={data} />);

    // The generic 'Other' uacs codes (base and variants) should not be displayed
    expect(screen.queryByText('5-02-99-990')).not.toBeInTheDocument();
    expect(screen.queryByText('5-02-99-990-1')).not.toBeInTheDocument();

    // Ensure accounting title text is displayed
    expect(screen.getByText('Other Maintenance and Operating Expenses - Meals & Snacks')).toBeInTheDocument();
  });
});
