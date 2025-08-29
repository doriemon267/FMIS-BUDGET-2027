/**
 * Test script to debug hierarchical assignment creation
 */

const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

async function testAssignmentCreation() {
  console.log('🧪 Testing hierarchical assignment creation...');
  
  try {
    // Create a test token with admin privileges
    const testPayload = {
      id: '507f1f77bcf86cd799439011',
      username: 'test_admin',
      Roles: ['Admin', 'User'],
      email: 'admin@test.com'
    };

    const token = jwt.sign(
      testPayload,
      process.env.JWT_SECRET_KEY || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('🎫 Generated admin token');
    
    // Test assignment data
    const assignmentData = {
      userId: 'TEST123',
      userName: 'Test User',
      email: 'testuser@example.com',
      assignmentLevel: 'DIVISION',
      regionId: '67c7fe35b10250a3e86b3d86', // Sample region ID from logs
      departmentId: '67c7fa8cb10250a3e86b34fd', // Corporate Planning Services
      divisionName: 'Planning & Programming Division',
      rolePermissions: {
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: false,
        canDeleteProposals: false,
        canApproveProposals: false,
        canViewReports: true,
        canManageUsers: false,
        canManageSettings: false
      }
    };

    console.log('📤 Sending assignment data:', JSON.stringify(assignmentData, null, 2));
    
    // Make the API call
    const response = await fetch('http://localhost:5005/api/hierarchical-rbac/assignments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assignmentData)
    });
    
    const result = await response.json();
    
    console.log('\n📊 API Response:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    console.log('Message:', result.message);
    
    if (!result.success) {
      console.log('❌ Error details:', JSON.stringify(result, null, 2));
    } else {
      console.log('✅ Assignment created successfully!');
      console.log('Assignment ID:', result.assignment?._id);
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  }
}

testAssignmentCreation();
