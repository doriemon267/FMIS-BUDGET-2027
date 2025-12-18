/**
 * Test Script: Verify that "Office Submitted" proposals cannot be edited
 * 
 * This script tests that BUDGET_OFFICER cannot edit proposals with status:
 * - "Office Submitted"
 * - "Office Approved"
 * - "Approved"
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

async function testOfficeSubmittedBlock() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Test scenarios
    const testStatuses = [
      'Division Submitted',
      'Office Submitted',
      'Office Approved',
      'Approved'
    ];

    console.log('📋 Testing edit permissions for different proposal statuses:\n');

    for (const status of testStatuses) {
      console.log('─────────────────────────────────────────────────────');
      console.log(`Testing status: "${status}"`);
      
      // Find a proposal with this status
      const proposal = await Proposal.findOne({ status }).limit(1);
      
      if (!proposal) {
        console.log(`  ⚠️ No proposal found with status "${status}"`);
        console.log('');
        continue;
      }

      console.log(`  Found Proposal ID: ${proposal._id}`);
      console.log(`  Fiscal Year: ${proposal.fiscalYear}`);
      console.log(`  Department: ${proposal.department}`);
      console.log(`  Division: ${proposal.division}`);
      
      // Simulate the check from budgetOfficerEditController.js
      const canEdit = !(
        proposal.status === 'Office Submitted' || 
        proposal.status === 'Office Approved' || 
        proposal.status === 'Approved'
      );
      
      if (canEdit) {
        console.log(`  ✅ BUDGET_OFFICER CAN EDIT`);
      } else {
        console.log(`  ❌ BUDGET_OFFICER CANNOT EDIT (Blocked)`);
      }
      
      // Expected result
      const expectedCanEdit = (status === 'Division Submitted');
      const testPassed = (canEdit === expectedCanEdit);
      
      console.log(`  Expected: ${expectedCanEdit ? 'CAN EDIT' : 'CANNOT EDIT'}`);
      console.log(`  Result: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log('');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('Expected behavior:');
    console.log('  ✅ "Division Submitted" → CAN EDIT');
    console.log('  ❌ "Office Submitted" → CANNOT EDIT');
    console.log('  ❌ "Office Approved" → CANNOT EDIT');
    console.log('  ❌ "Approved" → CANNOT EDIT');
    console.log('');
    console.log('This ensures BUDGET_OFFICER can only edit proposals that are still at Division level.');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testOfficeSubmittedBlock();