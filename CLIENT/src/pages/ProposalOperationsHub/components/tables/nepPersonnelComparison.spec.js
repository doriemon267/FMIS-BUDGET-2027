import { describe, expect, it } from 'vitest';
import {
  applyPersonnelLineAllocation,
  buildPersonnelComparisonRows,
  getPersonnelComparisonTotals,
} from './nepPersonnelComparison';

const personnel = [
  {
    _id: 'permanent-1',
    statusOfAppointment: 'Permanent',
    annualSalary: 120000,
    PERA: 24000,
    gsisPremium: 12000,
    chargedToIncomeAmount: 30000,
    chargedToIncomeEligible: true,
    Total: 156000,
  },
  {
    _id: 'casual-1',
    statusOfAppointment: 'Casual',
    annualSalary: 60000,
    PERA: 12000,
    gsisPremium: 6000,
    Total: 78000,
  },
];

describe('NEP Personnel Services comparison', () => {
  it('groups permanent and casual salaries into canonical budget lines', () => {
    const sections = buildPersonnelComparisonRows(personnel);
    const salaryRows = sections[0].rows;

    expect(salaryRows[0]).toMatchObject({
      code: '1.a',
      initialIncome: 30000,
      initialSubsidy: 90000,
    });
    expect(salaryRows[1]).toMatchObject({
      code: '1.b',
      initialIncome: 0,
      initialSubsidy: 60000,
    });
  });

  it('produces exact section-aware grand totals', () => {
    const totals = getPersonnelComparisonTotals(buildPersonnelComparisonRows(personnel));

    expect(totals.initialIncome).toBe(30000);
    expect(totals.initialSubsidy).toBe(204000);
    expect(totals.nepIncome + totals.nepSubsidy).toBe(234000);
  });

  it('keeps the Initial baseline locked while changing and persisting the NEP split', () => {
    const salaryRow = buildPersonnelComparisonRows(personnel)[0].rows[0];
    const updated = applyPersonnelLineAllocation(personnel, salaryRow, 'income', 50000);
    const rebuilt = buildPersonnelComparisonRows(updated)[0].rows[0];

    expect(rebuilt.initialIncome).toBe(30000);
    expect(rebuilt.initialSubsidy).toBe(90000);
    expect(rebuilt.nepIncome).toBe(50000);
    expect(rebuilt.nepSubsidy).toBe(90000);
    expect(updated[0].nepInitialValues.annualSalary).toBe(120000);
    expect(updated[0].nepAllocations.annualSalary.income).toBe(50000);
    expect(updated[0].Total).toBe(176000);

    const secondEditRow = buildPersonnelComparisonRows(updated)[0].rows[0];
    const editedAgain = applyPersonnelLineAllocation(updated, secondEditRow, 'subsidy', 70000);
    const rebuiltAgain = buildPersonnelComparisonRows(editedAgain)[0].rows[0];
    expect(rebuiltAgain.initialIncome).toBe(30000);
    expect(rebuiltAgain.initialSubsidy).toBe(90000);
  });

  it('distributes an aggregate edit across every source record without losing the total', () => {
    const peraRow = buildPersonnelComparisonRows(personnel)[1].rows[0];
    const updated = applyPersonnelLineAllocation(personnel, peraRow, 'subsidy', 18000);
    const rebuilt = buildPersonnelComparisonRows(updated)[1].rows[0];

    expect(rebuilt.nepSubsidy).toBe(18000);
    expect(updated[0].PERA + updated[1].PERA).toBe(18000);
  });

  it('does not make an absent zero-value benefit editable or distribute it', () => {
    const honorariaRow = buildPersonnelComparisonRows(personnel)[1].rows.find(
      row => row.label === 'Honoraria'
    );

    expect(honorariaRow.sourceSlots).toHaveLength(0);
    expect(applyPersonnelLineAllocation(personnel, honorariaRow, 'subsidy', 10000)).toEqual(
      personnel
    );
  });
});
