const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  const proposals = await Proposal.find().limit(3).lean();
  
  console.log('Total Proposals in old model:', (await Proposal.countDocuments({})));
  
  if (proposals.length > 0) {
    console.log('\nFirst 3 Proposals:');
    proposals.forEach((p, idx) => {
      console.log(`\n${idx + 1}. Title: ${p.title}`);
      console.log('   Status:', p.status);
      console.log('   Created By:', p.processBy);
      console.log('   Workflow History Count:', p.workflowHistory ? p.workflowHistory.length : 0);
      if (p.workflowHistory && p.workflowHistory.length > 0) {
        console.log('   First History Entry:');
        console.log(JSON.stringify(p.workflowHistory[0], null, 2));
      }
    });
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
