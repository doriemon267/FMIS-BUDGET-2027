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
  '/income-categories': { categories: [] },
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

  it('merges duplicate income lines and follows the configured category/subcategory order', async () => {
    const original = responses['/income/getByParams'];
    responses['/income-categories'] = {
      // Settings order differs on purpose: the fixed Sources of Funds order must win for categories.
      categories: [
        { _id: 'c3', incomeCategoryName: 'Miscellaneous Income', incomeSubcategoryName: ['Bid Forms', 'Sales of Scrap'] },
        { _id: 'c4', incomeCategoryName: 'Water Service Fee', incomeSubcategoryName: ['Aya PSP'] },
        { _id: 'c2', incomeCategoryName: 'Rent Income', incomeSubcategoryName: ['Rent Income', 'Dorm / RTC / NIA Housing'] },
        { _id: 'c1', incomeCategoryName: 'Irrigation Service Fees', incomeSubcategoryName: ['Current Account', 'Back Accounts'] },
      ],
    };
    responses['/income/getByParams'] = [
      { incomecategory: { _id: 'c3', name: 'Miscellaneous Income' }, subcategory: 'Sales of Scrap', amount: 45000 },
      { incomecategory: { _id: 'c2', name: 'Rent Income' }, subcategory: 'Dorm / RTC / NIA Housing', amount: 701100 },
      { incomecategory: { _id: 'c2', name: 'Rent Income' }, subcategory: 'Dorm / RTC / NIA Housing', amount: 15000 },
      { incomecategory: { _id: 'c3', name: 'Miscellaneous Income' }, subcategory: 'Bid Forms', amount: 30000 },
      { incomecategory: { _id: 'c3', name: 'Miscellaneous Income' }, subcategory: 'Bid Forms', amount: 150000 },
      { incomecategory: { _id: 'c2', name: 'Rent Income' }, subcategory: 'Rent Income', amount: 1000 },
      { incomecategory: { _id: 'c1', name: 'Irrigation Service Fees' }, subcategory: 'Back Accounts', amount: 500 },
      { incomecategory: { _id: 'c1', name: 'Irrigation Service Fees' }, subcategory: 'Current Account', amount: 700 },
      { incomecategory: { _id: 'c4', name: 'Water Service Fee' }, subcategory: 'Aya PSP', amount: 2000 },
      { particulars: 'Net Irrigation Service Fees', subcategory: 'Computed', isComputed: true, amount: 1130, incomecategory: { name: 'Net Irrigation Service Fees' } },
    ];
    renderTable();
    await screen.findByText('A. SOURCES OF FUNDS');
    fireEvent.click(screen.getByLabelText('expand income'));
    await screen.findByText('Subtotal (Rent Income)');
    const labels = Array.from(document.querySelectorAll('tbody tbody tr td:first-child'))
      .map((td) => td.textContent.trim())
      .filter(Boolean);
    expect(labels).toEqual([
      'Irrigation Service Fees', 'Current Account', 'Back Accounts', 'Total ISF',
      'Less: Discount on ISF', 'Net Irrigation Service Fees',
      'Rent Income', 'Rent Income', 'Dorm / RTC / NIA Housing', 'Subtotal (Rent Income)',
      'Water Service Fee', 'Aya PSP', 'Subtotal (Water Service Fee)',
      'Miscellaneous Income', 'Bid Forms', 'Sales of Scrap', 'Subtotal (Miscellaneous Income)',
    ]);
    expect(screen.getAllByText('Dorm / RTC / NIA Housing')).toHaveLength(1);
    const mainLabels = Array.from(document.querySelectorAll('table > tbody > tr > td:first-child'))
      .map((td) => td.textContent.trim())
      .filter(Boolean);
    const sourcesSection = mainLabels.slice(mainLabels.indexOf('A. SOURCES OF FUNDS'), mainLabels.indexOf('B. USES OF FUNDS'));
    expect(sourcesSection.filter((l) => !l.startsWith('Irrigation') && !l.includes('Item') && l.length < 60)).toEqual(expect.arrayContaining([
      '1. CORPORATE INCOME', 'TOTAL-CORPORATE INCOME', '2. BUDGETARY SUPPORT',
      'Subsidy to the National Irrigation Administration:', 'a. Operating Requirements',
      'TOTAL BUDGETARY SUPPORT', 'TOTAL SOURCES OF FUNDS',
    ]));
    const order = ['1. CORPORATE INCOME', 'TOTAL-CORPORATE INCOME', '2. BUDGETARY SUPPORT', 'Subsidy to the National Irrigation Administration:', 'a. Operating Requirements', 'TOTAL BUDGETARY SUPPORT', 'TOTAL SOURCES OF FUNDS'];
    const positions = order.map((l) => sourcesSection.indexOf(l));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(screen.getAllByText('₱716,100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₱180,000.00').length).toBeGreaterThan(0);
    responses['/income/getByParams'] = original;
    responses['/income-categories'] = { categories: [] };
  });
});
