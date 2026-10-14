const { splitPersonnelFunding } = require('./personnelIncomeAllocation');
const { personnelTotal } = require('./permanentSalaryReference');
const { roundTo2Decimals: round } = require('./roundCurrency');

const fundingForPersonnel = row => splitPersonnelFunding(
  row.Total ?? personnelTotal(row),
  row.chargedToIncomeEligible === false ? 0 : row.chargedToIncomeAmount
);

function personnelItemFunding(row, field, amount) {
  const fields = String(field || '').split(',').map(value => value.trim());
  const allocation = row.nepAllocations;
  const versioned = ['NEP', 'GAA'].includes(String(row.budgetType || '').toUpperCase());
  const entries = fields.map(key => allocation instanceof Map ? allocation.get(key) : allocation?.[key]);
  if (versioned && entries.every(entry => entry != null)) {
    return splitPersonnelFunding(amount, entries.reduce((sum, entry) => sum + (Number(entry.income) || 0), 0));
  }
  const funding = fundingForPersonnel(row);
  if ((row.salarySubsidyMonthlyAmount != null && row.salarySubsidyMonthlyAmount >= 0) || (row.cpcs1MonthlySalary > 0 && row.cpcs2MonthlySalary > 0)) {
    // Automatic salary allocations (including zero salary Subsidy) leave benefits in Subsidy.
    return splitPersonnelFunding(amount, fields.includes('annualSalary') ? funding.incomeAmount : 0);
  }
  const total = funding.incomeAmount + funding.subsidyAmount;
  return splitPersonnelFunding(amount, total > 0 ? amount * funding.incomeAmount / total : 0);
}

function summarizePersonnelFunding(rows) {
  const result = { total: 0, income: 0, subsidy: 0, salaryTotal: 0, salaryIncome: 0, salarySubsidy: 0 };
  rows.forEach(row => {
    const funding = fundingForPersonnel(row);
    const salary = personnelItemFunding(row, 'annualSalary', Number(row.annualSalary) || 0);
    result.income += funding.incomeAmount;
    result.subsidy += funding.subsidyAmount;
    result.total += funding.incomeAmount + funding.subsidyAmount;
    result.salaryIncome += salary.incomeAmount;
    result.salarySubsidy += salary.subsidyAmount;
    result.salaryTotal += salary.incomeAmount + salary.subsidyAmount;
  });
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, round(value)]));
}

module.exports = { fundingForPersonnel, personnelItemFunding, summarizePersonnelFunding };
