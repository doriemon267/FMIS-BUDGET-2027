/**
 * Validation utilities to reject negative values for budget/financial fields.
 * Use across Income, Personnel, MOOE, Capital Outlay (and details) to prevent negative amounts from being saved.
 */

/**
 * Check if a value is a negative number (including string numbers).
 * @param {*} value
 * @returns {boolean}
 */
function isNegative(value) {
  if (value === undefined || value === null) return false;
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  return n < 0;
}

/**
 * Validate a single object: no numeric field in the given list may be negative.
 * @param {Object} obj - Object to validate (e.g. req.body or one item)
 * @param {string[]} fieldNames - List of field names that must not be negative
 * @returns {{ valid: true } | { valid: false, message: string, field: string }}
 */
function validateNonNegativeFields(obj, fieldNames) {
  if (!obj || typeof obj !== 'object') return { valid: true };
  for (const field of fieldNames) {
    if (!Object.prototype.hasOwnProperty.call(obj, field)) continue;
    const value = obj[field];
    if (isNegative(value)) {
      return {
        valid: false,
        message: `Negative values are not allowed. Field "${field}" cannot be negative.`,
        field
      };
    }
  }
  return { valid: true };
}

/**
 * Validate an array of items: each item's given numeric fields must not be negative.
 * @param {Array} items - Array of objects to validate
 * @param {string[]} fieldNames - List of field names that must not be negative in each item
 * @returns {{ valid: true } | { valid: false, message: string, index?: number, field?: string }}
 */
function validateNonNegativeInItems(items, fieldNames) {
  if (!Array.isArray(items) || items.length === 0) return { valid: true };
  for (let i = 0; i < items.length; i++) {
    const result = validateNonNegativeFields(items[i], fieldNames);
    if (!result.valid) {
      return {
        valid: false,
        message: result.message + (items.length > 1 ? ` (item at index ${i})` : ''),
        index: i,
        field: result.field
      };
    }
  }
  return { valid: true };
}

// Field names that must not be negative per module (for reuse in controllers)
const INCOME_NUMERIC_FIELDS = ['cost', 'amount'];
const MOOE_NUMERIC_FIELDS = ['income', 'subsidy', 'amount', 'nis', 'cis'];
const CAPITAL_OUTLAY_NUMERIC_FIELDS = ['cost', 'income', 'subsidy', 'amount'];
const CAPITAL_OUTLAY_DETAILS_NUMERIC_FIELDS = ['income_amount', 'subsidy_amount'];

// Personnel: all salary/allowance/benefit numeric fields that must be >= 0
const PERSONNEL_NUMERIC_FIELDS = [
  'monthlySalary', 'noOfDependent', 'hazardPay', 'subsistenceAllowance', 'honoraria',
  'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive', 'medical',
  'ChildrenAllowance', 'midyearBonus', 'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST',
  'yearEndBonus', 'gsisPremium', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation',
  'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance',
  'Total', 'subsidyAmount', 'chargedToIncomeAmount', 'chargedToIncomeMonthlyAmount',
  'chargedToSubsidyAmount', 'chargedToIncomeSubsidyAmount', 'amount'
];

module.exports = {
  isNegative,
  validateNonNegativeFields,
  validateNonNegativeInItems,
  INCOME_NUMERIC_FIELDS,
  MOOE_NUMERIC_FIELDS,
  CAPITAL_OUTLAY_NUMERIC_FIELDS,
  CAPITAL_OUTLAY_DETAILS_NUMERIC_FIELDS,
  PERSONNEL_NUMERIC_FIELDS
};
