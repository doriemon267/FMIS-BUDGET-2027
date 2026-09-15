const { roundTo2Decimals } = require('./roundCurrency');

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

/**
 * Resolve the annual Income/Subsidy split for one personnel record.
 * New CPCS2 allocations are entered as a monthly amount, while the stored
 * chargedToIncomeAmount remains annual so existing proposal totals continue
 * to use one consistent unit.
 */
function resolvePersonnelIncomeAllocation(record, payload = {}, defaultAmount = 0) {
  const monthlySalary = Math.max(0, toAmount(record?.monthlySalary));
  const annualSalary = Math.max(0, toAmount(record?.annualSalary) || monthlySalary * 12);
  const personnelTotal = Math.max(
    0,
    toAmount(record?.Total ?? record?.total) || annualSalary
  );

  const hasMonthlyAllocation =
    payload.chargedToIncomeMonthlyAmount !== undefined &&
    payload.chargedToIncomeMonthlyAmount !== null &&
    payload.chargedToIncomeMonthlyAmount !== '';

  let monthlyIncomeAmount = 0;
  let annualIncomeAmount = 0;

  if (hasMonthlyAllocation) {
    monthlyIncomeAmount = toAmount(payload.chargedToIncomeMonthlyAmount);
    if (monthlyIncomeAmount <= 0) {
      return { valid: false, reason: 'Monthly Income allocation must be greater than zero' };
    }
    if (monthlySalary <= 0) {
      return { valid: false, reason: 'Employee has no valid monthly salary' };
    }
    if (monthlyIncomeAmount > monthlySalary) {
      return {
        valid: false,
        reason: `Monthly Income allocation cannot exceed monthly salary (${monthlySalary})`,
      };
    }
    annualIncomeAmount = monthlyIncomeAmount * 12;
  } else {
    // Backward-compatible path for callers that already send annual amounts.
    annualIncomeAmount = toAmount(payload.chargedToIncomeAmount ?? defaultAmount);
    if (annualIncomeAmount <= 0) annualIncomeAmount = personnelTotal;
    if (annualIncomeAmount <= annualSalary && annualIncomeAmount > 0) {
      monthlyIncomeAmount = annualIncomeAmount / 12;
    }
  }

  if (annualIncomeAmount > personnelTotal) {
    return {
      valid: false,
      reason: `Annual Income allocation cannot exceed personnel total (${personnelTotal})`,
    };
  }

  return {
    valid: true,
    monthlyIncomeAmount: roundTo2Decimals(monthlyIncomeAmount),
    annualIncomeAmount: roundTo2Decimals(annualIncomeAmount),
    subsidyAmount: roundTo2Decimals(Math.max(0, personnelTotal - annualIncomeAmount)),
    personnelTotal: roundTo2Decimals(personnelTotal),
  };
}

function splitPersonnelFunding(personnelTotalValue, chargedToIncomeValue) {
  const personnelTotal = Math.max(0, toAmount(personnelTotalValue));
  const incomeAmount = Math.min(
    personnelTotal,
    Math.max(0, toAmount(chargedToIncomeValue))
  );

  return {
    incomeAmount: roundTo2Decimals(incomeAmount),
    subsidyAmount: roundTo2Decimals(personnelTotal - incomeAmount),
  };
}

module.exports = { resolvePersonnelIncomeAllocation, splitPersonnelFunding };
