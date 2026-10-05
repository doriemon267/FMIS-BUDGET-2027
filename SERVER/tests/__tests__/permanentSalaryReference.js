const { applyPermanentIncomeAllocation } = require('../../utils/personnelIncomeAllocation');
const { referenceRate } = require('../../utils/permanentSalaryReference');
const config = (current = 33000) => ({ mode: 'CPCS_DIFFERENCE', referenceTables: {
  cpcs1: { matchBy: 'JG', rows: [{ jg: 5, sg: 10, rates: { 1: 30000 } }] },
  cpcs2: { matchBy: 'SG', rows: [{ sg: 10, rates: { 1: current } }] },
} });
const person = () => ({ statusOfAppointment: 'PERMANENT', gradelevel_JG: 'JG 5', gradelevel_SG: 'SG-10', step: '1', monthlySalary: 30000, annualSalary: 360000, PERA: 24000, additionalMedical: 7000, providentFund: 12000 });

test('30000 subsidy plus 3000 income yields 33000 salary without counting the increment twice', () => {
  const result = applyPermanentIncomeAllocation(person(), config());
  expect(result).toMatchObject({ monthlySalary: 33000, annualSalary: 396000, monthlySalaryIncrement: 3000, chargedToIncomeMonthlyAmount: 3000, chargedToIncomeAmount: 36000, Total: 439000, chargedToSubsidyAmount: 403000 });
  expect(applyPermanentIncomeAllocation({ ...person(), ...result }, config())).toEqual(result);
});
test('equal salaries include personnel with zero income and clear a previous income allocation', () => {
  expect(applyPermanentIncomeAllocation({ ...person(), chargedToIncomeAmount: 5000 }, config(30000)))
    .toMatchObject({ chargedToIncomeEligible: false, monthlySalaryIncrement: 0, chargedToIncomeAmount: 0, chargedToSubsidyAmount: 403000 });
});
test('casual personnel are unaffected', () => {
  expect(applyPermanentIncomeAllocation({ ...person(), statusOfAppointment: 'CASUAL' }, config())).toEqual({});
});
test.each(['0', '9', '', undefined])('invalid step %p does not produce a guessed rate', step => {
  expect(() => applyPermanentIncomeAllocation({ ...person(), step }, config())).toThrow('Step');
});
test('lower CPCS 2 rate is rejected', () => {
  expect(() => applyPermanentIncomeAllocation(person(), config(29000))).toThrow('lower than CPCS 1');
});
test('duplicate job grades require an unambiguous salary grade match', () => {
  const table = { matchBy: 'JG', rows: [
    { jg: 5, sg: 9, rates: { 1: 27000 } }, { jg: 5, sg: 10, rates: { 1: 30000 } },
  ] };
  expect(referenceRate(person(), table, 'CPCS 1')).toBe(30000);
  expect(() => referenceRate({ ...person(), gradelevel_SG: '' }, table, 'CPCS 1')).toThrow('missing');
  table.rows.push({ jg: 5, sg: 10, rates: { 1: 33000 } });
  expect(() => referenceRate(person(), table, 'CPCS 1')).toThrow('ambiguous');
});
test.each([null, 0, NaN, Infinity])('invalid rate %p is rejected', rate => {
  expect(() => applyPermanentIncomeAllocation(person(), config(rate))).toThrow('invalid rate');
});
