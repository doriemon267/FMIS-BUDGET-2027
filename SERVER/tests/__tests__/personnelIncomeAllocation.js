const {
  resolvePersonnelIncomeAllocation,
  splitPersonnelFunding,
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
