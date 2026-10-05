// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), post: vi.fn(), table: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), refetchQueries: vi.fn() },
  headers: () => ({ 'X-Workflow-Ref': 'proposal-1' }),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../config/api', () => ({ default: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ currentUser: { FirstName: 'Test', LastName: 'User' } }) }));
vi.mock('../../context/RegionContext', () => ({ useRegion: () => ({ activeRegion: {} }) }));
vi.mock('../../hooks/useWorkflowRef', () => ({ useWorkflowRef: () => ({ workflowRef: 'proposal-1', headerConfig: mocks.headers }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock('../../utils/queryClientHelpers', () => ({ invalidateDataList: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: mocks.toast }));
vi.mock('./PersonnelCustomMenu', () => ({ default: () => null }));
vi.mock('./PersonnelCustomTable', () => ({ default: props => { mocks.table(props); return null; } }));
import PersonnelTable from './PersonnelCustomPageTable';
import PersonnelFundingSummary from '../reports/PersonnelFundingSummary';
import { PersonnelFundingCells } from '../reports/ConsolidatedPersonnelServicesReportsPage';
import RegionalComparisonMatrix from '../reports/RegionalComparisonMatrix';
const schema = { employeeFullName: { label: 'Employee', type: 'string', show: true } };
const payload = { mode: 'CPCS_DIFFERENCE', cpcs1Reference: 'base', cpcs2Reference: 'current', cpcs1MatchBy: 'JG', cpcs2MatchBy: 'SG', notes: 'Salary' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async url => ({ data:
    url.includes('permanent-income-allocation') ? { ...payload, references: {
      cpcs1: [{ id: 'base', label: 'CPCS 1 FY 2027' }], cpcs2: [{ id: 'current', label: 'CPCS 2 FY 2027' }],
    } } : url === '/ratas' ? [] : { fiscalYear: '2027', budgetType: 'Initial' },
  }));
  mocks.post.mockResolvedValue({ data: { updatedCount: 2, chargedCount: 1, monthlySalarySubsidy: 60000, monthlyIncome: 3000,
    personnel: [{ id: 'one', name: 'Employee One', cpcs1: 30000, cpcs2: 33000, income: 3000 }],
  } });
  mocks.put.mockResolvedValue({ data: { updatedCount: 2, chargedCount: 1 } });
});
afterEach(cleanup);
async function open() {
  render(<PersonnelTable dataListName="personnelServices" schema={schema} proposalId="proposal-1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Salary Income Allocation' }));
  await screen.findByText('CPCS Salary Reference Allocation');
}
it('previews two references and saves for all permanent personnel without selecting rows', async () => {
  await open();
  expect(mocks.table.mock.lastCall[0].onRowSelectionChange).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Save Allocation' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Preview Allocation' }));
  await screen.findByText('Employee One');
  expect(screen.getByText('33,000')).toBeTruthy();
  expect(mocks.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Allocation' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(
    '/personnelServices/permanent-income-allocation/proposal-1', payload,
    { headers: { 'X-Workflow-Ref': 'proposal-1' } },
  ));
  await waitFor(() => expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['chargedToIncomeList'] }));
});
it('shows missing-rate errors and prevents saving an invalid allocation', async () => {
  mocks.post.mockRejectedValue({ response: { data: { message: 'Employee One: missing CPCS 1 rate.' } } });
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Allocation' }));
  await screen.findByText('Employee One: missing CPCS 1 rate.');
  expect(screen.getByRole('button', { name: 'Save Allocation' }).disabled).toBe(true);
  expect(mocks.put).not.toHaveBeenCalled();
});
it('invalidates the preview when grade matching changes', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Allocation' }));
  await screen.findByText('Employee One');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'CPCS 1 grade' }));
  fireEvent.click(screen.getByRole('option', { name: 'Salary Grade' }));
  expect(screen.queryByText('Employee One')).toBeNull();
  expect(screen.getByRole('button', { name: 'Save Allocation' }).disabled).toBe(true);
});
it('requires both tables for an unconfigured proposal', async () => {
  const get = mocks.get.getMockImplementation();
  mocks.get.mockImplementation(url => url.includes('permanent-income-allocation')
    ? Promise.resolve({ data: { references: { cpcs1: [], cpcs2: [] } } }) : get(url));
  await open();
  expect(screen.getByRole('button', { name: 'Preview Allocation' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Save Allocation' }).disabled).toBe(true);
});
it('keeps allocation unavailable when the proposal is locked', () => {
  render(<PersonnelTable dataListName="personnelServices" schema={schema} locked />);
  expect(screen.getByRole('button', { name: 'Salary Income Allocation' }).disabled).toBe(true);
});

it('shows separate annual salary and other PS funding without adding the increase twice', () => {
  render(<PersonnelFundingSummary funding={{ salaryIncome: 36000, salarySubsidy: 360000, salaryTotal: 396000, income: 36000, subsidy: 384000, total: 420000 }} />);
  expect(screen.getByRole('table', { name: 'Annual Personnel Services funding' })).toBeTruthy();
  const salary = screen.getByText('Annual salaries').closest('tr');
  expect(salary.textContent).toContain('36,000.00');
  expect(salary.textContent).toContain('360,000.00');
  expect(salary.textContent).toContain('396,000.00');
  const total = screen.getByText('Total Personnel Services').closest('tr');
  expect(total.textContent).toContain('420,000.00');
});

it('renders Income, Subsidy and Amount in separate row cells for the regional PS table', () => {
  render(<table><tbody><tr><PersonnelFundingCells income={36000} subsidy={360000} amount={396000} /></tr></tbody></table>);
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['₱36,000.00', '₱360,000.00', '₱396,000.00']);
});

it('renders all-region funding subcolumns, salary rows, subtotals and grand totals', () => {
  const values = { income: 36000, subsidy: 360000, amount: 396000 };
  const matrix = { regions: ['Region I'], sections: [{ id: 'salary', name: 'Salaries', rows: [{ id: 'regular', particulars: 'Regular salary', valuesByRegion: { 'Region I': values }, totals: values }] }] };
  render(<RegionalComparisonMatrix matrix={matrix} columns={[{ key: 'income', label: 'Income' }, { key: 'subsidy', label: 'Subsidy' }, { key: 'amount', label: 'Amount' }]} />);
  expect(screen.getAllByRole('columnheader', { name: 'Income' })).toHaveLength(2);
  expect(screen.getAllByRole('columnheader', { name: 'Subsidy' })).toHaveLength(2);
  const salary = screen.getByText('Regular salary').closest('tr');
  expect(salary.textContent).toContain('₱36,000.00₱360,000.00₱396,000.00');
  expect(document.querySelector('tfoot').textContent).toContain('₱36,000.00₱360,000.00₱396,000.00');
});
