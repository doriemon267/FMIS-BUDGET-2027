require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./SERVER/models/Proposal');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Get a sample proposal with data
    const proposals = await Proposal.find({ totalIncome: { $exists: true } }).limit(5).lean();
    console.log(`Found ${proposals.length} proposals with totalIncome field\n`);
    
    proposals.forEach((p, i) => {
      console.log(`Proposal ${i+1}:`);
      console.log(`  _id: ${p._id}`);
      console.log(`  title: ${p.title}`);
      console.log(`  totalIncome: ${p.totalIncome}`);
      console.log(`  totalExpenses: ${p.totalExpenses}`);
      console.log(`  proposedBudget: ${p.proposedBudget}`);
      console.log(`  amount: ${p.amount}`);
      console.log('');
    });

    // Also check NewProposalWorkflow
    const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');
    const workflows = await NewProposalWorkflow.find({}).limit(5).lean();
    console.log(`Found ${workflows.length} NewProposalWorkflow records\n`);
    
    workflows.forEach((w, i) => {
      console.log(`Workflow ${i+1}:`);
      console.log(`  _id: ${w._id}`);
      console.log(`  title: ${w.title}`);
      console.log(`  totalIncome: ${w.totalIncome}`);
      console.log(`  totalExpenses: ${w.totalExpenses}`);
      console.log(`  amount: ${w.amount}`);
      console.log(`  status: ${w.status}`);
      console.log('');
    });
    
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
