const mongoose = require('mongoose');

const COS_PREMIUM_EFFECTIVE_DATE = new Date('2026-07-01T00:00:00.000Z');

const toWorkflowObjectId = (value, fieldName = 'proposalId') => {
  const candidate = value?._id || value;
  if (candidate instanceof mongoose.Types.ObjectId) return candidate;
  if (typeof candidate !== 'string' || !/^[a-f\d]{24}$/i.test(candidate.trim())) {
    const error = new Error(`${fieldName} must be a valid proposal identifier.`);
    error.statusCode = 400;
    throw error;
  }
  return new mongoose.Types.ObjectId(candidate.trim());
};

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeCOSKeyPart = (value) => String(value ?? '').trim().toUpperCase();

const isVacantCOSEmployee = (employee = {}) => {
  const name = normalizeCOSKeyPart(employee.EmployeeFullName ?? employee.employeeFullName);
  return name === 'VACANT' || name === 'TO-BE-FILLED';
};

const getCOSVacantKey = (employee = {}) => [
  employee.PositionTitle ?? employee.positionTitle,
  employee.Department ?? employee.department,
  employee.Division ?? employee.division,
  employee.SG ?? employee.gradelevel_SG,
].map(normalizeCOSKeyPart).join('|');

const resolveCOSEmployeeNumber = (employee = {}) => {
  const employeeId = normalizeCOSKeyPart(employee.EmployeeID ?? employee.employeeNumber);
  if (employeeId && !['VACANT', 'TO-BE-FILLED'].includes(employeeId)) return employeeId;
  if (!isVacantCOSEmployee(employee)) return '';

  const itemNumber = normalizeCOSKeyPart(employee.ItemNumber ?? employee.itemNumber);
  return `VACANT-${itemNumber || getCOSVacantKey(employee)}`;
};

const validatePremiumPercentage = (value) => {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    const error = new Error('COS/JO premium percentage must be a number from 0 to 100.');
    error.statusCode = 400;
    throw error;
  }
  if (Math.abs(Math.round(percentage * 100) - percentage * 100) > 1e-8) {
    const error = new Error('COS/JO premium percentage supports up to 2 decimal places.');
    error.statusCode = 400;
    throw error;
  }
  return percentage;
};

const normalizePremiumConfig = (config = {}) => ({
  enabled: Boolean(config.enabled),
  percentage: validatePremiumPercentage(config.percentage ?? 10),
  effectiveDate: COS_PREMIUM_EFFECTIVE_DATE,
});

const calculateCOSPremium = ({ annualSalary, fiscalYear, enabled, percentage }) => {
  const baseAnnualAmount = roundCurrency(Number(annualSalary) || 0);
  const year = Number(fiscalYear);
  const rate = validatePremiumPercentage(percentage ?? 10);
  const isEligible = Number.isFinite(year) && year >= 2026 && Boolean(enabled) && rate > 0;
  const premiumAmount = isEligible ? roundCurrency(baseAnnualAmount * (rate / 100)) : 0;

  return {
    baseAnnualAmount,
    premiumEnabled: Boolean(enabled),
    premiumRate: rate,
    premiumEffectiveDate: COS_PREMIUM_EFFECTIVE_DATE,
    premiumAmount,
    Total: roundCurrency(baseAnnualAmount + premiumAmount),
  };
};

const applyCOSPremium = (row = {}, config = {}, { monthlySalaryChanged = false } = {}) => {
  const monthlySalary = roundCurrency(Number(row.monthlySalary) || 0);
  const annualSalary = monthlySalaryChanged
    ? roundCurrency(monthlySalary * 12)
    : roundCurrency(Number(row.annualSalary) || monthlySalary * 12);
  return {
    monthlySalary,
    annualSalary,
    ...calculateCOSPremium({
      annualSalary,
      fiscalYear: row.fiscalYear,
      enabled: config.enabled,
      percentage: config.percentage,
    }),
  };
};

module.exports = {
  COS_PREMIUM_EFFECTIVE_DATE,
  applyCOSPremium,
  calculateCOSPremium,
  getCOSVacantKey,
  isVacantCOSEmployee,
  normalizePremiumConfig,
  normalizeCOSKeyPart,
  resolveCOSEmployeeNumber,
  roundCurrency,
  toWorkflowObjectId,
  validatePremiumPercentage,
};
