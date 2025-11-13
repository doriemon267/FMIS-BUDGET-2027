const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  console.log('=== Checking Pending Review Logic ===\n');
  
  // Get the proposal we tested with
  const proposal = await Proposal.findOne({
    title: /MANAGEMENT INFORMATION/
  }).lean();
  
  if (proposal) {
    console.log('Proposal Found:', proposal.title);
    console.log('Status:', proposal.status);
    console.log('Process By:', proposal.processBy);
    console.log('\n=== Checking what statuses BUDGET REVIEWER should see ===');
    
    // WORKFLOW_TRANSITIONS for BUDGET REVIEWER
    const BUDGET_REVIEWER_STATUSES = {
      'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
      'RETURNED_TO_REVIEWER': 'Returned'
    };
    
    console.log('Allowed statuses for BUDGET REVIEWER:');
    Object.entries(BUDGET_REVIEWER_STATUSES).forEach(([enum_status, readable_status]) => {
      console.log(`  - ${enum_status} => ${readable_status}`);
    });
    
    console.log('\nProposal status in DB:', proposal.status);
    console.log('Should BUDGET REVIEWER see this proposal?', 
      Object.values(BUDGET_REVIEWER_STATUSES).includes(proposal.status) ? 'YES' : 'NO');
  } else {
    console.log('Proposal not found');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
