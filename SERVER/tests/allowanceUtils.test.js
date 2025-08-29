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

console.log("=== Testing Allowance Utilities ===");

// Test medical allowance calculation
console.log("\n--- Medical Allowance Tests ---");
console.log("0 dependents:", calculateMedicalAllowance(0, 200)); // Should be 0
console.log("1 dependent:", calculateMedicalAllowance(1, 200)); // Should be 2400 (200 * 12)
console.log("2 dependents:", calculateMedicalAllowance(2, 200)); // Should be 4800 (400 * 12)
console.log("4 dependents:", calculateMedicalAllowance(4, 200)); // Should be 9600 (800 * 12)
console.log("5 dependents (max 4):", calculateMedicalAllowance(5, 200)); // Should be 9600 (capped at 4)

// Test meal allowance calculation
console.log("\n--- Meal Allowance Tests ---");
console.log("22 days, 200 rate (monthly):", calculateMonthlyMealAllowance(22, 200)); // Should be 4400
console.log("22 days, 200 rate (annual):", calculateMealAllowance(22, 200)); // Should be 52800 (4400 * 12)

// Test eligibility
console.log("\n--- Eligibility Tests ---");
const eligibleDate = new Date("1987-05-15"); // Before June 1988
const ineligibleDate = new Date("1989-05-15"); // After June 1988

console.log("Hired May 1987 - Meal eligible:", isEligibleForMealAllowance(eligibleDate)); // Should be true
console.log("Hired May 1989 - Meal eligible:", isEligibleForMealAllowance(ineligibleDate)); // Should be false
console.log("Hired May 1987 - Medical eligible:", isEligibleForMedicalAllowance(eligibleDate)); // Should be true
console.log("Hired May 1989 - Medical eligible:", isEligibleForMedicalAllowance(ineligibleDate)); // Should be false

// Test default rates
console.log("\n--- Default Rates Tests ---");
const emptySettings = {};
const settingsWithValues = { medicalAllowance: 250, meal: 300 };
const settingsWithDefaults = { medicalAllowance: 200, meal: 200 };

console.log("Empty settings:", getAllowanceRates(emptySettings)); // Should use defaults
console.log("Settings with values:", getAllowanceRates(settingsWithValues)); // Should use provided values
console.log("Settings with defaults:", getAllowanceRates(settingsWithDefaults)); // Should use 200

// Test employee allowance calculation
console.log("\n--- Employee Allowance Calculation Tests ---");
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

console.log("Eligible employee allowances:");
const eligibleAllowances = calculateEmployeeAllowances(eligibleEmployee, settings);
console.log("- Medical eligible:", eligibleAllowances.medicalAllowance.eligible);
console.log("- Medical annual amount:", eligibleAllowances.medicalAllowance.annualAmount);
console.log("- Meal eligible:", eligibleAllowances.mealAllowance.eligible);
console.log("- Meal annual amount:", eligibleAllowances.mealAllowance.annualAmount);

console.log("\nIneligible employee allowances:");
const ineligibleAllowances = calculateEmployeeAllowances(ineligibleEmployee, settings);
console.log("- Medical eligible:", ineligibleAllowances.medicalAllowance.eligible);
console.log("- Medical annual amount:", ineligibleAllowances.medicalAllowance.annualAmount);
console.log("- Meal eligible:", ineligibleAllowances.mealAllowance.eligible);
console.log("- Meal annual amount:", ineligibleAllowances.mealAllowance.annualAmount);

console.log("\n=== All tests completed ===");

// Expected results summary:
console.log("\n--- Expected Results Summary ---");
console.log("✓ Medical allowance: 200 pesos per month per dependent (max 4 dependents)");
console.log("✓ Meal allowance: 200 pesos per day for 22 working days = 4,400 per month");
console.log("✓ Annual medical (2 dependents): 4,800 pesos");
console.log("✓ Annual meal (eligible): 52,800 pesos");
console.log("✓ Eligibility: Hired before June 1, 1988");
console.log("✓ Default values: 200 pesos when not specified in settings");
