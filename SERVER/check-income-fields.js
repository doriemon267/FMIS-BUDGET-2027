require('dotenv').config();
const mongoose = require('mongoose');
const Income = require('./models/Income');
const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function checkIncomeFields() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get the proposal
    const proposal = await Proposal.findById('68f054af46e16d7cc0857b73');
    
    console.log('📋 Proposal Fields:');
    console.log('  region:', proposal.region);
    console.log('  department:', proposal.department);
    console.log('  division:', proposal.division);
    console.log('  fiscalYear:', proposal.fiscalYear);
    console.log('  budgetType:', proposal.budgetType);
    console.log('  status:', proposal.status);
    console.log('  workflowLevel:', proposal.workflowLevel);
    console.log();

    // Get income items for this proposal
    const incomeItems = await Income.find({ proposal: proposal._id });
    
    console.log('💰 Income Items for this Proposal:');
    incomeItems.forEach((item, idx) => {
      console.log(`\n  Item ${idx + 1}:`);
      console.log('    _id:', item._id);
      console.log('    region:', item.region);
      console.log('    department:', item.department);
      console.log('    division:', item.division);
      console.log('    fiscalYear:', item.fiscalYear);
      console.log('    budgetType:', item.budgetType);
      console.log('    status:', item.status);
      console.log('    workflowLevel:', item.workflowLevel);
      console.log('    amount:', item.amount);
    });

    // Try the sync filter criteria
    const filterCriteria = {
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType
    };

    console.log('\n🔍 Testing Filter Criteria:');
    console.log('  Criteria:', filterCriteria);
    
    const matchingItems = await Income.find(filterCriteria);
    console.log(`  Matching Income items: ${matchingItems.length}`);
    
    if (matchingItems.length === 0) {
      console.log('\n⚠️  NO MATCHES! This is why status sync is not working!');
      console.log('\nLet me check what fields are ACTUALLY in Income:');
      
      const sampleIncome = await Income.findOne({});
      if (sampleIncome) {
        console.log('\nSample Income document fields:');
        console.log(Object.keys(sampleIncome.toObject()));
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

checkIncomeFields();
