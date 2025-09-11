/**
 * Utility functions for loyalty pay calculations with June 22 cutoff date
 */
/**
 * Calculate years of service with loyalty pay cutoff date consideration
 * @param {Date} appointmentDate - Employee's date of appointment
 * @param {string} fiscalYear - Current fiscal year (e.g., "2024")
 * @param {string} cutoffDate - Cutoff date in MM-DD format (e.g., "06-22")
 * @returns {number} - Eligible years of service for loyalty pay
 */
function calculateLoyaltyPayYearsOfService(appointmentDate, fiscalYear, cutoffDate = "06-22") {
  if (!appointmentDate || !fiscalYear) {
    return 0;
  }
  const appointment = new Date(appointmentDate);
  const currentFiscalYear = parseInt(fiscalYear);
  // Parse cutoff date (MM-DD format)
  const [cutoffMonth, cutoffDay] = cutoffDate.split("-").map(Number);
  // Create cutoff date for the current fiscal year
  const cutoffDateThisYear = new Date(currentFiscalYear, cutoffMonth - 1, cutoffDay);
  // Calculate base years of service
  let yearsOfService = currentFiscalYear - appointment.getFullYear();
  // Check if the employee's service anniversary falls on or before the cutoff date
  const serviceAnniversaryThisYear = new Date(
    currentFiscalYear, 
    appointment.getMonth(), 
    appointment.getDate()
  );
  // If the service anniversary is after the cutoff date, subtract one year
  if (serviceAnniversaryThisYear > cutoffDateThisYear) {
    yearsOfService -= 1;
  }
  // Ensure we don't return negative years
  return Math.max(0, yearsOfService);
}
/**
 * Check if an employee is eligible for loyalty pay based on years of service
 * @param {number} yearsOfService - Years of service calculated with cutoff
 * @returns {boolean} - Whether employee is eligible
 */
function isEligibleForLoyaltyPay(yearsOfService) {
  const validYears = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  return validYears.includes(yearsOfService);
}
/**
 * Get the loyalty pay milestone year if the employee has exactly reached it
 * @param {number} yearsOfService - Years of service calculated with cutoff
 * @returns {number|null} - Exact milestone year reached, or null if not eligible
 */
function getEligibleLoyaltyPayYear(yearsOfService) {
  const validYears = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  // Check if the years of service exactly matches a milestone year
  if (validYears.includes(yearsOfService)) {
    return yearsOfService;
  }
  return null;
}
/**
 * Calculate loyalty pay amount based on years of service and settings
 * @param {number} yearsOfService - Years of service calculated with cutoff
 * @param {Object} loyaltyPaySettings - Loyalty pay settings from database
 * @returns {number} - Calculated loyalty pay amount
 */
function calculateLoyaltyPayAmount(yearsOfService, loyaltyPaySettings) {
  if (!loyaltyPaySettings || !isEligibleForLoyaltyPay(yearsOfService)) {
    return 0;
  }
  const { baseAmount, succeedingAmount } = loyaltyPaySettings;
  if (baseAmount === undefined || succeedingAmount === undefined) {
    return 0;
  }
  // First milestone (10 years) gets base amount, all others get succeeding amount
  return yearsOfService === 10 ? baseAmount : succeedingAmount;
}
/**
 * Check if current date is before the loyalty pay cutoff date for the fiscal year
 * @param {string} fiscalYear - Current fiscal year (e.g., "2024")
 * @param {string} cutoffDate - Cutoff date in MM-DD format (e.g., "06-22")
 * @returns {boolean} - Whether current date is before cutoff
 */
function isBeforeCutoffDate(fiscalYear, cutoffDate = "06-22") {
  const currentDate = new Date();
  const currentFiscalYear = parseInt(fiscalYear);
  // Parse cutoff date (MM-DD format)
  const [cutoffMonth, cutoffDay] = cutoffDate.split("-").map(Number);
  // Create cutoff date for the current fiscal year
  const cutoffDateThisYear = new Date(currentFiscalYear, cutoffMonth - 1, cutoffDay);
  return currentDate <= cutoffDateThisYear;
}
/**
 * Format cutoff date for display
 * @param {string} cutoffDate - Cutoff date in MM-DD format (e.g., "06-22")
 * @returns {string} - Formatted date string (e.g., "June 22")
 */
function formatCutoffDate(cutoffDate = "06-22") {
  const [month, day] = cutoffDate.split("-").map(Number);
  const date = new Date(2000, month - 1, day); // Use dummy year for formatting
  return date.toLocaleDateString("en-US", { 
    month: "long", 
    day: "numeric" 
  });
}
module.exports = {
  calculateLoyaltyPayYearsOfService,
  isEligibleForLoyaltyPay,
  getEligibleLoyaltyPayYear,
  calculateLoyaltyPayAmount,
  isBeforeCutoffDate,
  formatCutoffDate
};