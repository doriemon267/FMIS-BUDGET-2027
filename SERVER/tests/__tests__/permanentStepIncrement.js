const { applyPermanentIncomeAllocation } = require('../../utils/personnelIncomeAllocation');
const { personnelItemFunding, summarizePersonnelFunding } = require('../../utils/personnelReportFunding');
const config = matchBy => ({ mode: 'STEP_INCREMENT', referenceTables: {
  stepBase: { matchBy, rows: [{ jg: 5, sg: 10, rates: { 1: 30000, 2: 31000 } }] },
} });
const person = (step = 2, monthlySalary = 31500) => ({
  statusOfAppointment: 'PERMANENT', gradelevel_JG: 'JG 5', gradelevel_SG: 'SG-10',
  step, monthlySalary, annualSalary: monthlySalary * 12, PERA: 24000, providentFund: 12000,
});

describe.each(['JG', 'SG'])('Step increase using %s', matchBy => {
  test.each([2, 3, 4, 5, 6, 7, 8])('uses saved salary minus Step 1 for Step %i', step => {
    const record = person(step, 30000 + step * 100);
    const result = applyPermanentIncomeAllocation(record, config(matchBy));
    expect(result).toMatchObject({ salarySubsidyMonthlyAmount: 30000,
      monthlySalaryIncrement: step * 100, chargedToIncomeMonthlyAmount: step * 100,
      chargedToIncomeAmount: step * 1200, chargedToIncomeEligible: true,
      chargedToSubsidyAmount: 396000, cpcs1MonthlySalary: null, cpcs2MonthlySalary: null,
    });
    expect(result).not.toHaveProperty('monthlySalary');
    expect(result.Total).toBe(record.annualSalary + 36000);
    expect(applyPermanentIncomeAllocation({ ...record, ...result }, config(matchBy))).toEqual(result);
  });
  test('Step 1 at the base salary clears any previous Income allocation', () => {
    const result = applyPermanentIncomeAllocation({ ...person(1, 30000), chargedToIncomeAmount: 5000 }, config(matchBy));
    expect(result).toMatchObject({ chargedToIncomeEligible: false, chargedToIncomeAmount: 0, monthlySalaryIncrement: 0 });
  });
});

test('preserves imported salary even when the table current-step rate differs', () => {
  const record = person();
  const result = applyPermanentIncomeAllocation(record, config('JG'));
  expect(result.chargedToIncomeMonthlyAmount).toBe(1500);
  expect(result).not.toHaveProperty('monthlySalary');
  expect(record.monthlySalary).toBe(31500);
});
test.each([0, -1, NaN, Infinity, undefined])('rejects invalid saved salary %p', monthlySalary => {
  expect(() => applyPermanentIncomeAllocation({ ...person(), monthlySalary }, config('SG'))).toThrow('valid saved monthly salary');
});
test('rejects a salary below Step 1 and a missing Step 1 rate', () => {
  expect(() => applyPermanentIncomeAllocation(person(2, 29000), config('SG'))).toThrow('lower than the Step 1');
  const missing = config('SG');
  delete missing.referenceTables.stepBase.rows[0].rates[1];
  expect(() => applyPermanentIncomeAllocation(person(), missing)).toThrow('missing or invalid rate');
});
test.each([0, 9, '', undefined])('rejects invalid employee step %p', step => {
  expect(() => applyPermanentIncomeAllocation({ ...person(), step }, config('JG'))).toThrow('Step must');
});
test('does not allocate casual personnel', () => {
  expect(applyPermanentIncomeAllocation({ ...person(), statusOfAppointment: 'CASUAL' }, config('SG'))).toEqual({});
});
test('reports the entire step increase under salary and keeps benefits under Subsidy', () => {
  const row = { ...person(), ...applyPermanentIncomeAllocation(person(), config('JG')) };
  expect(personnelItemFunding(row, 'annualSalary', row.annualSalary)).toEqual({ incomeAmount: 18000, subsidyAmount: 360000 });
  expect(personnelItemFunding(row, 'PERA', row.PERA)).toEqual({ incomeAmount: 0, subsidyAmount: 24000 });
  expect(summarizePersonnelFunding([row])).toEqual({ total: 414000, income: 18000, subsidy: 396000,
    salaryTotal: 378000, salaryIncome: 18000, salarySubsidy: 360000 });
});
