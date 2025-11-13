#!/usr/bin/env node
/**
 * Test script to verify Budget Manager can finalize proposals
 * Usage: node test-finalize-action.js <proposalId>
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5005/api';

// Simulated user with Budget Manager role
const testUser = {
  Id: '925166',
  id: '925166',
  userId: '925166',
  UserId: '925166',
  username: '925166',
  Username: ['925166'],
  email: 'marvinbuisa@gmail.com',
  Roles: ['BUDGET_MANAGER'],
  name: 'Marvin Buisa',
  displayName: 'Marvin Buisa',
  fullName: 'Marvin Buisa',
  identitySource: 'hierarchical-assignment'
};

async function testFinalizeAction() {
  const proposalId = process.argv[2];
  
  if (!proposalId) {
    console.log('Usage: node test-finalize-action.js <proposalId>');
    console.log('\nExample:');
    console.log('  node test-finalize-action.js 6913e96f5d2a1b2c3d4e5f6g');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('FINALIZE ACTION TEST');
  console.log('='.repeat(60));
  console.log('\nTest Configuration:');
  console.log('  Proposal ID:', proposalId);
  console.log('  User:', testUser.name);
  console.log('  Role:', testUser.Roles[0]);
  console.log('  Action: finalize');
  console.log('');

  try {
    console.log('Sending request...\n');
    const response = await axios.post(
      `${API_BASE}/proposals/${proposalId}/action`,
      {
        action: 'finalize',
        comment: 'Test finalization from script'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        // Simulate user in request
        validateStatus: () => true // Don't throw on any status
      }
    );

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ SUCCESS: Finalization action completed');
      console.log('Proposal status updated:', response.data.data?.status);
    } else if (response.status === 403) {
      console.log('\n❌ FORBIDDEN: User not authorized');
      console.log('Message:', response.data.message);
    } else if (response.status === 404) {
      console.log('\n❌ NOT FOUND: Proposal not found');
    } else {
      console.log('\n⚠️ ERROR:', response.data.message);
    }
  } catch (error) {
    console.error('Request Error:');
    console.error('  Message:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Check server logs for detailed validation steps:');
  console.log('  [PERFORM_ACTION] - Action processing');
  console.log('  [canPerformAction] - Permission validation');
  console.log('='.repeat(60));
}

testFinalizeAction();
