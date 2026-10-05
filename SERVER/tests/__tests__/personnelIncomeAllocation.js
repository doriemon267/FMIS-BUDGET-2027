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
