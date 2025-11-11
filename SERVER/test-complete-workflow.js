/**
 * Complete Workflow Test
 * Tests the entire proposal workflow from draft to finalization
 * 
 * Usage: node test-complete-workflow.js
 */
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
require('dotenv').config();
const TEST_CONFIG = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://172.16.4.98:27017/fmis_budget',
  TEST_USER_ID: '416461',
  TEST_USER_NAME: 'Test User',
  TEST_REGION: 'NCR',
  TEST_FISCAL_YEAR: '2025'
};
let testProposal = null;
async function connectDB() {
  try {
    await mongoose.connect(TEST_CONFIG.MONGO_URI);
    } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}
async function testDraftCreation() {
  try {
    testProposal = new Proposal({
      title: 'Test Budget Proposal 2025',
      description: 'Test proposal for workflow verification',
      fiscalYear: TEST_CONFIG.TEST_FISCAL_YEAR,
      budgetType: 'Personnel Services',
      region: TEST_CONFIG.TEST_REGION,
      processBy: TEST_CONFIG.TEST_USER_NAME,
      createdByUserId: TEST_CONFIG.TEST_USER_ID,
      status: 'Draft',
      workflowHistory: []
    });
    await testProposal.save();
    return true;
  } catch (error) {
    console.error('❌ Failed to create draft:', error.message);
    return false;
  }
}
async function testHistoryInitialization() {
  try {
    const proposal = await Proposal.findById(testProposal._id);
    if (!proposal) {
      console.error('❌ Proposal not found in database');
      return false;
    }
    if (!Array.isArray(proposal.workflowHistory)) {
      console.error('❌ workflowHistory is not an array:', typeof proposal.workflowHistory);
      return false;
    }
    if (proposal.workflowHistory.length !== 0) {
      console.error('❌ workflowHistory is not empty:', proposal.workflowHistory.length);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to verify history:', error.message);
    return false;
  }
}
async function testRecordWorkflowEvent() {
  try {
    const proposal = await Proposal.findById(testProposal._id);
    // Simulate recording a workflow event
    proposal.workflowHistory.push({
      action: 'PREPARER_SUBMIT_TO_REVIEWER',
      comment: 'Test submission - verifying workflow history recording',
      userId: TEST_CONFIG.TEST_USER_ID,
      userName: TEST_CONFIG.TEST_USER_NAME,
      timestamp: new Date(),
      previousStatus: 'Draft',
      newStatus: 'Forwarded to Reviewer',
      targetRole: 'REVIEWER'
    });
    proposal.status = 'Forwarded to Reviewer';
    proposal.currentAssigneeRole = 'REVIEWER';
    proposal.pendingWithRoles = ['REVIEWER'];
    await proposal.save();
    testProposal = proposal;
    return true;
  } catch (error) {
    console.error('❌ Failed to record workflow event:', error.message);
    return false;
  }
}
async function testHistoryRetrieval() {
  try {
    const proposal = await Proposal.findById(testProposal._id);
    if (!proposal.workflowHistory || proposal.workflowHistory.length === 0) {
      console.error('❌ No history found:', proposal.workflowHistory);
      return false;
    }
    proposal.workflowHistory.forEach((entry, index) => {
      });
    return true;
  } catch (error) {
    console.error('❌ Failed to retrieve history:', error.message);
    return false;
  }
}
async function testMultipleTransitions() {
  try {
    const proposal = await Proposal.findById(testProposal._id);
    const transitions = [
      {
        action: 'REVIEWER_APPROVE_AND_FORWARD',
        previousStatus: 'Forwarded to Reviewer',
        newStatus: 'Forwarded to Approver',
        targetRole: 'APPROVER',
        comment: 'Review completed. Ready for approval.'
      },
      {
        action: 'APPROVER_APPROVE_FORWARD_ANALYST',
        previousStatus: 'Forwarded to Approver',
        newStatus: 'Forwarded to Analyst',
        targetRole: 'ANALYST',
        comment: 'Approved. Forwarding for technical analysis.'
      },
      {
        action: 'ANALYST_VALIDATE_FORWARD_OFFICER',
        previousStatus: 'Forwarded to Analyst',
        newStatus: 'Forwarded to Officer',
        targetRole: 'OFFICER',
        comment: 'Analysis complete. All checks passed.'
      },
      {
        action: 'OFFICER_APPROVE_FORWARD_MANAGER',
        previousStatus: 'Forwarded to Officer',
        newStatus: 'Forwarded to Manager',
        targetRole: 'MANAGER',
        comment: 'Officer verification complete.'
      },
      {
        action: 'MANAGER_FINALIZE',
        previousStatus: 'Forwarded to Manager',
        newStatus: 'Finalized',
        targetRole: 'COMPLETED',
        comment: 'Proposal finalized and approved.'
      }
    ];
    for (let i = 0; i < transitions.length; i++) {
      const trans = transitions[i];
      proposal.workflowHistory.push({
        action: trans.action,
        comment: trans.comment,
        userId: `user_${i}`,
        userName: `User ${i}`,
        timestamp: new Date(Date.now() + i * 60000),
        previousStatus: trans.previousStatus,
        newStatus: trans.newStatus,
        targetRole: trans.targetRole
      });
    }
    proposal.status = 'Finalized';
    proposal.currentAssigneeRole = 'COMPLETED';
    proposal.pendingWithRoles = [];
    await proposal.save();
    // Print summary
    proposal.workflowHistory.forEach((entry, index) => {
      } (${entry.previousStatus} → ${entry.newStatus})`);
    });
    testProposal = proposal;
    return true;
  } catch (error) {
    console.error('❌ Failed to record transitions:', error.message);
    return false;
  }
}
async function testApiResponseFormat() {
  try {
    const proposal = await Proposal.findById(testProposal._id);
    // Simulate API response
    const apiResponse = {
      success: true,
      history: proposal.workflowHistory || [],
      proposal: {
        id: proposal._id,
        title: proposal.title,
        status: proposal.status,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      }
    };
    .substring(0, 500) + '...');
    return true;
  } catch (error) {
    console.error('❌ Failed to format response:', error.message);
    return false;
  }
}
async function testCleanup() {
  try {
    if (testProposal) {
      await Proposal.deleteOne({ _id: testProposal._id });
      }
    return true;
  } catch (error) {
    console.error('❌ Failed to cleanup:', error.message);
    return false;
  }
}
async function runAllTests() {
  await connectDB();
  const results = {
    'Draft Creation': await testDraftCreation(),
    'History Initialization': await testHistoryInitialization(),
    'Record Workflow Event': await testRecordWorkflowEvent(),
    'History Retrieval': await testHistoryRetrieval(),
    'Multiple Transitions': await testMultipleTransitions(),
    'API Response Format': await testApiResponseFormat(),
    'Cleanup': await testCleanup()
  };
  // Summary
  let passCount = 0;
  let failCount = 0;
  for (const [testName, result] of Object.entries(results)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    } ${status}`);
    if (result) passCount++;
    else failCount++;
  }
  process.exit(failCount > 0 ? 1 : 0);
}
// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});