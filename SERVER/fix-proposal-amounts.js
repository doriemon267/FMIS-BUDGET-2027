require('dotenv').config();
const mongoose = require('mongoose');
const Income = require('./models/Income');
const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function fixProposal() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    const proposalId = '68f05c11a70efb0f3e6a4671';
    const proposal = await Proposal.findById(proposalId);
    
    if (!proposal) {
      console.log('❌ Proposal not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 CURRENT PROPOSAL STATE (INCORRECT):');
    console.log('  totalIncome:', proposal.totalIncome, '❌ Should be 2,500,000');
    console.log('  status:', proposal.status, '❌ Should be "Division Submitted" not "Office Submitted"');
    console.log('  workflowLevel:', proposal.workflowLevel, '❌ Should be "COORDINATOR" not "OFFICER"');
    console.log();

    // Recalculate totals from Income table
    const filterCriteria = {
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType
    };

    const incomeTotal = await Income.aggregate([
      { $match: filterCriteria },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const newIncomeTotal = incomeTotal[0]?.total || 0;
    
    console.log('💰 CORRECT VALUES FROM INCOME TABLE:');
    console.log('  New Income Total:', newIncomeTotal, '✅');
    console.log();

    // Update proposal
    proposal.totalIncome = newIncomeTotal;
    proposal.proposedBudget = newIncomeTotal;
    proposal.totalAmount = newIncomeTotal;
    proposal.status = 'Division Submitted';
    proposal.workflowLevel = 'COORDINATOR';
    proposal.currentStep = 'COORDINATOR_REVIEW';
    proposal.currentAssigneeRole = 'BUDGET_COORDINATOR';
    
    await proposal.save();
    
    console.log('✅ PROPOSAL UPDATED:');
    console.log('  totalIncome:', proposal.totalIncome);
    console.log('  proposedBudget:', proposal.proposedBudget);
    console.log('  totalAmount:', proposal.totalAmount);
    console.log('  status:', proposal.status);
    console.log('  workflowLevel:', proposal.workflowLevel);
    console.log();
    
    console.log('🎯 NEXT STEPS:');
    console.log('  1. Refresh browser (Ctrl+Shift+R)');
    console.log('  2. Check that Proposed Budget now shows ₱2,500,000.00');
    console.log('  3. Status should be "Division Submitted"');
    console.log('  4. Try the workflow again');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

fixProposal();
