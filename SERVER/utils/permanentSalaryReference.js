const { roundTo2Decimals: round } = require('./roundCurrency');

const PS_COST_FIELDS = [
  'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
  'medical', 'additionalMedical', 'childrenAllowance', 'meal', 'cashGift',
  'subsistenceAllowance', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST',
  'loyaltyAward', 'overtimePay', 'midyearBonus', 'yearEndBonus', 'gsisPremium',
  'providentFund', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation',
  'courtAppearance', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'hazardPay', 'honoraria',
];
const personnelTotal = record => round(PS_COST_FIELDS.reduce((sum, field) => sum + (Number(record[field]) || 0), 0));
const referenceError = message => Object.assign(new Error(message), { statusCode: 400 });
const gradeNumber = value => {
  const text = String(value ?? '').trim().replace(/^(?:SG|JG|PG)[\s-]*/i, '');
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : null;
};

function referenceRate(record, table, label) {
  const step = gradeNumber(record.step);
  if (!step || step > 8) throw referenceError('Step must be from 1 to 8.');
  const gradeField = table?.matchBy === 'JG' ? 'gradelevel_JG' : 'gradelevel_SG';
  const grade = gradeNumber(record[gradeField]);
  if (!grade) throw referenceError(`${label}: missing ${table?.matchBy || 'SG'} grade.`);
  let matches = (table?.rows || []).filter(row => row[table.matchBy === 'JG' ? 'jg' : 'sg'] === grade);
  // Some Job Grades cover multiple Salary Grades; use both when necessary.
  if (matches.length > 1 && table.matchBy === 'JG') {
    const sg = gradeNumber(record.gradelevel_SG);
    matches = matches.filter(row => row.sg === sg);
  }
  if (matches.length !== 1) throw referenceError(`${label}: ${matches.length ? 'ambiguous' : 'missing'} rate for ${table.matchBy} ${grade}, Step ${step}.`);
  const rate = matches[0].rates[String(step)];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw referenceError(`${label}: missing or invalid rate for ${table.matchBy} ${grade}, Step ${step}.`);
  }
  return round(rate);
}

function applySalaryReferences(record, config) {
  if (String(record.statusOfAppointment || '').trim().toUpperCase() !== 'PERMANENT') return {};
  const base = referenceRate(record, config.referenceTables?.cpcs1, 'CPCS 1');
  const current = referenceRate(record, config.referenceTables?.cpcs2, 'CPCS 2');
  if (current < base) throw referenceError('CPCS 2 salary is lower than CPCS 1. Check the selected tables and grade mapping.');
  const increment = round(current - base);
  const annualSalary = round(current * 12);
  const income = round(increment * 12);
  const total = personnelTotal({ ...(record.toObject ? record.toObject() : record), annualSalary });
  return {
    monthlySalary: current,
    annualSalary,
    Total: total,
    cpcs1MonthlySalary: base,
    cpcs2MonthlySalary: current,
    monthlySalaryIncrement: increment,
    chargedToIncomeEligible: income > 0,
    chargedToIncomeMonthlyAmount: increment,
    chargedToIncomeAmount: income,
    chargedToSubsidyAmount: round(total - income),
    chargedToIncomeSubsidyAmount: income > 0 ? Number(record.subsidyAmount) || 0 : 0,
    chargedToIncomeNotes: config.notes || null,
    chargedToIncomeTaggedBy: config.updatedBy || null,
    chargedToIncomeTaggedAt: config.updatedAt || null,
  };
}

module.exports = { gradeNumber, referenceRate, applySalaryReferences, personnelTotal, referenceError };
