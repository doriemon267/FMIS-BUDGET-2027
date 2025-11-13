const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  console.log('=== Checking All Proposal Statuses ===\n');
  
  const proposals = await Proposal.find().select('title status processBy').lean();
  
  console.log(`Total Proposals: ${proposals.length}\n`);
  
  proposals.forEach(p => {
    console.log(`Title: ${p.title}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  ProcessBy: ${p.processBy}`);
    console.log('');
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
