const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    const mongoUri = 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin';
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected successfully!');

    const Income = require('./models/Income');
    const NewProposalWorkflow = require('./models/NewProposalWorkflow');

    const totalIncome = await Income.countDocuments({});
    console.log('Total Income records in DB:', totalIncome);

    const samples = await Income.find({}).sort({ createdAt: -1 }).limit(10).lean();
    console.log('Latest 10 Income entries:');
    samples.forEach((s, idx) => {
      console.log(`${idx + 1}: ID: ${s._id}, Region: ${s.region}, Dept: ${s.department}, Category: ${s.category}, Subcategory: ${s.subcategory}, Amount: ${s.amount}, ProposalId: ${s.proposalId}, workflowRef: ${s.workflowRef}, Status: ${s.status}`);
    });

    const proposals = await NewProposalWorkflow.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log('Latest 5 Proposals:');
    proposals.forEach((p, idx) => {
      console.log(`${idx + 1}: ID: ${p._id}, Region: ${p.region}, Dept: ${p.department}, Div: ${p.division}, FY: ${p.fiscalYear}, Type: ${p.modelType || p.budgetType}`);
    });

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
