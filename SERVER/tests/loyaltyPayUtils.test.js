/**
 * Test file for loyalty pay utilities with June 22 cutoff date
 */

const {
  calculateLoyaltyPayYearsOfService,
  isEligibleForLoyaltyPay,
  getEligibleLoyaltyPayYear,
  calculateLoyaltyPayAmount,
  isBeforeCutoffDate,
  formatCutoffDate
} = require("../utils/loyaltyPayUtils");

// Test calculateLoyaltyPayYearsOfService function
console.log("=== Testing calculateLoyaltyPayYearsOfService ===");

// Test case 1: Employee appointed before June 22, anniversary before cutoff
const appointmentDate1 = new Date("2014-05-15"); // May 15, 2014
const fiscalYear1 = "2024";
const cutoffDate1 = "06-22"; // June 22
const result1 = calculateLoyaltyPayYearsOfService(appointmentDate1, fiscalYear1, cutoffDate1);
console.log(`Test 1 - Appointment: May 15, 2014, Fiscal Year: 2024, Cutoff: June 22`);
console.log(`Expected: 10 years (anniversary May 15 is before June 22), Got: ${result1}`);

// Test case 2: Employee appointed after June 22, anniversary after cutoff
const appointmentDate2 = new Date("2014-07-15"); // July 15, 2014
const fiscalYear2 = "2024";
const cutoffDate2 = "06-22"; // June 22
const result2 = calculateLoyaltyPayYearsOfService(appointmentDate2, fiscalYear2, cutoffDate2);
console.log(`Test 2 - Appointment: July 15, 2014, Fiscal Year: 2024, Cutoff: June 22`);
console.log(`Expected: 9 years (anniversary July 15 is after June 22), Got: ${result2}`);

// Test case 3: Employee appointed exactly on June 22
const appointmentDate3 = new Date("2014-06-22"); // June 22, 2014
const fiscalYear3 = "2024";
const cutoffDate3 = "06-22"; // June 22
const result3 = calculateLoyaltyPayYearsOfService(appointmentDate3, fiscalYear3, cutoffDate3);
console.log(`Test 3 - Appointment: June 22, 2014, Fiscal Year: 2024, Cutoff: June 22`);
console.log(`Expected: 10 years (anniversary June 22 is on cutoff), Got: ${result3}`);

// Test case 4: Employee appointed on June 23 (day after cutoff)
const appointmentDate4 = new Date("2014-06-23"); // June 23, 2014
const fiscalYear4 = "2024";
const cutoffDate4 = "06-22"; // June 22
const result4 = calculateLoyaltyPayYearsOfService(appointmentDate4, fiscalYear4, cutoffDate4);
console.log(`Test 4 - Appointment: June 23, 2014, Fiscal Year: 2024, Cutoff: June 22`);
console.log(`Expected: 9 years (anniversary June 23 is after June 22), Got: ${result4}`);

console.log("\n=== Testing getEligibleLoyaltyPayYear ===");

// Test eligible years
const testYears = [9, 10, 14, 15, 19, 20, 24, 25, 29, 30];
testYears.forEach(years => {
  const eligible = getEligibleLoyaltyPayYear(years);
  console.log(`${years} years of service -> Eligible for: ${eligible}`);
});

console.log("\n=== Testing calculateLoyaltyPayAmount ===");

const loyaltySettings = {
  baseAmount: 10000,
  succeedingAmount: 5000
};

// Test amounts for different milestone years
const milestoneYears = [10, 15, 20, 25, 30];
milestoneYears.forEach(years => {
  const amount = calculateLoyaltyPayAmount(years, loyaltySettings);
  console.log(`${years} years -> Amount: ₱${amount.toLocaleString()}`);
});

console.log("\n=== Testing formatCutoffDate ===");

const cutoffDates = ["06-22", "12-31", "01-01", "03-15"];
cutoffDates.forEach(date => {
  const formatted = formatCutoffDate(date);
  console.log(`${date} -> ${formatted}`);
});

console.log("\n=== Testing isBeforeCutoffDate ===");

// Note: This test will depend on the current date when run
const testFiscalYear = new Date().getFullYear().toString();
const beforeCutoff = isBeforeCutoffDate(testFiscalYear, "06-22");
console.log(`Current date is before June 22, ${testFiscalYear}: ${beforeCutoff}`);

console.log("\n=== All tests completed ===");
