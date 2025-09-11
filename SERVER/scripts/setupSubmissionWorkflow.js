/**
 * 🎭 Setup Submission Workflow System
 * 
 * This script sets up the submission workflow system by:
 * 1. Assigning default workflow roles to existing users
 * 2. Creating demo workflow approvers
 * 3. Testing the submission workflow
 */
const mongoose = require('mongoose');
const { setupDefaultWorkflowRoles, getUserWorkflowPermissions } = require('../helpers/workflowRoleManager');
// Load required models
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Department = require('../models/Department');
const Region = require('../models/Region');
const OrganizationStructure = require('../models/OrganizationStructure');
// Load environment variables from SERVER directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// Connect to database
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/fmis-budget';
      await mongoose.connect(mongoUrl);
      }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
// Setup submission workflow system
const setupSubmissionWorkflow = async () => {
  try {
    // 1. Setup default workflow roles for existing users
    const roleSetupResult = await setupDefaultWorkflowRoles();
    if (roleSetupResult.success) {
      } else {
      }
    // 2. Create workflow approvers if they don't exist
    await createWorkflowApprovers();
    // 3. Display current workflow setup
    await displayWorkflowSetup();
    // 4. Test submission workflow
    await testSubmissionWorkflow();
    } catch (error) {
    console.error('❌ Error setting up submission workflow:', error);
  }
};
// Create workflow approvers
const createWorkflowApprovers = async () => {
  try {
    // Check if we already have approvers at each level
    const existingDepartmentApprovers = await HierarchicalUserAssignment.find({
      assignmentLevel: 'DEPARTMENT',
      workflowRoles: 'departmentConsolidator',
      isActive: true
    });
    const existingRegionApprovers = await HierarchicalUserAssignment.find({
      assignmentLevel: 'REGION',
      workflowRoles: 'regionFinalVerifier',
      isActive: true
    });
    // If we don't have enough approvers, suggest creating them
    if (existingDepartmentApprovers.length === 0) {
      }
    if (existingRegionApprovers.length === 0) {
      }
    // Example of how to create approvers programmatically
    // Note: In practice, these would be created through the admin interface
    const demoApprovers = [
      {
        userId: 'dept_approver_001',
        userName: 'Department Approver Demo',
        email: 'dept.approver@fmis.gov.ph',
        assignmentLevel: 'DEPARTMENT',
        workflowRoles: ['departmentCreator', 'departmentConsolidator']
      },
      {
        userId: 'region_approver_001',
        userName: 'Region Approver Demo',
        email: 'region.approver@fmis.gov.ph',
        assignmentLevel: 'REGION',
        workflowRoles: ['regionCreator', 'regionFinalVerifier']
      }
    ];
    // Only create demo approvers if we don't have any existing ones
    if (existingDepartmentApprovers.length === 0 && existingRegionApprovers.length === 0) {
      // Note: This would need actual region/department IDs in a real setup
      // For now, just show the concept
      }
  } catch (error) {
    console.error('Error creating workflow approvers:', error);
  }
};
// Display current workflow setup
const displayWorkflowSetup = async () => {
  try {
    const assignments = await HierarchicalUserAssignment.find({ isActive: true })
      .populate('regionId', 'regionName Region')
      .populate('departmentId', 'Department departmentName')
      .sort({ assignmentLevel: 1, userName: 1 });
    );
    const levelGroups = {
      DIVISION: [],
      DEPARTMENT: [],
      REGION: [],
      FULL: []
    };
    assignments.forEach(assignment => {
      levelGroups[assignment.assignmentLevel].push(assignment);
    });
    Object.keys(levelGroups).forEach(level => {
      const users = levelGroups[level];
      if (users.length > 0) {
        :`);
        );
        users.forEach(user => {
          const region = user.regionId?.regionName || user.regionId?.Region || 'N/A';
          const department = user.departmentId?.Department || user.departmentId?.departmentName || 'N/A';
          const division = user.divisionName || 'N/A';
          const roles = user.workflowRoles || [];
          `);
          if (level !== 'REGION') if (level === 'DIVISION') || 'None'}`);
          });
      }
    });
  } catch (error) {
    console.error('Error displaying workflow setup:', error);
  }
};
// Test submission workflow
const testSubmissionWorkflow = async () => {
  try {
    // Get a few sample users to test their permissions
    const sampleUsers = await HierarchicalUserAssignment.find({ isActive: true }).limit(3);
    for (const user of sampleUsers) {
      const permissions = await getUserWorkflowPermissions(user.userId);
      if (permissions.success) {
        } else {
        }
    }
  } catch (error) {
    console.error('Error testing submission workflow:', error);
  }
};
// Main execution
const main = async () => {
  await connectDB();
  await setupSubmissionWorkflow();
  // Keep connection open for a moment to see results
  };
// Run the script
if (require.main === module) {
  main().catch(console.error);
}
module.exports = {
  setupSubmissionWorkflow,
  createWorkflowApprovers,
  displayWorkflowSetup,
  testSubmissionWorkflow
};