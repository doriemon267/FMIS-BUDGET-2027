const mongoose = require('mongoose');
require('dotenv').config({ path: './SERVER/.env' });
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');
  const latest = await NewProposalWorkflow.findOne().sort({ createdAt: -1 }).lean();
  console.log('Latest Proposal:', JSON.stringify(latest, null, 2));
  process.exit(0);
});
