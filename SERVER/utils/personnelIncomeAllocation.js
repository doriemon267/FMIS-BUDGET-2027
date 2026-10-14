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

// Salary increments are recorded explicitly: an existing monthly rate alone
// cannot establish whether an employee received an increase.
function applyPermanentIncomeAllocation(record, config) {
  if (config?.mode === 'FULL_SALARY') {
    return require('./permanentSalaryReference').applyFullSalary(record, config);
  }
  if (config?.mode === 'STEP_INCREMENT') {
    return require('./permanentSalaryReference').applyStepIncrement(record, config);
  }
  if (config?.mode === 'CPCS_DIFFERENCE') {
    return require('./permanentSalaryReference').applySalaryReferences(record, config);
  }
  const incrementOnly = config?.mode === 'INCREMENT_ONLY';
  if ((!incrementOnly && config?.monthlyAmount == null) ||
      String(record.statusOfAppointment || '').trim().toUpperCase() !== 'PERMANENT') {
    return {};
  }
  const monthlySalary = Math.max(0, toAmount(record.monthlySalary));
  const annualSalary = Math.max(0, toAmount(record.annualSalary) || monthlySalary * 12);
  const total = Math.max(0, toAmount(record.Total ?? record.total) || annualSalary);
  const annualAmount = roundTo2Decimals(Math.min(
    Math.max(0, toAmount(incrementOnly ? record.monthlySalaryIncrement : config.monthlyAmount)) * 12,
    monthlySalary * 12,
    annualSalary,
    total
  ));
  return {
    salarySubsidyMonthlyAmount: null,
    chargedToIncomeEligible: annualAmount > 0,
    chargedToIncomeMonthlyAmount: roundTo2Decimals(annualAmount / 12),
    chargedToIncomeAmount: annualAmount,
    chargedToSubsidyAmount: roundTo2Decimals(total - annualAmount),
    chargedToIncomeSubsidyAmount: annualAmount > 0 ? toAmount(record.subsidyAmount) : 0,
    chargedToIncomeNotes: config.notes || null,
    chargedToIncomeTaggedBy: config.updatedBy || null,
    chargedToIncomeTaggedAt: config.updatedAt || null,
  };
}

module.exports = { resolvePersonnelIncomeAllocation, splitPersonnelFunding, applyPermanentIncomeAllocation };
