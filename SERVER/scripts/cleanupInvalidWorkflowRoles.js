/**
 * Migration script to clean up invalid workflow roles from existing assignments
 * 
 * This script removes any workflow roles that are not in the valid enum list
 * defined in the HierarchicalUserAssignment schema.
 * 
 * Run with: node scripts/cleanupInvalidWorkflowRoles.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the model
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

// ✅ NEW: Support BOTH old and new workflow role names (September 2025 system)
const VALID_WORKFLOW_ROLES = [
  // OLD ROLE NAMES (Legacy system)
  'divisionCreator', 'divisionApprover', 'divisionReviewer',
  'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
  'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier',
  'regionCreator', 'regionFinalVerifier',
  // NEW ROLE NAMES (September 2025 workflow system)
  'PREPARER', 'REVIEWER', 'APPROVER',
  'BUDGET_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN',
  // NEW INTERNAL ROLE NAMES (used in workflowConstants)
  'divisionCreator', 'divisionReviewer', 'divisionApprover',
  'officeCreator', 'officeApprover',
  'budgetAnalyst', 'budgetOfficer', 'overallBudgetApprover', 'budgetAdmin'
];

async function cleanupInvalidWorkflowRoles() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find all assignments with workflowRoles
    const assignments = await HierarchicalUserAssignment.find({
      workflowRoles: { $exists: true, $ne: [] }
    });

    console.log(`\n📊 Found ${assignments.length} assignments with workflow roles`);

    let updatedCount = 0;
    let invalidRolesFound = new Set();

    for (const assignment of assignments) {
      const originalRoles = [...assignment.workflowRoles];
      const validRoles = originalRoles.filter(role => VALID_WORKFLOW_ROLES.includes(role));
      const invalidRoles = originalRoles.filter(role => !VALID_WORKFLOW_ROLES.includes(role));

      if (invalidRoles.length > 0) {
        console.log(`\n🔍 User: ${assignment.userName} (${assignment.userId})`);
        console.log(`   Original roles: ${originalRoles.join(', ')}`);
        console.log(`   Invalid roles: ${invalidRoles.join(', ')}`);
        console.log(`   Cleaned roles: ${validRoles.join(', ')}`);

        // Track all invalid roles found
        invalidRoles.forEach(role => invalidRolesFound.add(role));

        // Update the assignment
        assignment.workflowRoles = validRoles;
        await assignment.save();
        updatedCount++;
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Total assignments checked: ${assignments.length}`);
    console.log(`   Assignments updated: ${updatedCount}`);
    
    if (invalidRolesFound.size > 0) {
      console.log(`   Invalid roles removed: ${Array.from(invalidRolesFound).join(', ')}`);
    } else {
      console.log(`   No invalid roles found`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupInvalidWorkflowRoles()
  .then(() => {
    console.log('\n✨ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });