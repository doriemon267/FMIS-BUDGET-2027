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
// Test medical allowance calculation
); // Should be 0
); // Should be 2400 (200 * 12)
); // Should be 4800 (400 * 12)
); // Should be 9600 (800 * 12)
:", calculateMedicalAllowance(5, 200)); // Should be 9600 (capped at 4)
// Test meal allowance calculation
:", calculateMonthlyMealAllowance(22, 200)); // Should be 4400
:", calculateMealAllowance(22, 200)); // Should be 52800 (4400 * 12)
// Test eligibility
const eligibleDate = new Date("1987-05-15"); // Before June 1988
const ineligibleDate = new Date("1989-05-15"); // After June 1988
); // Should be true
); // Should be false
); // Should be true
); // Should be false
// Test default rates
const emptySettings = {};
const settingsWithValues = { medicalAllowance: 250, meal: 300 };
const settingsWithDefaults = { medicalAllowance: 200, meal: 200 };
); // Should use defaults
); // Should use provided values
); // Should use 200
// Test employee allowance calculation
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
// Expected results summary:
");
: 4,800 pesos");
: 52,800 pesos");