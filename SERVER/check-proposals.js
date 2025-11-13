const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  const proposals = await NewProposalWorkflow.find().lean();
  
  console.log('Total Proposals:', proposals.length);
  
  if (proposals.length > 0) {
    console.log('\nFirst 3 Proposals:');
    proposals.slice(0, 3).forEach((p, idx) => {
      console.log(`\n${idx + 1}. Title: ${p.title}`);
      console.log('   Status:', p.status);
      console.log('   Created By:', p.createdByName);
      console.log('   Workflow History Count:', p.workflowHistory ? p.workflowHistory.length : 0);
      if (p.workflowHistory && p.workflowHistory.length > 0) {
        console.log('   First History Entry:', JSON.stringify(p.workflowHistory[0], null, 2));
      }
    });
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
