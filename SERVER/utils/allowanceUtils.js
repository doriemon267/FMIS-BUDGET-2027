/**
 * Utility functions for allowance calculations
 */
/**
 * Calculate annual medical allowance based on number of dependents
 * @param {number} dependents - Number of dependents (max 4)
 * @param {number} monthlyRate - Monthly rate per dependent (default: 200)
 * @returns {number} - Annual medical allowance amount
 */
function calculateMedicalAllowance(dependents, monthlyRate = 200) {
  const validDependents = Math.min(Math.max(0, dependents), 4); // Ensure 0-4 range
  return validDependents * monthlyRate * 12; // Annual amount
}
/**
 * Calculate annual meal allowance for eligible employees
 * @param {number} actualDays - Number of working days (typically 22)
 * @param {number} dailyRate - Daily meal allowance rate (default: 200)
 * @returns {number} - Annual meal allowance amount
 */
function calculateMealAllowance(actualDays = 22, dailyRate = 200) {
  const monthlyAmount = actualDays * dailyRate;
  return monthlyAmount * 12; // Annual amount
}
/**
 * Calculate monthly meal allowance for eligible employees
 * @param {number} actualDays - Number of working days (typically 22)
 * @param {number} dailyRate - Daily meal allowance rate (default: 200)
 * @returns {number} - Monthly meal allowance amount
 */
function calculateMonthlyMealAllowance(actualDays = 22, dailyRate = 200) {
  return actualDays * dailyRate;
}
/**
 * Check if employee is eligible for meal allowance (hired before June 1988)
 * @param {Date} appointmentDate - Employee's appointment date
 * @returns {boolean} - Whether employee is eligible for meal allowance
 */
function isEligibleForMealAllowance(appointmentDate) {
  if (!appointmentDate) return false;
  const cutoffDate = new Date("1988-12-31");
  return new Date(appointmentDate) < cutoffDate;
}
/**
 * Check if employee is eligible for medical allowance (hired before June 1988)
 * @param {Date} appointmentDate - Employee's appointment date
 * @returns {boolean} - Whether employee is eligible for medical allowance
 */
function isEligibleForMedicalAllowance(appointmentDate) {
  if (!appointmentDate) return false;
  const cutoffDate = new Date("1988-12-31");
  return new Date(appointmentDate) < cutoffDate;
}
/**
 * Get default allowance rates from settings or use fallback values
 * @param {Object} settings - Settings object from database
 * @returns {Object} - Object containing medical and meal allowance rates
 */
function getAllowanceRates(settings) {
  return {
    medicalAllowance: settings?.compensationSettingsId?.medicalAllowance ?? settings?.medicalAllowance ?? 200,
    mealAllowance: settings?.compensationSettingsId?.meal ?? settings?.meal ?? 200
  };
}
/**
 * Format allowance amount for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: PHP)
 * @returns {string} - Formatted amount string
 */
function formatAllowanceAmount(amount, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency
  }).format(amount);
}
/**
 * Calculate total allowances for an employee
 * @param {Object} employee - Employee object with dependents and appointment date
 * @param {Object} settings - Settings object with allowance rates
 * @returns {Object} - Object containing calculated allowances
 */
function calculateEmployeeAllowances(employee, settings) {
  const rates = getAllowanceRates(settings);
  const dependents = Math.min(Math.max(0, employee.noOfDependent || 0), 4);
  const result = {
    medicalAllowance: {
      eligible: isEligibleForMedicalAllowance(employee.DateOfAppointment),
      dependents: dependents,
      monthlyRate: rates.medicalAllowance,
      annualAmount: 0
    },
    mealAllowance: {
      eligible: isEligibleForMealAllowance(employee.DateOfAppointment),
      dailyRate: rates.mealAllowance,
      workingDays: 22,
      annualAmount: 0
    }
  };
  // Calculate amounts only if eligible
  if (result.medicalAllowance.eligible) {
    result.medicalAllowance.annualAmount = calculateMedicalAllowance(dependents, rates.medicalAllowance);
  }
  if (result.mealAllowance.eligible) {
    result.mealAllowance.annualAmount = calculateMealAllowance(22, rates.mealAllowance);
  }
  return result;
}
module.exports = {
  calculateMedicalAllowance,
  calculateMealAllowance,
  calculateMonthlyMealAllowance,
  isEligibleForMealAllowance,
  isEligibleForMedicalAllowance,
  getAllowanceRates,
  formatAllowanceAmount,
  calculateEmployeeAllowances
};
