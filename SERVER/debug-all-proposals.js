require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB');

    const Proposal = mongoose.model('Proposal', new mongoose.Schema({}, { strict: false }), 'Proposal');
    const NewProposalWorkflow = mongoose.model('NewProposalWorkflow', new mongoose.Schema({}, { strict: false }), 'NewProposalWorkflow');

    // Find ALL proposals with their PersonnelServices totals
    const allProposals = await Proposal.find({}).lean();
    console.log('\n📋 ALL PROPOSALS IN DATABASE:');
    allProposals.forEach((p, i) => {
      console.log(`\n${i+1}. ID: ${p._id}`);
      console.log(`   Title: ${p.title || 'N/A'}`);
      console.log(`   FY: ${p.fiscalYear}, Type: ${p.budgetType}`);
      console.log(`   Projected Subsidy: ₱${p.projectedSubsidy?.toFixed(2) || '0.00'}`);
      console.log(`   Projected Corporate Income: ₱${p.projectedCorporateIncome?.toFixed(2) || '0.00'}`);
    });

    // Check all workflows
    const allWorkflows = await NewProposalWorkflow.find({}).lean();
    console.log('\n\n📋 ALL WORKFLOWS IN DATABASE:');
    allWorkflows.forEach((w, i) => {
      console.log(`\n${i+1}. ID: ${w._id}`);
      console.log(`   Title: ${w.title || 'N/A'}`);
      console.log(`   FY: ${w.fiscalYear}, Type: ${w.budgetType}`);
      console.log(`   Projected Subsidy: ₱${w.projectedSubsidy?.toFixed(2) || '0.00'}`);
      console.log(`   Projected Corporate Income: ₱${w.projectedCorporateIncome?.toFixed(2) || '0.00'}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
