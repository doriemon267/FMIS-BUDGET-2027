const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');

async function fixLegacyProposal() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');

    const proposalId = '68f054af46e16d7cc0857b73';

    // Find the proposal
    const proposal = await Proposal.findById(proposalId);
    
    if (!proposal) {
      console.log('❌ Proposal not found');
      return;
    }

    console.log('\n📋 Current Proposal State:');
    console.log(`   Title: ${proposal.title}`);
    console.log(`   Status: ${proposal.status}`);
    console.log(`   WorkflowLevel: ${proposal.workflowLevel}`);
    console.log(`   bypassedOfficerReview: ${proposal.bypassedOfficerReview}`);

    // Reset to Division Submitted so coordinator can re-submit using NEW workflow
    await Proposal.findByIdAndUpdate(proposalId, {
      $set: {
        status: 'Division Submitted',
        workflowLevel: 'COORDINATOR',
        bypassedOfficerReview: false,
        currentStep: 'COORDINATOR_REVIEW',
        currentAssigneeRole: 'BUDGET_COORDINATOR',
        pendingWithRoles: ['BUDGET_COORDINATOR']
      },
      $unset: {
        submittedToManagerAt: 1,
        approvedByManager: 1
      }
    });

    const updatedProposal = await Proposal.findById(proposalId);

    console.log('\n✅ Proposal Updated Successfully!');
    console.log('\n📋 New Proposal State:');
    console.log(`   Status: ${updatedProposal.status}`);
    console.log(`   WorkflowLevel: ${updatedProposal.workflowLevel}`);
    console.log(`   currentStep: ${updatedProposal.currentStep}`);
    console.log(`   currentAssigneeRole: ${updatedProposal.currentAssigneeRole}`);
    console.log(`   bypassedOfficerReview: ${updatedProposal.bypassedOfficerReview}`);

    console.log('\n🎯 Next Steps:');
    console.log('   1. Refresh browser (Ctrl+Shift+R)');
    console.log('   2. Login as Nelson Eloso (BUDGET_COORDINATOR)');
    console.log('   3. Open this proposal');
    console.log('   4. Click "Approve & Forward to Officer"');
    console.log('   5. Verify status changes to "Forwarded to Officer" instantly');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLegacyProposal();
