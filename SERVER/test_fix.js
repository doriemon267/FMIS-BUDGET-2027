require('dotenv').config();
const mongoose = require('mongoose');
const { recalculateAndSaveProposalTotals } = require('./utils/recalculateProposalTotals');
const Proposal = require('./models/Proposal');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== BEFORE ===');
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
    
    console.log('\n=== RECALCULATING (check server logs for DEBUG output) ===');
    await recalculateAndSaveProposalTotals({ keys });
    
    console.log('\n=== AFTER ===');
    const pAfter = await Proposal.findOne({ fiscalYear: '2026', budgetType: 'Initial' }).lean();
    console.log('totalIncome:', pAfter.totalIncome);
    console.log('totalExpenses:', pAfter.totalExpenses);
    console.log('projectedSubsidy:', pAfter.projectedSubsidy);
    console.log('proposedBudget:', pAfter.proposedBudget);
    
    console.log('\n=== EXPECTED ===');
    console.log('totalIncome: 4810002.10');
    console.log('totalExpenses: 6145570.12');
    console.log('proposedBudget: 10955572.22');
    
    console.log('\n=== VERIFICATION ===');
    if (Math.abs(pAfter.totalIncome - 4810002.10) < 1) {
      console.log('✅ totalIncome is CORRECT');
    } else {
      console.log('❌ totalIncome is WRONG. Expected 4810002.10, got ' + pAfter.totalIncome);
    }
    
    if (Math.abs(pAfter.totalExpenses - 6145570.12) < 1) {
      console.log('✅ totalExpenses is CORRECT');
    } else {
      console.log('❌ totalExpenses is WRONG. Expected 6145570.12, got ' + pAfter.totalExpenses);
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('ERROR:', e.message);
  }
})();
