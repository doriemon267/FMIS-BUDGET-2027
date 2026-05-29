const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('Connected to MongoDB');

    const CapitalOutlay = require('./models/CapitalOutlay');
    const NewProposalWorkflow = require('./models/NewProposalWorkflow');
    const Region = require('./models/Region');

    const coCount = await CapitalOutlay.countDocuments();
    console.log(`Total CapitalOutlay records: ${coCount}`);

    const workflowCount = await NewProposalWorkflow.countDocuments();
    console.log(`Total NewProposalWorkflow records: ${workflowCount}`);

    // Let's find some CapitalOutlay records
    const sampleCOs = await CapitalOutlay.find().limit(5).lean();
    console.log('Sample CapitalOutlays:', JSON.stringify(sampleCOs, null, 2));

    // Let's find some NewProposalWorkflow records
    const sampleWorkflows = await NewProposalWorkflow.find().limit(5).lean();
    console.log('Sample Workflows:', JSON.stringify(sampleWorkflows, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
