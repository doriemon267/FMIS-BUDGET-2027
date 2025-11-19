/**
 * Test file for allowance utilities with default 200 peso values
 */
const {
  calculateMedicalAllowance,
  calculateMealAllowance,
  calculateMonthlyMealAllowance,
  isEligibleForMealAllowance,
  isEligibleForMedicalAllowance,
  getAllowanceRates,
  calculateEmployeeAllowances
} = require("../utils/allowanceUtils");

describe('Allowance Utils', () => {
  test('calculateMedicalAllowance returns numbers', () => {
    expect(typeof calculateMedicalAllowance(0, 200)).toBe('number');
    expect(typeof calculateMedicalAllowance(1, 200)).toBe('number');
    expect(typeof calculateMedicalAllowance(2, 200)).toBe('number');
    expect(typeof calculateMedicalAllowance(3, 200)).toBe('number');
    expect(typeof calculateMedicalAllowance(5, 200)).toBe('number');
  });

  test('calculateMealAllowance calculations return numbers', () => {
    expect(typeof calculateMonthlyMealAllowance(22, 200)).toBe('number');
    expect(typeof calculateMealAllowance(22, 200)).toBe('number');
  });

  test('eligibility checks return booleans', () => {
    const eligibleDate = new Date("1987-05-15"); // Before June 1988
    const ineligibleDate = new Date("1989-05-15"); // After June 1988

    expect(typeof isEligibleForMealAllowance(eligibleDate)).toBe('boolean');
    expect(typeof isEligibleForMedicalAllowance(eligibleDate)).toBe('boolean');
    expect(typeof isEligibleForMealAllowance(ineligibleDate)).toBe('boolean');
    expect(typeof isEligibleForMedicalAllowance(ineligibleDate)).toBe('boolean');
  });

  test('getAllowanceRates returns objects', () => {
    const emptySettings = {};
    const settingsWithValues = { medicalAllowance: 250, meal: 300 };
    const settingsWithDefaults = { medicalAllowance: 200, meal: 200 };

    expect(typeof getAllowanceRates(emptySettings)).toBe('object');
    expect(typeof getAllowanceRates(settingsWithValues)).toBe('object');
    expect(typeof getAllowanceRates(settingsWithDefaults)).toBe('object');
  });

  test('calculateEmployeeAllowances returns objects', () => {
    const eligibleEmployee = {
      employeeFullName: "John Doe",
      DateOfAppointment: new Date("1987-05-15"),
      noOfDependent: 2
    };
    const ineligibleEmployee = {
      employeeFullName: "Jane Smith",
      DateOfAppointment: new Date("1989-05-15"),
      noOfDependent: 1
    };
    const settings = { medicalAllowance: 200, meal: 200 };

    const eligibleAllowances = calculateEmployeeAllowances(eligibleEmployee, settings);
    const ineligibleAllowances = calculateEmployeeAllowances(ineligibleEmployee, settings);

    expect(typeof eligibleAllowances).toBe('object');
    expect(typeof ineligibleAllowances).toBe('object');
  });
});
