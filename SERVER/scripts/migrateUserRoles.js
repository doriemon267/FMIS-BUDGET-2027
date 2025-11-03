/**
 * Database Migration Script: Update User Roles
 * 
 * Purpose: Migrate legacy role names to standardized workflow roles
 * 
 * Standard Workflow Roles:
 * - divisionCreator     → BUDGET PREPARER (Division level creators)
 * - departmentCreator   → BUDGET COORDINATOR (Department/Region level creators)
 * - departmentVerifier  → BUDGET OFFICER (Department/Region level verifiers)
 * - budgetManager       → BUDGET MANAGER (Budget Office final approvers)
 * 
 * Legacy Roles to Migrate:
 * - divisionApprover → divisionCreator
 * - officeApprover → departmentVerifier
 * - regionApprover → departmentVerifier
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Role migration mapping
const ROLE_MIGRATIONS = {
  // Legacy → Standard
  'divisionApprover': 'divisionCreator',
  'divisionAnalyst': 'divisionCreator',
  'divisionEncoder': 'divisionCreator',
  'divisionStaff': 'divisionCreator',
  
  'departmentCoordinator': 'departmentCreator',
  'regionCreator': 'departmentCreator',
  'regionCoordinator': 'departmentCreator',
  
  'officeApprover': 'departmentVerifier',
  'officeVerifier': 'departmentVerifier',
  'regionApprover': 'departmentVerifier',
  'regionVerifier': 'departmentVerifier',
  'departmentApprover': 'departmentVerifier',
  
  'budgetOfficeHead': 'budgetManager',
  'budgetDirector': 'budgetManager',
  'finalApprover': 'budgetManager'
};

async function migrateUserRoles() {
  try {
    console.log('🔄 Starting User Role Migration...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to check\n`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const user of users) {
      let rolesChanged = false;
      const originalRoles = [...user.roles];
      const newRoles = [];

      // Process each role
      for (const role of user.roles) {
        const migratedRole = ROLE_MIGRATIONS[role];
        
        if (migratedRole) {
          // Role needs migration
          newRoles.push(migratedRole);
          rolesChanged = true;
          console.log(`  🔄 ${user.name} (${user.email})`);
          console.log(`     ${role} → ${migratedRole}`);
        } else {
          // Keep existing role
          newRoles.push(role);
        }
      }

      // Remove duplicates
      const uniqueRoles = [...new Set(newRoles)];

      if (rolesChanged) {
        user.roles = uniqueRoles;
        await user.save();
        updatedCount++;
        console.log(`  ✅ Updated successfully\n`);
      } else {
        unchangedCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Unchanged: ${unchangedCount}`);
    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrateUserRoles();