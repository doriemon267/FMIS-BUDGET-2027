const {
  resolvePersonnelIncomeAllocation,
  splitPersonnelFunding,
  applyPermanentIncomeAllocation,
} = require('../../utils/personnelIncomeAllocation');

describe('resolvePersonnelIncomeAllocation', () => {
  const permanentCpcs2 = {
    monthlySalary: 50000,
    annualSalary: 600000,
    Total: 750000,
  };

  test('converts the monthly Income allocation to annual and leaves the balance as Subsidy', () => {
    expect(
      resolvePersonnelIncomeAllocation(permanentCpcs2, {
        chargedToIncomeMonthlyAmount: 20000,
      })
    ).toEqual({
      valid: true,
      monthlyIncomeAmount: 20000,
      annualIncomeAmount: 240000,
      subsidyAmount: 510000,
      personnelTotal: 750000,
    });
  });

  test('rejects a monthly allocation greater than the CPCS2 monthly salary', () => {
    const result = resolvePersonnelIncomeAllocation(permanentCpcs2, {
      chargedToIncomeMonthlyAmount: 50000.01,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cannot exceed monthly salary/i);
  });

  test('retains compatibility with an existing annual charged amount', () => {
    expect(
      resolvePersonnelIncomeAllocation(permanentCpcs2, {
        chargedToIncomeAmount: 120000,
      })
    ).toEqual({
      valid: true,
      monthlyIncomeAmount: 10000,
      annualIncomeAmount: 120000,
      subsidyAmount: 630000,
      personnelTotal: 750000,
    });
  });

  test('rejects an annual allocation greater than the personnel total', () => {
    const result = resolvePersonnelIncomeAllocation(permanentCpcs2, {
      chargedToIncomeAmount: 800000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cannot exceed personnel total/i);
  });

  test('splits aggregate personnel funding without double-counting', () => {
    expect(splitPersonnelFunding(750000, 240000)).toEqual({
      incomeAmount: 240000,
      subsidyAmount: 510000,
    });
  });

  test('caps invalid legacy Income totals at the personnel total', () => {
    expect(splitPersonnelFunding(750000, 900000)).toEqual({
      incomeAmount: 750000,
      subsidyAmount: 0,
    });
  });
});

describe('automatic permanent salary Income allocation', () => {
  const record = { statusOfAppointment: 'Permanent', monthlySalary: 50000, annualSalary: 600000, Total: 750000 };

  test('allocates salary only and leaves all remaining costs in Subsidy', () => {
    expect(applyPermanentIncomeAllocation(record, { monthlyAmount: 20000 })).toMatchObject({
      chargedToIncomeEligible: true,
      chargedToIncomeMonthlyAmount: 20000,
      chargedToIncomeAmount: 240000,
      chargedToSubsidyAmount: 510000,
    });
  });

  test('caps lower-paid personnel at their salary, leaving benefits in Subsidy', () => {
    expect(applyPermanentIncomeAllocation(record, { monthlyAmount: 60000 })).toMatchObject({
      chargedToIncomeMonthlyAmount: 50000,
      chargedToIncomeAmount: 600000,
      chargedToSubsidyAmount: 150000,
    });
  });

  test('zero clears an existing charge and returns the full cost to Subsidy', () => {
    expect(applyPermanentIncomeAllocation({ ...record, chargedToIncomeAmount: 240000 }, { monthlyAmount: 0 }))
      .toMatchObject({ chargedToIncomeEligible: false, chargedToIncomeAmount: 0, chargedToSubsidyAmount: 750000 });
  });

  test('does not change manual allocations without a saved rule or for casual personnel', () => {
    expect(applyPermanentIncomeAllocation(record, {})).toEqual({});
    expect(applyPermanentIncomeAllocation(record, undefined)).toEqual({});
    expect(applyPermanentIncomeAllocation({ ...record, statusOfAppointment: 'CASUAL' }, { monthlyAmount: 20000 })).toEqual({});
  });

  test('reapplying a rule is idempotent and keeps the split within the personnel total', () => {
    const reduced = { ...record, annualSalary: 300000, Total: 350000 };
    const config = { monthlyAmount: 40000 };
    const allocation = applyPermanentIncomeAllocation(reduced, config);
    expect(allocation.chargedToIncomeAmount).toBe(300000);
    expect(allocation.chargedToIncomeAmount + allocation.chargedToSubsidyAmount).toBe(350000);
    expect(applyPermanentIncomeAllocation({ ...reduced, ...allocation }, config)).toEqual(allocation);
  });

  test('charges only the recorded increment, without adding it to salary or benefits', () => {
    const personnel = { ...record, monthlySalaryIncrement: 5000 };
    expect(applyPermanentIncomeAllocation(personnel, { mode: 'INCREMENT_ONLY' })).toMatchObject({
      chargedToIncomeEligible: true,
      chargedToIncomeMonthlyAmount: 5000,
      chargedToIncomeAmount: 60000,
      chargedToSubsidyAmount: 690000,
    });
    expect(personnel.Total).toBe(750000);
    expect(personnel.monthlySalary).toBe(50000);
  });

  test.each([undefined, 0])('increment-only clears old charges for a record with increment %p', monthlySalaryIncrement => {
    const result = applyPermanentIncomeAllocation({ ...record, monthlySalaryIncrement, chargedToIncomeAmount: 240000 }, { mode: 'INCREMENT_ONLY' });
    expect(result).toMatchObject({ chargedToIncomeEligible: false, chargedToIncomeAmount: 0, chargedToIncomeMonthlyAmount: 0, chargedToSubsidyAmount: 750000 });
  });

  test('switching to all permanent includes records with no increment and replaces the previous split', () => {
    for (const monthlySalaryIncrement of [0, 5000]) {
      const row = { ...record, monthlySalaryIncrement };
      const first = applyPermanentIncomeAllocation(row, { mode: 'INCREMENT_ONLY' });
      const all = applyPermanentIncomeAllocation({ ...row, ...first }, { mode: 'ALL_PERMANENT', monthlyAmount: 12000 });
      expect(all).toMatchObject({ chargedToIncomeEligible: true, chargedToIncomeAmount: 144000, chargedToSubsidyAmount: 606000 });
    }
  });

  test('does not apply increment-only mode to casual personnel', () => {
    expect(applyPermanentIncomeAllocation({ ...record, statusOfAppointment: 'CASUAL', monthlySalaryIncrement: 5000 }, { mode: 'INCREMENT_ONLY' })).toEqual({});
  });
});

describe('full salary funded by Income', () => {
  const row = { statusOfAppointment: 'PERMANENT', monthlySalary: 33000, annualSalary: 396000,
    PERA: 24000, earnedLeaves: 12000, gsisPremium: 48000, Total: 480000, monthlySalaryIncrement: 3000 };
  const config = { mode: 'FULL_SALARY' };

  test('funds only salary, preserves benefits and the real increment, and is idempotent', () => {
    const allocation = applyPermanentIncomeAllocation(row, config);
    expect(allocation).toMatchObject({ annualSalary: 396000, Total: 480000,
      salarySubsidyMonthlyAmount: 0, chargedToIncomeMonthlyAmount: 33000,
      chargedToIncomeAmount: 396000, chargedToSubsidyAmount: 84000,
      cpcs1MonthlySalary: null, cpcs2MonthlySalary: null });
    expect(allocation).not.toHaveProperty('monthlySalary');
    expect(allocation).not.toHaveProperty('monthlySalaryIncrement');
    expect(allocation).not.toHaveProperty('PERA');
    expect(applyPermanentIncomeAllocation({ ...row, ...allocation }, config)).toEqual(allocation);
    expect(row.monthlySalaryIncrement).toBe(3000);
  });

  test.each([0, -1, NaN, Infinity, undefined])('rejects invalid saved salary %p', monthlySalary => {
    expect(() => applyPermanentIncomeAllocation({ ...row, monthlySalary }, config)).toThrow('valid saved monthly salary');
  });

  test('does not require a grade or step, and does not apply to casual personnel', () => {
    expect(applyPermanentIncomeAllocation(row, config).chargedToIncomeAmount).toBe(396000);
    expect(applyPermanentIncomeAllocation({ ...row, statusOfAppointment: 'CASUAL' }, config)).toEqual({});
  });

  test('switches from full salary back to the Step 1 split', () => {
    const full = { ...row, ...applyPermanentIncomeAllocation(row, config), step: 2, gradelevel_SG: 10 };
    const step = applyPermanentIncomeAllocation(full, { mode: 'STEP_INCREMENT',
      referenceTables: { stepBase: { matchBy: 'SG', rows: [{ sg: 10, rates: { 1: 30000 } }] } } });
    expect(step).toMatchObject({ chargedToIncomeAmount: 36000, chargedToSubsidyAmount: 444000, salarySubsidyMonthlyAmount: 30000 });
  });

  test('reports salary as Income and every benefit as Subsidy', () => {
    const { personnelItemFunding, summarizePersonnelFunding } = require('../../utils/personnelReportFunding');
    const full = { ...row, ...applyPermanentIncomeAllocation(row, config) };
    expect(personnelItemFunding(full, 'annualSalary', full.annualSalary)).toEqual({ incomeAmount: 396000, subsidyAmount: 0 });
    for (const field of ['PERA', 'earnedLeaves', 'gsisPremium']) {
      expect(personnelItemFunding(full, field, full[field])).toEqual({ incomeAmount: 0, subsidyAmount: full[field] });
    }
    expect(summarizePersonnelFunding([full])).toEqual({ total: 480000, income: 396000, subsidy: 84000,
      salaryTotal: 396000, salaryIncome: 396000, salarySubsidy: 0 });
    expect(personnelItemFunding({ ...full, budgetType: 'NEP',
      nepAllocations: { PERA: { income: 5000, subsidy: 19000 } } }, 'PERA', 24000))
      .toEqual({ incomeAmount: 5000, subsidyAmount: 19000 });
  });
});
