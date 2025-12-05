require('dotenv').config();
const mongoose = require('mongoose');
const { recalculateAndSaveProposalTotals } = require('./utils/recalculateProposalTotals');
const Proposal = require('./models/Proposal');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== BEFORE RECALCULATION ===');
    const pBefore = await Proposal.findOne({ fiscalYear: '2026', budgetType: 'Initial' }).lean();
    console.log('totalIncome:', pBefore.totalIncome);
    console.log('totalExpenses:', pBefore.totalExpenses);
    console.log('projectedSubsidy:', pBefore.projectedSubsidy);
    
    const charged = await PersonnelServices.findOne({ chargedToIncomeEligible: true }).lean();
    const keys = {
      fiscalYear: charged.fiscalYear,
      budgetType: charged.budgetType,
      region: charged.region,
      department: charged.department,
      division: charged.division
    };
    
    console.log('\n=== RECALCULATING ===');
    await recalculateAndSaveProposalTotals({ keys });
    
    console.log('\n=== AFTER RECALCULATION ===');
    const pAfter = await Proposal.findOne({ fiscalYear: '2026', budgetType: 'Initial' }).lean();
    console.log('totalIncome:', pAfter.totalIncome);
    console.log('totalExpenses:', pAfter.totalExpenses);
    console.log('projectedSubsidy:', pAfter.projectedSubsidy);
    console.log('proposedBudget:', pAfter.proposedBudget);
    
    console.log('\n=== EXPECTED (FULL CHARGED-TO-INCOME) ===');
    console.log('totalIncome: 10955572.22');
    console.log('totalExpenses: 0 (lahat moved to income)');
    console.log('projectedSubsidy: 0 (walang subsidy)');
    console.log('proposedBudget: 10955572.22');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('ERROR:', e.message);
  }
})();
