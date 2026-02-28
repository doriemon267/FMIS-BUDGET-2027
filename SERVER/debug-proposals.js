const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected\n');
    const Proposal = require('./models/Proposal');
    const NewProposalWorkflow = require('./models/NewProposalWorkflow');
    
    // Get most recent proposal
    const proposals = await Proposal.find()
      .select('_id workflowRef fiscalYear budgetType projectedSubsidy projectedCorporateIncome proposedBudget totalExpenses totalIncome')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    
    console.log('🏛️  RECENT PROPOSALS:\n');
    proposals.forEach((p, idx) => {
      console.log(`${idx + 1}. ID: ${p._id}`);
      console.log(`   workflowRef: ${p.workflowRef}`);
      console.log(`   FY: ${p.fiscalYear}, Type: ${p.budgetType}`);
      console.log(`   Projected Subsidy: ₱${(p.projectedSubsidy || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Projected Corporate Income: ₱${(p.projectedCorporateIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Proposed Budget: ₱${(p.proposedBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Expenses: ₱${(p.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Income: ₱${(p.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    // Get NewProposalWorkflow
    console.log('\n🔄 NEW PROPOSAL WORKFLOWS:\n');
    const workflows = await NewProposalWorkflow.find()
      .select('_id title fiscalYear modelType projectedSubsidy projectedCorporateIncome amount totalIncome totalExpenses')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    
    workflows.forEach((w, idx) => {
      const computedTotal = (Number(w.totalIncome || 0) + Number(w.totalExpenses || 0));
      console.log(`${idx + 1}. ID: ${w._id}`);
      console.log(`   Title: ${w.title}`);
      console.log(`   FY: ${w.fiscalYear}, Type: ${w.modelType}`);
      console.log(`   Projected Subsidy: ₱${(w.projectedSubsidy || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Projected Corporate Income: ₱${(w.projectedCorporateIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Amount (UI): ₱${(w.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Computed (Income + Expenses): ₱${computedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   totalIncome: ₱${(w.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   totalExpenses: ₱${(w.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
