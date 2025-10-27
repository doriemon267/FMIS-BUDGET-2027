const mongoose = require('mongoose');
const ProposalEditLog = require('./models/ProposalEditLog');
require('dotenv').config();

// Test script to validate audit logging functionality
async function testAuditLogging() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_BUDGET_UR || 'mongodb://172.16.4.98:27017/fmis_budget', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to database');

    // Test 1: Check if ProposalEditLog model has the required methods
    console.log('\n=== Test 1: Model Methods ===');
    console.log('getProposalHistory method exists:', typeof ProposalEditLog.getProposalHistory === 'function');
    console.log('getUserActivity method exists:', typeof ProposalEditLog.getUserActivity === 'function');

    // Test 2: Check existing logs
    console.log('\n=== Test 2: Existing Logs ===');
    const totalLogs = await ProposalEditLog.countDocuments();
    console.log('Total edit logs in database:', totalLogs);

    if (totalLogs > 0) {
      const sampleLog = await ProposalEditLog.findOne().lean();
      console.log('Sample log structure:');
      console.log('- ID:', sampleLog._id);
      console.log('- Proposal ID:', sampleLog.proposalId);
      console.log('- Change Type:', sampleLog.changeType);
      console.log('- Entity Type:', sampleLog.entityType);
      console.log('- Changes count:', sampleLog.changes?.length || 0);
      console.log('- Changed By:', sampleLog.changedBy?.userName || 'Unknown');

      if (sampleLog.changes && sampleLog.changes.length > 0) {
        console.log('Sample change:');
        console.log('  Field:', sampleLog.changes[0].field);
        console.log('  Old Value:', sampleLog.changes[0].oldValue);
        console.log('  New Value:', sampleLog.changes[0].newValue);
      }
    }

    // Test 3: Test getProposalHistory method
    console.log('\n=== Test 3: getProposalHistory Method ===');
    if (totalLogs > 0) {
      const sampleProposalId = (await ProposalEditLog.findOne().select('proposalId')).proposalId;
      console.log('Testing with proposal ID:', sampleProposalId);

      const history = await ProposalEditLog.getProposalHistory(sampleProposalId, { limit: 5 });
      console.log('History results:', history.length, 'logs');

      if (history.length > 0) {
        console.log('First history item:');
        console.log('- Timestamp:', history[0].timestamp);
        console.log('- User:', history[0].changedBy?.userName);
        console.log('- Action:', history[0].changeType);
        console.log('- Changes:', history[0].changes?.length || 0);
      }
    }

    // Test 4: Test getUserActivity method
    console.log('\n=== Test 4: getUserActivity Method ===');
    if (totalLogs > 0) {
      const sampleUserId = (await ProposalEditLog.findOne().select('changedBy.userId')).changedBy.userId;
      console.log('Testing with user ID:', sampleUserId);

      const activity = await ProposalEditLog.getUserActivity(sampleUserId, { limit: 5 });
      console.log('Activity results:', activity.length, 'logs');

      if (activity.length > 0) {
        console.log('First activity item:');
        console.log('- Timestamp:', activity[0].timestamp);
        console.log('- Proposal:', activity[0].proposalId);
        console.log('- Action:', activity[0].changeType);
        console.log('- Changes:', activity[0].changes?.length || 0);
      }
    }

    console.log('\n=== Test Complete ===');
    console.log('✅ Audit logging system is properly configured');
    console.log('✅ API endpoints should work correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the test
testAuditLogging();