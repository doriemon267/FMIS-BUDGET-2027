/**
 * Migration Script: Fix Workflow Role Auto-Assignment
 * 
 * Background:
 * Previous auto-assignment logic incorrectly assigned BOTH creator and approver roles
 * to the same user (e.g., divisionCreator + divisionApprover).
 * 
 * New Workflow (October 2025):
 * - BUDGET ANALYST = divisioncreator (RC) OR officecreator (Office) - CREATOR ONLY
 * - BUDGET COORDINATOR = divisionapprover - APPROVER ONLY
 * - BUDGET OFFICER = officeverifier/officeconsolidator - VERIFIER ONLY
 * - BUDGET MANAGER = managerapprover/regionfinalverifier - FINAL APPROVER ONLY
 * 
 * This script:
 * 1. Finds users with BOTH creator and approver roles
 * 2. Removes approver roles, keeping only creator roles (default to creator)
 * 3. Logs affected users for manual review
 * 
 * NOTE: Users who are legitimately coordinators/officers/managers should be
 * manually assigned the appropriate approver roles AFTER running this script.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

// MongoDB connection string - hierarchicaluserassignments is in fmis_budget database
const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

async function migrateWorkflowRoles() {
  try {
    console.log('🔌 Connecting to MongoDB (BUDGET - fmis_budget)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all active user assignments
    const assignments = await HierarchicalUserAssignment.find({ isActive: true });
    console.log(`📋 Found ${assignments.length} active user assignments\n`);

    const conflictingAssignments = [];
    const fixedAssignments = [];

    for (const assignment of assignments) {
      const roles = assignment.workflowRoles || [];
      
      // Check for conflicting roles (creator + approver)
      const hasCreatorRole = roles.some(r => 
        r === 'divisionCreator' || 
        r === 'officeCreator' ||
        r === 'divisioncreator' ||
        r === 'officecreator'
      );
      
      const hasApproverRole = roles.some(r => 
        r === 'divisionApprover' || 
        r === 'officeApprover' ||
        r === 'divisionapprover' ||
        r === 'officeapprover'
      );

      if (hasCreatorRole && hasApproverRole) {
        conflictingAssignments.push({
          userId: assignment.userId,
          userName: assignment.userName,
          email: assignment.email,
          accessScope: assignment.accessScope,
          originalRoles: [...roles]
        });

        // Remove approver roles, keep creator roles only
        const newRoles = roles.filter(r => {
          const normalized = r.toLowerCase();
          return !(normalized.includes('approver') || normalized.includes('verifier'));
        });

        // Update the assignment
        assignment.workflowRoles = newRoles;
        await assignment.save();

        fixedAssignments.push({
          userId: assignment.userId,
          userName: assignment.userName,
          originalRoles: roles,
          newRoles
        });
      }
    }

    console.log('\n📊 Migration Results:');
    console.log('==========================================');
    console.log(`Total assignments checked: ${assignments.length}`);
    console.log(`Conflicting assignments found: ${conflictingAssignments.length}`);
    console.log(`Assignments fixed: ${fixedAssignments.length}\n`);

    if (fixedAssignments.length > 0) {
      console.log('✅ Fixed Assignments:');
      console.log('==========================================');
      fixedAssignments.forEach(fix => {
        console.log(`\n👤 ${fix.userName} (${fix.userId})`);
        console.log(`   Original roles: ${fix.originalRoles.join(', ')}`);
        console.log(`   New roles:      ${fix.newRoles.join(', ')}`);
      });
    }

    if (conflictingAssignments.length > 0) {
      console.log('\n\n⚠️  ACTION REQUIRED:');
      console.log('==========================================');
      console.log('The following users had BOTH creator and approver roles.');
      console.log('They now have CREATOR roles only.');
      console.log('');
      console.log('If these users are legitimately COORDINATORS, OFFICERS, or MANAGERS,');
      console.log('please manually assign the appropriate approver roles:');
      console.log('');
      console.log('- BUDGET COORDINATOR → workflowRoles: ["divisionapprover"]');
      console.log('- BUDGET OFFICER → workflowRoles: ["officeverifier", "officeconsolidator"]');
      console.log('- BUDGET MANAGER → workflowRoles: ["managerapprover", "regionfinalverifier"]');
      console.log('');
      
      conflictingAssignments.forEach(user => {
        console.log(`  • ${user.userName} (${user.email})`);
        console.log(`    Access Scope: ${user.accessScope}`);
        console.log(`    Original Roles: ${user.originalRoles.join(', ')}`);
        console.log('');
      });
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the migration
migrateWorkflowRoles().catch(console.error);
