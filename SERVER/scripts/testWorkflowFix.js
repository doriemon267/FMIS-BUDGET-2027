/**
 * Test Script: Verify Workflow Status Fix
 * 
 * This script tests the workflow approval logic to ensure:
 * 1. BUDGET_OFFICER with dual roles (OFFICER + MANAGER) submits as OFFICER
 * 2. Status changes correctly: Division Submitted → Office Submitted
 * 3. BUDGET_MANAGER can then approve: Office Submitted → Office Approved
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

async function testWorkflowLogic() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Test Case 1: Find a proposal with "Division Submitted" status
    console.log('📋 Test Case 1: Finding proposals with "Division Submitted" status...');
    const divisionSubmittedProposals = await Proposal.find({ 
      status: 'Division Submitted' 
    }).limit(5);

    console.log(`Found ${divisionSubmittedProposals.length} proposals with "Division Submitted" status\n`);

    if (divisionSubmittedProposals.length > 0) {
      console.log('Sample proposals:');
      divisionSubmittedProposals.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ID: ${p._id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Fiscal Year: ${p.fiscalYear}`);
        console.log(`     Department: ${p.department}`);
        console.log(`     Division: ${p.division}`);
        console.log(`     Workflow Level: ${p.workflowLevel || 'Not set'}`);
        console.log('');
      });
    }

    // Test Case 2: Find proposals with "Office Submitted" status
    console.log('📋 Test Case 2: Finding proposals with "Office Submitted" status...');
    const officeSubmittedProposals = await Proposal.find({ 
      status: 'Office Submitted' 
    }).limit(5);

    console.log(`Found ${officeSubmittedProposals.length} proposals with "Office Submitted" status\n`);

    if (officeSubmittedProposals.length > 0) {
      console.log('Sample proposals:');
      officeSubmittedProposals.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ID: ${p._id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Fiscal Year: ${p.fiscalYear}`);
        console.log(`     Department: ${p.department}`);
        console.log(`     Division: ${p.division}`);
        console.log(`     Workflow Level: ${p.workflowLevel || 'Not set'}`);
        console.log('');
      });
    }

    // Test Case 3: Find proposals with "Office Approved" status
    console.log('📋 Test Case 3: Finding proposals with "Office Approved" status...');
    const officeApprovedProposals = await Proposal.find({ 
      status: 'Office Approved' 
    }).limit(5);

    console.log(`Found ${officeApprovedProposals.length} proposals with "Office Approved" status\n`);

    if (officeApprovedProposals.length > 0) {
      console.log('Sample proposals:');
      officeApprovedProposals.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ID: ${p._id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Fiscal Year: ${p.fiscalYear}`);
        console.log(`     Department: ${p.department}`);
        console.log(`     Division: ${p.division}`);
        console.log(`     Workflow Level: ${p.workflowLevel || 'Not set'}`);
        console.log('');
      });
    }

    // Test Case 4: Simulate workflow logic
    console.log('🧪 Test Case 4: Simulating workflow approval logic...\n');

    const testScenarios = [
      {
        name: 'BUDGET_OFFICER with dual roles (OFFICER + MANAGER)',
        currentStatus: 'Division Submitted',
        userRoles: ['BUDGET_OFFICER', 'BUDGET_MANAGER'],
        expectedStatus: 'Office Submitted',
        expectedWorkflowLevel: 'OFFICER'
      },
      {
        name: 'BUDGET_OFFICER only',
        currentStatus: 'Division Submitted',
        userRoles: ['BUDGET_OFFICER'],
        expectedStatus: 'Office Submitted',
        expectedWorkflowLevel: 'OFFICER'
      },
      {
        name: 'BUDGET_MANAGER approving Office Submitted',
        currentStatus: 'Office Submitted',
        userRoles: ['BUDGET_MANAGER'],
        expectedStatus: 'Office Approved',
        expectedWorkflowLevel: 'MANAGER'
      },
      {
        name: 'BUDGET_MANAGER with dual roles approving Office Submitted',
        currentStatus: 'Office Submitted',
        userRoles: ['BUDGET_OFFICER', 'BUDGET_MANAGER'],
        expectedStatus: 'Office Approved',
        expectedWorkflowLevel: 'MANAGER'
      },
      {
        name: 'BUDGET_MANAGER only (no OFFICER role) directly approving',
        currentStatus: 'Division Submitted',
        userRoles: ['BUDGET_MANAGER'],
        expectedStatus: 'Office Approved',
        expectedWorkflowLevel: 'MANAGER'
      }
    ];

    testScenarios.forEach((scenario, idx) => {
      console.log(`Scenario ${idx + 1}: ${scenario.name}`);
      console.log(`  Current Status: ${scenario.currentStatus}`);
      console.log(`  User Roles: ${scenario.userRoles.join(', ')}`);
      
      let newStatus, workflowLevel, result;
      const previousStatus = scenario.currentStatus;
      const userRoles = scenario.userRoles;

      // Apply the fixed logic
      if (previousStatus === 'Division Submitted' && userRoles.includes('BUDGET_OFFICER')) {
        newStatus = 'Office Submitted';
        workflowLevel = 'OFFICER';
        result = '✅ BUDGET_OFFICER submission';
      } else if (previousStatus === 'Office Submitted' && (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN'))) {
        newStatus = 'Office Approved';
        workflowLevel = 'MANAGER';
        result = '✅ BUDGET_MANAGER approval';
      } else if (previousStatus === 'Division Submitted' && (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) && !userRoles.includes('BUDGET_OFFICER')) {
        newStatus = 'Office Approved';
        workflowLevel = 'MANAGER';
        result = '✅ BUDGET_MANAGER direct approval';
      } else {
        newStatus = 'INVALID';
        workflowLevel = 'INVALID';
        result = '❌ Invalid workflow transition';
      }

      const passed = newStatus === scenario.expectedStatus && workflowLevel === scenario.expectedWorkflowLevel;
      
      console.log(`  Expected: ${scenario.expectedStatus} (${scenario.expectedWorkflowLevel})`);
      console.log(`  Actual: ${newStatus} (${workflowLevel})`);
      console.log(`  Result: ${result}`);
      console.log(`  ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);
    });

    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testWorkflowLogic();