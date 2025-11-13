const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

const WORKFLOW_TRANSITIONS = {
  'BUDGET PREPARER': {
    'DRAFT': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER'
    }
  },
  'BUDGET REVIEWER': {
    'FORWARDED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    }
  },
  'BUDGET APPROVER': {
    'FORWARDED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    },
    'RETURNED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    }
  }
};

const statusMapping = {
  'DRAFT': 'Draft',
  'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
  'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
  'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
  'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
  'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
  'FINALIZED': 'Finalized',
  'RETURNED_TO_PREPARER': 'Returned',
  'RETURNED_TO_REVIEWER': 'Returned',
  'RETURNED_TO_APPROVER': 'Returned',
  'RETURNED_TO_PLANNING_ANALYST': 'Returned',
  'RETURNED_TO_OFFICER': 'Returned'
};

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  console.log('=== Testing Pending Review Logic for All Roles ===\n');
  
  const proposal = await Proposal.findOne({}).lean();
  
  if (!proposal) {
    console.log('No proposals found in database');
    process.exit(0);
  }
  
  console.log(`Testing with proposal: "${proposal.title}"`);
  console.log(`Current Status: ${proposal.status}\n`);
  
  // Test each role
  Object.entries(WORKFLOW_TRANSITIONS).forEach(([role, statuses]) => {
    const allowedStatuses = Object.keys(statuses);
    const pendingStatuses = allowedStatuses.filter(s => s !== 'DRAFT');
    const mappedStatuses = pendingStatuses.map(s => statusMapping[s] || s);
    
    const wouldSee = mappedStatuses.includes(proposal.status);
    
    console.log(`${role}:`);
    console.log(`  Allowed Statuses (enum): [${allowedStatuses.join(', ')}]`);
    console.log(`  Pending Statuses (enum): [${pendingStatuses.join(', ')}]`);
    console.log(`  Mapped Statuses (readable): [${mappedStatuses.join(', ')}]`);
    console.log(`  Would see this proposal: ${wouldSee ? '✅ YES' : '❌ NO'}`);
    console.log('');
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
