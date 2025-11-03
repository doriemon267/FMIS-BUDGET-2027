/**
 * Test script to verify BUDGET_REVIEWER gets proper hierarchical permissions
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/mongo_db');

// Connect to database first
async function connectToDatabase() {
  try {
    await connectDB();
    console.log('✅ Connected to database for testing');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
}

const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function testWorkflowPermissions() {
  // Connect to database first
  await connectToDatabase();

  console.log('🧪 Testing workflow role permissions...\n');

  // Test BUDGET_REVIEWER permissions
  console.log('Testing BUDGET_REVIEWER:');
  const reviewerPermissions = await HierarchicalUserAssignment.getUserPermissions('test-user', ['BUDGET_REVIEWER']);
  console.log('Assignment Level:', reviewerPermissions.assignmentLevel);
  console.log('Role Permissions:', reviewerPermissions.rolePermissions);
  console.log('Can View Reports:', reviewerPermissions.rolePermissions.ViewReports);
  console.log('Can Edit All Proposals:', reviewerPermissions.rolePermissions.EditAllProposals);
  console.log('');

  // Test BUDGET_PREPARER permissions
  console.log('Testing BUDGET_PREPARER:');
  const preparerPermissions = await HierarchicalUserAssignment.getUserPermissions('test-user', ['BUDGET_PREPARER']);
  console.log('Assignment Level:', preparerPermissions.assignmentLevel);
  console.log('Role Permissions:', preparerPermissions.rolePermissions);
  console.log('Can Create Proposals:', preparerPermissions.rolePermissions.CreateProposals);
  console.log('');

  // Test user with no workflow roles
  console.log('Testing user with no workflow roles:');
  const noRolePermissions = await HierarchicalUserAssignment.getUserPermissions('test-user', []);
  console.log('Assignment Level:', noRolePermissions.assignmentLevel);
  console.log('Role Permissions:', noRolePermissions.rolePermissions);
  console.log('');

  // Test user with no hierarchical assignment but workflow roles
  console.log('Testing user with workflow roles but no DB assignment:');
  const workflowPermissions = await HierarchicalUserAssignment.getUserPermissions('nonexistent-user', ['BUDGET_REVIEWER']);
  console.log('Assignment Level:', workflowPermissions.assignmentLevel);
  console.log('Role Permissions:', workflowPermissions.rolePermissions);
  console.log('Workflow Roles:', workflowPermissions.workflowRoles);
}

testWorkflowPermissions().catch(console.error);