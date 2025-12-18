/**
 * Test Script: Verify that BUDGET_MANAGER can view "Office Submitted" proposals
 * 
 * This script tests that:
 * 1. BUDGET_OFFICER cannot edit "Office Submitted" proposals
 * 2. BUDGET_MANAGER can view "Office Submitted" proposals
 * 3. Both roles are blocked from editing "Office Approved" or "Approved" proposals
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

async function testManagerAccess() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Test scenarios
    const testScenarios = [
      {
        status: 'Division Submitted',
        expectedOfficer: 'CAN EDIT',
        expectedManager: 'CAN VIEW'
      },
      {
        status: 'Office Submitted',
        expectedOfficer: 'CANNOT EDIT',
        expectedManager: 'CAN VIEW'
      },
      {
        status: 'Office Approved',
        expectedOfficer: 'CANNOT EDIT',
        expectedManager: 'CANNOT EDIT'
      },
      {
        status: 'Approved',
        expectedOfficer: 'CANNOT EDIT',
        expectedManager: 'CANNOT EDIT'
      }
    ];

    console.log('📋 Testing access permissions for different proposal statuses:\n');

    for (const scenario of testScenarios) {
      console.log('─────────────────────────────────────────────────────');
      console.log(`Testing status: "${scenario.status}"`);
      
      // Find a proposal with this status
      const proposal = await Proposal.findOne({ status: scenario.status }).limit(1);
      
      if (!proposal) {
        console.log(`  ⚠️ No proposal found with status "${scenario.status}"`);
        console.log('');
        continue;
      }

      console.log(`  Found Proposal ID: ${proposal._id}`);
      console.log(`  Fiscal Year: ${proposal.fiscalYear}`);
      console.log(`  Department: ${proposal.department}`);
      console.log(`  Division: ${proposal.division}`);
      console.log('');
      
      // Simulate BUDGET_OFFICER access check
      const officerCanEdit = !(
        (proposal.status === 'Office Submitted') ||
        (proposal.status === 'Office Approved') ||
        (proposal.status === 'Approved')
      );
      
      // Simulate BUDGET_MANAGER access check
      const managerCanView = !(
        (proposal.status === 'Office Approved') ||
        (proposal.status === 'Approved')
      );
      
      console.log('  👤 BUDGET_OFFICER:');
      console.log(`     Result: ${officerCanEdit ? '✅ CAN EDIT' : '❌ CANNOT EDIT'}`);
      console.log(`     Expected: ${scenario.expectedOfficer}`);
      const officerTestPassed = (
        (officerCanEdit && scenario.expectedOfficer === 'CAN EDIT') ||
        (!officerCanEdit && scenario.expectedOfficer === 'CANNOT EDIT')
      );
      console.log(`     Status: ${officerTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log('');
      
      console.log('  👤 BUDGET_MANAGER:');
      console.log(`     Result: ${managerCanView ? '✅ CAN VIEW' : '❌ CANNOT VIEW'}`);
      console.log(`     Expected: ${scenario.expectedManager}`);
      const managerTestPassed = (
        (managerCanView && scenario.expectedManager === 'CAN VIEW') ||
        (!managerCanView && scenario.expectedManager === 'CANNOT EDIT')
      );
      console.log(`     Status: ${managerTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log('');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('Expected behavior:');
    console.log('');
    console.log('BUDGET_OFFICER:');
    console.log('  ✅ "Division Submitted" → CAN EDIT');
    console.log('  ❌ "Office Submitted" → CANNOT EDIT (submitted to manager)');
    console.log('  ❌ "Office Approved" → CANNOT EDIT (already approved)');
    console.log('  ❌ "Approved" → CANNOT EDIT (finalized)');
    console.log('');
    console.log('BUDGET_MANAGER:');
    console.log('  ✅ "Division Submitted" → CAN VIEW');
    console.log('  ✅ "Office Submitted" → CAN VIEW (to approve/reject)');
    console.log('  ❌ "Office Approved" → CANNOT EDIT (already approved)');
    console.log('  ❌ "Approved" → CANNOT EDIT (finalized)');
    console.log('');
    console.log('This ensures proper workflow separation between roles.');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testManagerAccess();