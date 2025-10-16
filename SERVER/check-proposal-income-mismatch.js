require('dotenv').config();
const mongoose = require('mongoose');
const Income = require('./models/Income');
const Proposal = require('./models/Proposal');
const BudgetOfficerEdit = require('./models/BudgetOfficerEdit');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function checkMismatch() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    const proposalId = '68f05c11a70efb0f3e6a4608';
    
    // Get the proposal
    let proposal = await Proposal.findById(proposalId);
    
    if (!proposal) {
      console.log('❌ Proposal not found with that ID! Searching for latest proposal...');
      proposal = await Proposal.findOne({}).sort({ updatedAt: -1 });
      if (!proposal) {
        console.log('❌ No proposals found in database!');
        await mongoose.disconnect();
        return;
      }
      console.log('✅ Found latest proposal:', proposal._id);
      console.log('   Title:', proposal.title);
      console.log();
    }
    
    console.log('📋 PROPOSAL:');
    console.log('  _id:', proposal._id);
    console.log('  totalIncome:', proposal.totalIncome);
    console.log('  proposedBudget:', proposal.proposedBudget);
    console.log('  totalAmount:', proposal.totalAmount);
    console.log('  status:', proposal.status);
    console.log('  workflowLevel:', proposal.workflowLevel);
    console.log();

    // Get all income items
    const filterCriteria = {
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType
    };
    
    console.log('🔍 Filter Criteria:', filterCriteria);
    console.log();

    const incomeItems = await Income.find(filterCriteria);
    console.log(`💰 INCOME ITEMS (${incomeItems.length} found):`);
    
    let totalIncome = 0;
    incomeItems.forEach((item, idx) => {
      console.log(`\n  ${idx + 1}. ${item.particulars}`);
      console.log('     amount:', item.amount);
      console.log('     status:', item.status);
      console.log('     workflowLevel:', item.workflowLevel);
      totalIncome += item.amount;
    });
    
    console.log('\n📊 TOTALS:');
    console.log('  Income DB Total:', totalIncome);
    console.log('  Proposal totalIncome:', proposal.totalIncome);
    console.log('  Mismatch:', totalIncome - proposal.totalIncome);
    console.log();

    // Check for pending edits
    const pendingEdit = await BudgetOfficerEdit.findOne({
      proposalId: proposalId,
      status: { $in: ['Pending', 'Submitted'] }
    }).sort({ createdAt: -1 });
    
    if (pendingEdit) {
      console.log('📝 PENDING EDIT FOUND:');
      console.log('  Edit ID:', pendingEdit._id);
      console.log('  Status:', pendingEdit.status);
      console.log('  Edits:', JSON.stringify(pendingEdit.edits, null, 2));
    } else {
      console.log('📝 No pending edits found');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

checkMismatch();
