// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const responses = {
  '/api/tier/saved-items': { items: [], version: null },
  '/api/tier/finalized-data': { hasTierData: true, projectedCorporateIncome: 1000 },
  '/api/consolidated-reports/personnel-services-data': { data: [{ categories: [] }] },
  '/mooe/getByParams': [
    { sublineItem: 'Travelling Expenses', accountingTitle: 'Traveling Expenses-Local', uacsCode: '5-02-01-010', amount: 25675200, income: 1000, subsidy: 25674200 },
  ],
  '/api/consolidated-reports/capital-outlay-data': { data: [] },
  '/income/getByParams': [{ incomecategory: { name: 'Fees' }, particulars: 'Tuition', amount: 1000 }],
  '/personnelServices': { personnelServices: [] },
};

vi.mock('../../config/api', () => ({
  default: { get: vi.fn((url) => Promise.resolve({ data: responses[url] })) },
}));

import TierTable from './TierTable';

afterEach(cleanup);

const renderTable = (props = {}) => {
  const onTierDataChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TierTable fiscalYear="2027" region="r1" regionName="Region 1" onTierDataChange={onTierDataChange} {...props} />
    </QueryClientProvider>
  );
  return { onTierDataChange };
};

const lastPayload = (fn) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe('TierTable income/subsidy split', () => {
  it('renders Income and Subsidy sub-columns under Tier 1, Tier 2 and Total', async () => {
    renderTable();
    await screen.findByText('A. SOURCES OF FUNDS');
    const head = document.querySelector('thead');
    expect(within(head).getByText('TIER 1')).toBeTruthy();
    expect(within(head).getByText('TIER 2')).toBeTruthy();
    expect(within(head).getByText('TOTAL')).toBeTruthy();
    expect(within(head).getAllByText('Income')).toHaveLength(3);
    expect(within(head).getAllByText('Subsidy')).toHaveLength(3);
    expect(document.querySelector('table').className).toMatch(/stickyHeader/);
  });

  it('defaults income to Tier 1, balances it into Tier 2 and saves both splits', async () => {
    const { onTierDataChange } = renderTable();
    await screen.findByText('A. SOURCES OF FUNDS');
    fireEvent.click(screen.getAllByLabelText('expand row')[1]); // MOOE

    const t1Income = await screen.findByLabelText('Traveling Expenses-Local Tier 1 income');
    const t1Subsidy = screen.getByLabelText('Traveling Expenses-Local Tier 1 subsidy');
    expect(t1Income.value).toBe('1,000.00');
    expect(t1Subsidy.value).toBe('25,674,200.00');

    const t2Income = screen.getByLabelText('Traveling Expenses-Local Tier 2 income');
    fireEvent.change(t2Income, { target: { value: '400' } });

    await waitFor(() => expect(screen.getByLabelText('Traveling Expenses-Local Tier 1 income').value).toBe('600.00'));
    await waitFor(() => {
      const item = Object.values(lastPayload(onTierDataChange).displayedItems)[0];
      expect(item).toMatchObject({ tier1Income: 600, tier2Income: 400, tier1: 25674200, tier2: 0 });
    });
    const summary = lastPayload(onTierDataChange).reportSummary;
    expect(summary.sourcesOfFunds.corporateIncomeTier1).toBe(600);
    expect(summary.sourcesOfFunds.corporateIncomeTier2).toBe(400);
    expect(summary.usesOfFunds.proposedBudget).toBe(25675200);
  });

  it('restores saved income splits from the server', async () => {
    responses['/api/tier/saved-items'] = {
      version: 2,
      items: [{ lineItemId: 'Maintenance and Other Operating Expenses-5-02-01-010', category: 'MOOE', tier1: 25000000, tier2: 674200, tier1Income: 250, tier2Income: 750 }],
    };
    renderTable();
    await screen.findByText('A. SOURCES OF FUNDS');
    fireEvent.click(screen.getAllByLabelText('expand row')[1]);
    expect((await screen.findByLabelText('Traveling Expenses-Local Tier 2 income')).value).toBe('750.00');
    expect(screen.getByLabelText('Traveling Expenses-Local Tier 2 subsidy').value).toBe('674,200.00');
    responses['/api/tier/saved-items'] = { items: [], version: null };
  });
});
