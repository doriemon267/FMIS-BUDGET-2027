const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  const proposal = await NewProposalWorkflow.findOne({
    workflowHistory: { $exists: true, $ne: [] }
  }).lean();
  
  if (proposal && proposal.workflowHistory && proposal.workflowHistory.length > 0) {
    console.log('Proposal Title:', proposal.title);
    console.log('Workflow History Entry:');
    console.log(JSON.stringify(proposal.workflowHistory[0], null, 2));
  } else {
    console.log('No proposals with workflow history found');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
