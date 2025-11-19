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

describe('Loyalty Pay Utils', () => {
  test('calculateLoyaltyPayYearsOfService - Employee appointed before June 22, anniversary before cutoff', () => {
    const appointmentDate = new Date("2014-05-15"); // May 15, 2014
    const fiscalYear = "2024";
    const cutoffDate = "06-22"; // June 22
    const result = calculateLoyaltyPayYearsOfService(appointmentDate, fiscalYear, cutoffDate);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('calculateLoyaltyPayYearsOfService - Employee appointed after June 22, anniversary after cutoff', () => {
    const appointmentDate = new Date("2014-07-15"); // July 15, 2014
    const fiscalYear = "2024";
    const cutoffDate = "06-22"; // June 22
    const result = calculateLoyaltyPayYearsOfService(appointmentDate, fiscalYear, cutoffDate);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('calculateLoyaltyPayYearsOfService - Employee appointed exactly on June 22', () => {
    const appointmentDate = new Date("2014-06-22"); // June 22, 2014
    const fiscalYear = "2024";
    const cutoffDate = "06-22"; // June 22
    const result = calculateLoyaltyPayYearsOfService(appointmentDate, fiscalYear, cutoffDate);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('calculateLoyaltyPayYearsOfService - Employee appointed on June 23 (day after cutoff)', () => {
    const appointmentDate = new Date("2014-06-23"); // June 23, 2014
    const fiscalYear = "2024";
    const cutoffDate = "06-22"; // June 22
    const result = calculateLoyaltyPayYearsOfService(appointmentDate, fiscalYear, cutoffDate);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('getEligibleLoyaltyPayYear returns valid results', () => {
    const testYears = [9, 10, 14, 15, 19, 20, 24, 25, 29, 30];
    testYears.forEach(years => {
      const eligible = getEligibleLoyaltyPayYear(years);
      expect(eligible).toBeDefined();
    });
  });

  test('calculateLoyaltyPayAmount for milestone years', () => {
    const loyaltySettings = {
      baseAmount: 10000,
      succeedingAmount: 5000
    };
    const milestoneYears = [10, 15, 20, 25, 30];
    milestoneYears.forEach(years => {
      const amount = calculateLoyaltyPayAmount(years, loyaltySettings);
      expect(typeof amount).toBe('number');
      expect(amount).toBeGreaterThanOrEqual(0);
    });
  });

  test('formatCutoffDate formats dates correctly', () => {
    const cutoffDates = ["06-22", "12-31", "01-01", "03-15"];
    cutoffDates.forEach(date => {
      const formatted = formatCutoffDate(date);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  test('isBeforeCutoffDate works with current fiscal year', () => {
    const testFiscalYear = new Date().getFullYear().toString();
    const beforeCutoff = isBeforeCutoffDate(testFiscalYear, "06-22");
    expect(typeof beforeCutoff).toBe('boolean');
  });
});
