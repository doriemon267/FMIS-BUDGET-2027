const mongoose = require('mongoose');
const Income = require('./SERVER/models/Income');
const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');

async function debug() {
  try {
    await mongoose.connect('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin');
    console.log('Connected to MongoDB');

    const incomes = await Income.find({ fiscalYear: '2027' }).lean();
    console.log('Income count for 2027:', incomes.length);
    if (incomes.length > 0) {
      console.log('Sample Income (first 3):', JSON.stringify(incomes.slice(0, 3), null, 2));
      const divisions = [...new Set(incomes.map(i => i.division))];
      const regions = [...new Set(incomes.map(i => i.region))];
      console.log('Found divisions in Income:', divisions);
      console.log('Found regions in Income:', regions);
    }

    const workflows = await NewProposalWorkflow.find({ fiscalYear: 2027 }).lean();
    console.log('Workflow count for 2027:', workflows.length);
    if (workflows.length > 0) {
      console.log('Sample Workflow (first 1):', JSON.stringify(workflows.slice(0, 1), null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
