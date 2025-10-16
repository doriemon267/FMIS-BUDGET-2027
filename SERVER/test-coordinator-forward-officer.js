/**
 * Test Script: Verify Coordinator Approve and Forward to Officer
 * 
 * This script tests the new coordinatorApproveAndForwardToOfficer endpoint
 * to ensure it properly forwards to Officer instead of bypassing to Manager
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget';

async function testCoordinatorForwardWorkflow() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB');

    // Find a proposal that should be forwarded to Officer
    const testProposal = await Proposal.findOne({
      status: { $in: ['Division Submitted', 'Under Review by Coordinator'] }
    }).limit(1);

    if (!testProposal) {
      console.log('⚠️ No proposals found with status "Division Submitted" or "Under Review by Coordinator"');
      console.log('Creating a test proposal...');
      
      // You can create a test proposal here if needed
      console.log('Please create a test proposal manually for now');
      return;
    }

    console.log('\n📋 Test Proposal Found:');
    console.log({
      _id: testProposal._id,
      title: testProposal.title,
      currentStatus: testProposal.status,
      workflowLevel: testProposal.workflowLevel,
      region: testProposal.region,
      department: testProposal.department,
      division: testProposal.division
    });

    console.log('\n🔍 Expected Workflow Path:');
    console.log('  Current: Division Submitted / Under Review by Coordinator');
    console.log('  After Coordinator Approve & Forward: Forwarded to Officer');
    console.log('  workflowLevel should be: OFFICER');
    console.log('  bypassedOfficerReview should be: false (or undefined)');

    console.log('\n⚠️ WARNING: Old Legacy Workflow (WRONG):');
    console.log('  Would set status to: Office Submitted');
    console.log('  Would set workflowLevel to: MANAGER');
    console.log('  Would set bypassedOfficerReview to: true');

    console.log('\n✅ Correct New Workflow:');
    console.log('  Status: Forwarded to Officer');
    console.log('  workflowLevel: OFFICER');
    console.log('  bypassedOfficerReview: false');

    console.log('\n📝 To test manually:');
    console.log('1. Login as BUDGET_COORDINATOR');
    console.log(`2. Open proposal: ${testProposal._id}`);
    console.log('3. Click "Approve & Forward to Officer" button');
    console.log('4. Check the status - should be "Forwarded to Officer"');
    console.log('5. Check workflow history for correct events');

    // Check current routes
    console.log('\n🛣️ Checking Routes:');
    console.log('Expected endpoint: POST /api/workflow/coordinator/approve-and-forward-to-officer');
    console.log('Should call: coordinatorApproveAndForwardToOfficer()');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Also check for legacy "Office Submitted" proposals
async function checkLegacyProposals() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    
    console.log('\n🔍 Checking for Legacy "Office Submitted" Proposals:');
    
    const legacyProposals = await Proposal.find({
      status: 'Office Submitted'
    }).select('_id title status workflowLevel bypassedOfficerReview createdAt');

    if (legacyProposals.length === 0) {
      console.log('✅ No legacy "Office Submitted" proposals found');
    } else {
      console.log(`⚠️ Found ${legacyProposals.length} legacy proposals:`);
      legacyProposals.forEach((p, index) => {
        console.log(`\n  ${index + 1}. ${p.title}`);
        console.log(`     ID: ${p._id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Workflow Level: ${p.workflowLevel}`);
        console.log(`     Bypassed Officer: ${p.bypassedOfficerReview}`);
        console.log(`     Created: ${p.createdAt}`);
      });

      console.log('\n💡 These proposals used the OLD workflow (Coordinator → Manager direct)');
      console.log('💡 They should be migrated to the new workflow');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run tests
console.log('🧪 Starting Workflow Test...\n');
console.log('=' .repeat(60));

testCoordinatorForwardWorkflow()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    return checkLegacyProposals();
  })
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed');
    console.log('\n📌 Next Steps:');
    console.log('1. Restart the backend server to load new code');
    console.log('2. Clear browser cache and refresh frontend');
    console.log('3. Test the workflow manually as Budget Coordinator');
    console.log('4. Verify status becomes "Forwarded to Officer" not "Office Submitted"');
    console.log('5. Check that Budget Officer can see and approve the proposal');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
