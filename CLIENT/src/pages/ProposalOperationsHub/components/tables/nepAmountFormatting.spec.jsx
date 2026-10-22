// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import NEPFinancialComparisonTable from './NEPFinancialComparisonTable';
import NEPPersonnelComparisonTable from './NEPPersonnelComparisonTable';

afterEach(cleanup);

const item = {
  particulars: 'Test budget line',
  accountingTitle: 'Test budget line',
  amount: 25675200,
  income: 25675200,
  subsidy: 4905000.25,
};

describe('NEP editable amount formatting', () => {
  it.each(['income', 'mooe', 'capital'])(
    'formats %s inputs and emits numbers instead of comma-formatted strings',
    moduleKey => {
      const onEdit = vi.fn();
      const props = { moduleKey, initialItems: [item], currentItems: [item], canEdit: true, onEdit };
      const { rerender } = render(<NEPFinancialComparisonTable {...props} />);
      const input = screen.getAllByRole('textbox')[0];
      expect(input.value).toBe('25,675,200.00');
      expect(onEdit).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: '1234567.89' } });
      expect(input.value).toBe('1,234,567.89');
      expect(onEdit).toHaveBeenLastCalledWith([0], 1234567.89, moduleKey === 'income' ? null : 'income');

      fireEvent.change(input, { target: { value: '' } });
      expect(onEdit).toHaveBeenLastCalledWith([0], 0, moduleKey === 'income' ? null : 'income');

      onEdit.mockClear();
      rerender(<NEPFinancialComparisonTable {...props} currentItems={[{ ...item, amount: 2000, income: 2000 }]} />);
      expect(input.value).toBe('2,000.00');
      expect(onEdit).not.toHaveBeenCalled();
      rerender(<NEPFinancialComparisonTable {...props} canEdit={false} />);
      expect(input.disabled).toBe(true);
    }
  );

  it('formats subsidy amounts with centavos', () => {
    const onEdit = vi.fn();
    render(<NEPFinancialComparisonTable moduleKey="mooe" currentItems={[item]} canEdit onEdit={onEdit} />);
    const input = screen.getAllByRole('textbox')[1];
    expect(input.value).toBe('4,905,000.25');
    fireEvent.change(input, { target: { value: '12345.67' } });
    expect(input.value).toBe('12,345.67');
    expect(onEdit).toHaveBeenLastCalledWith([0], 12345.67, 'subsidy');
  });

  it('keeps initial-only rows disabled', () => {
    render(<NEPFinancialComparisonTable moduleKey="income" initialItems={[item]} canEdit />);
    expect(screen.getByRole('textbox').disabled).toBe(true);
  });

  it('formats Personnel allocations and sends numeric changes without mount side effects', () => {
    const onAllocationChange = vi.fn();
    render(
      <NEPPersonnelComparisonTable
        personnel={[{
          _id: 'personnel-1',
          statusOfAppointment: 'Permanent',
          annualSalary: 120000,
          chargedToIncomeAmount: 30000,
          chargedToIncomeEligible: true,
          Total: 120000,
        }]}
        canEdit
        onAllocationChange={onAllocationChange}
      />
    );
    const input = screen.getAllByRole('textbox')[0];
    expect(input.value).toBe('30,000.00');
    expect(onAllocationChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '45678.90' } });
    expect(input.value).toBe('45,678.90');
    expect(onAllocationChange).toHaveBeenLastCalledWith(expect.any(Object), 'income', 45678.9);
  });
});
