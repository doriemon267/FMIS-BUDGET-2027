// Test script to check Budget Manager finalize action
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

const WORKFLOW_TRANSITIONS = {
  'BUDGET MANAGER': {
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    },
    'RETURNED_TO_PREPARER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    }
  }
};

mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget').then(async () => {
  console.log('=== Testing Budget Manager Finalize Action ===\n');
  
  // Find a proposal that's at the Budget Manager stage
  const proposal = await NewProposalWorkflow.findOne({
    status: { $in: ['Forwarded to Overall Budget Approver', 'Returned'] }
  }).lean();
  
  if (!proposal) {
    console.log('No proposals found in Budget Manager workflow stage');
    process.exit(0);
  }
  
  console.log('Found Proposal:');
  console.log('  ID:', proposal._id);
  console.log('  Title:', proposal.title);
  console.log('  Status:', proposal.status);
  console.log('');
  
  // Test the workflow
  const statusMapping = {
    'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
    'Returned': 'RETURNED_TO_PREPARER'
  };
  
  const mappedStatus = statusMapping[proposal.status];
  console.log('Status Mapping:');
  console.log('  DB Status:', proposal.status);
  console.log('  Workflow Enum:', mappedStatus);
  console.log('');
  
  const transitions = WORKFLOW_TRANSITIONS['BUDGET MANAGER'];
  console.log('Transitions for BUDGET MANAGER:', Object.keys(transitions));
  console.log('');
  
  console.log('Available Actions for Status', mappedStatus, ':');
  if (transitions[mappedStatus]) {
    console.log('  -', Object.keys(transitions[mappedStatus]).join('\n  - '));
  } else {
    console.log('  ERROR: No transitions defined for this status!');
  }
  console.log('');
  
  console.log('Can Budget Manager finalize?', transitions[mappedStatus]?.['finalize'] ? 'YES ✅' : 'NO ❌');
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
