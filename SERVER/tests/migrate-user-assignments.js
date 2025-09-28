
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
const UserOrganizationalAssignment = require('./models/UserOrganizationalAssignment');

// Migration mapping configuration
const MIGRATION_CONFIG = {
  // Map old assignment levels to new ones
  assignmentLevelMapping: {
    'DIVISION': 'RESPONSIBILITY_CENTER',
    'DEPARTMENT': 'OFFICE',
    'REGION': 'OFFICE', // Region becomes Office (consolidated)
    'FULL': 'FULL'
  },

  // Map old workflow roles to new ones
  workflowRoleMapping: {
    'divisionCreator': 'responsibilityCenterCreator',
    'divisionApprover': 'responsibilityCenterApprover',
    'departmentCreator': 'officeCreator',
    'departmentConsolidator': 'officeConsolidator',
    'departmentSubmission': 'officeSubmission',
    'regionCreator': 'officeCreator',
    'regionFinalVerifier': 'officeFinalVerifier'
  },

  // Department to Office mapping (to be populated based on your data)
  departmentToOfficeMapping: {
    // Example mappings - update these based on your actual data
    // 'Department Name': 'Office Name'
  }
};

async function migrateUserAssignments() {
  console.log('🚀 Starting User Assignment Data Migration...');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget-september');
    console.log('✅ Connected to database');

    // Get all existing assignments
    const oldAssignments = await HierarchicalUserAssignment.find({ isActive: true })
      .populate('regionId', 'Region regionName')
      .populate('departmentId', 'Department departmentName');

    console.log(`📊 Found ${oldAssignments.length} existing assignments to migrate`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const oldAssignment of oldAssignments) {
      try {
        console.log(`\n🔄 Migrating user: ${oldAssignment.userName} (${oldAssignment.userId})`);

        // Map assignment level
        const newAssignmentLevel = MIGRATION_CONFIG.assignmentLevelMapping[oldAssignment.assignmentLevel];
        console.log(`   Level: ${oldAssignment.assignmentLevel} → ${newAssignmentLevel}`);

        // Map workflow roles
        const newWorkflowRoles = oldAssignment.workflowRoles
          .map(oldRole => MIGRATION_CONFIG.workflowRoleMapping[oldRole])
          .filter(Boolean); // Remove undefined mappings

        console.log(`   Roles: ${oldAssignment.workflowRoles.join(', ')} → ${newWorkflowRoles.join(', ')}`);

        // Prepare new assignment data
        const newAssignmentData = {
          userId: oldAssignment.userId,
          userName: oldAssignment.userName,
          email: oldAssignment.email,
          accessScope: newAssignmentLevel,
          offices: [], // Will be populated based on department/region mapping
          responsibilityCenters: [], // Will be populated for division assignments
          rolePermissions: oldAssignment.rolePermissions,
          workflowRoles: newWorkflowRoles,
          isActive: oldAssignment.isActive,
          createdAt: oldAssignment.createdAt,
          updatedAt: new Date()
        };

        // Handle organizational assignments based on level
        if (oldAssignment.assignmentLevel === 'DIVISION') {
          // Division becomes Responsibility Center
          if (oldAssignment.divisionName) {
            newAssignmentData.responsibilityCenters = [oldAssignment.divisionName];
            console.log(`   Responsibility Center: ${oldAssignment.divisionName}`);
          }

          // Map department to office
          if (oldAssignment.departmentId) {
            const deptName = oldAssignment.departmentId.Department || oldAssignment.departmentId.departmentName;
            const officeName = MIGRATION_CONFIG.departmentToOfficeMapping[deptName] || deptName;
            newAssignmentData.offices = [officeName];
            console.log(`   Office (from Department): ${deptName} → ${officeName}`);
          }

        } else if (oldAssignment.assignmentLevel === 'DEPARTMENT') {
          // Department becomes Office
          if (oldAssignment.departmentId) {
            const deptName = oldAssignment.departmentId.Department || oldAssignment.departmentId.departmentName;
            const officeName = MIGRATION_CONFIG.departmentToOfficeMapping[deptName] || deptName;
            newAssignmentData.offices = [officeName];
            console.log(`   Office (from Department): ${deptName} → ${officeName}`);
          }

        } else if (oldAssignment.assignmentLevel === 'REGION') {
          // Region becomes Office (consolidated)
          if (oldAssignment.regionId) {
            const regionName = oldAssignment.regionId.Region || oldAssignment.regionId.regionName;
            newAssignmentData.offices = [regionName];
            console.log(`   Office (from Region): ${regionName}`);
          }
        }

        // Check if new assignment already exists
        const existingNewAssignment = await UserOrganizationalAssignment.findOne({
          userId: oldAssignment.userId,
          isActive: true
        });

        if (existingNewAssignment) {
          console.log(`   ⚠️  New assignment already exists, updating...`);
          await UserOrganizationalAssignment.findOneAndUpdate(
            { userId: oldAssignment.userId, isActive: true },
            newAssignmentData,
            { new: true }
          );
        } else {
          console.log(`   ✨ Creating new assignment...`);
          await UserOrganizationalAssignment.create(newAssignmentData);
        }

        successCount++;
        console.log(`   ✅ Migration successful`);

      } catch (error) {
        console.error(`   ❌ Migration failed for user ${oldAssignment.userId}:`, error.message);
        errors.push({
          userId: oldAssignment.userId,
          userName: oldAssignment.userName,
          error: error.message
        });
        errorCount++;
      }
    }

    // Generate migration report
    console.log('\n📋 Migration Report:');
    console.log(`   ✅ Successful migrations: ${successCount}`);
    console.log(`   ❌ Failed migrations: ${errorCount}`);
    console.log(`   📊 Total processed: ${oldAssignments.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      errors.forEach(err => {
        console.log(`   - ${err.userName} (${err.userId}): ${err.error}`);
      });
    }

    // Optional: Mark old assignments as migrated
    console.log('\n🔄 Marking old assignments as migrated...');
    await HierarchicalUserAssignment.updateMany(
      { isActive: true },
      {
        $set: {
          migratedToNewStructure: true,
          migratedAt: new Date()
        }
      }
    );

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Utility function to preview migration without making changes
async function previewMigration() {
  console.log('👀 Previewing Migration (no changes will be made)...');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget-september');

    const oldAssignments = await HierarchicalUserAssignment.find({ isActive: true })
      .populate('regionId', 'Region regionName')
      .populate('departmentId', 'Department departmentName')
      .limit(5); // Preview first 5

    console.log(`\n📊 Sample of ${oldAssignments.length} assignments to be migrated:`);

    oldAssignments.forEach((assignment, index) => {
      console.log(`\n${index + 1}. ${assignment.userName} (${assignment.userId})`);
      console.log(`   Current Level: ${assignment.assignmentLevel}`);
      console.log(`   New Level: ${MIGRATION_CONFIG.assignmentLevelMapping[assignment.assignmentLevel]}`);
      console.log(`   Current Roles: ${assignment.workflowRoles.join(', ')}`);
      console.log(`   New Roles: ${assignment.workflowRoles.map(r => MIGRATION_CONFIG.workflowRoleMapping[r]).filter(Boolean).join(', ')}`);

      if (assignment.regionId) {
        console.log(`   Region: ${assignment.regionId.Region || assignment.regionId.regionName}`);
      }
      if (assignment.departmentId) {
        console.log(`   Department: ${assignment.departmentId.Department || assignment.departmentId.departmentName}`);
      }
      if (assignment.divisionName) {
        console.log(`   Division: ${assignment.divisionName}`);
      }
    });

  } catch (error) {
    console.error('Preview failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'preview') {
  previewMigration();
} else if (command === 'migrate') {
  migrateUserAssignments();
} else {
  console.log('Usage:');
  console.log('  node migrate-user-assignments.js preview  # Preview migration without changes');
  console.log('  node migrate-user-assignments.js migrate  # Execute migration');
  process.exit(1);
}

module.exports = {
  migrateUserAssignments,
  previewMigration,
  MIGRATION_CONFIG
};