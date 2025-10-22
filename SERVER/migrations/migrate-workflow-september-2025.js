/**
 * 📋 Migration Script: Workflow and Hierarchical Structure Refactoring (September 2025)
 * 
 * This script migrates the existing hierarchical user assignments to the new 6-step workflow
 * structure with new assignment levels:
 * - DIVISION_LEVEL (replaces: DIVISION, RESPONSIBILITY_CENTER)
 * - DEPARTMENT_REGIONAL_LEVEL (replaces: DEPARTMENT, OFFICE)
 * - BUDGET_AND_REVENUE_DIVISION (replaces: REGION)
 * 
 * USAGE:
 * node migrate-workflow-september-2025.js
 * 
 * This script:
 * 1. Backs up existing assignments
 * 2. Maps old assignment levels to new ones
 * 3. Updates workflow roles to match new 6-step workflow
 * 4. Preserves user data and organizational assignments
 * 5. Logs all changes for audit trail
 * 6. Creates a rollback backup in case of issues
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { connection } = require('../config/mongo_db');

// Models
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

// Constants
const {
  ASSIGNMENT_LEVELS,
  WORKFLOW_ROLES,
  ASSIGNMENT_LEVEL_WORKFLOW_MAPPING
} = require('../constants/workflowConstants');

// Mapping of old assignment levels to new ones
const ASSIGNMENT_LEVEL_MAPPING = {
  'DIVISION': ASSIGNMENT_LEVELS.DIVISION_LEVEL,
  'RESPONSIBILITY_CENTER': ASSIGNMENT_LEVELS.DIVISION_LEVEL,
  'DEPARTMENT': ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL,
  'OFFICE': ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL,
  'REGION': ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION,
  'FULL': ASSIGNMENT_LEVELS.FULL
};

// Mapping of old workflow roles to new ones
const WORKFLOW_ROLE_MAPPING = {
  // Division creators stay the same
  'divisionCreator': WORKFLOW_ROLES.DIVISION_CREATOR,
  'divisionApprover': WORKFLOW_ROLES.DIVISION_APPROVER,
  
  // Office/Department creators map to office roles
  'officeCreator': WORKFLOW_ROLES.OFFICE_CREATOR,
  'departmentCreator': WORKFLOW_ROLES.OFFICE_CREATOR,
  'officeConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
  'departmentConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
  'officeSubmission': WORKFLOW_ROLES.OFFICE_CREATOR,
  'departmentSubmission': WORKFLOW_ROLES.OFFICE_CREATOR,
  'officeFinalVerifier': WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
  
  // Region/Budget roles
  'regionCreator': WORKFLOW_ROLES.BUDGET_ANALYST,
  'regionFinalVerifier': WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER
};

class WorkflowMigration {
  constructor() {
    this.migrationLog = [];
    this.backupData = [];
    this.migrationStats = {
      totalUsers: 0,
      migratedUsers: 0,
      failedUsers: 0,
      mappingChanges: {}
    };
  }

  /**
   * Log migration activity
   */
  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data
    };
    this.migrationLog.push(logEntry);
    console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  /**
   * Create backup of existing data
   */
  async createBackup() {
    try {
      this.log('📦 Creating backup of existing assignments...');
      const allAssignments = await HierarchicalUserAssignment.find({}).lean();
      this.backupData = allAssignments;

      const backupPath = path.join(
        __dirname,
        `../backups/workflow-migration-backup-${Date.now()}.json`
      );

      // Ensure backups directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      fs.writeFileSync(backupPath, JSON.stringify(allAssignments, null, 2));
      this.log(`✅ Backup created successfully`, { path: backupPath, count: allAssignments.length });
      return backupPath;
    } catch (error) {
      this.log(`❌ Failed to create backup: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalize assignment level
   */
  normalizeAssignmentLevel(oldLevel) {
    return ASSIGNMENT_LEVEL_MAPPING[oldLevel] || oldLevel;
  }

  /**
   * Migrate workflow roles
   */
  migrateWorkflowRoles(oldRoles) {
    const newRoles = [];
    const unmappedRoles = [];

    for (const oldRole of oldRoles) {
      if (WORKFLOW_ROLE_MAPPING[oldRole]) {
        const newRole = WORKFLOW_ROLE_MAPPING[oldRole];
        if (!newRoles.includes(newRole)) {
          newRoles.push(newRole);
        }
      } else if (
        [
          WORKFLOW_ROLES.DIVISION_REVIEWER,
          WORKFLOW_ROLES.DIVISION_CREATOR,
          WORKFLOW_ROLES.OFFICE_CREATOR,
          WORKFLOW_ROLES.OFFICE_APPROVER,
          WORKFLOW_ROLES.BUDGET_ANALYST,
          WORKFLOW_ROLES.BUDGET_OFFICER,
          WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
          WORKFLOW_ROLES.BUDGET_ADMIN
        ].includes(oldRole)
      ) {
        // Already new role format
        if (!newRoles.includes(oldRole)) {
          newRoles.push(oldRole);
        }
      } else {
        unmappedRoles.push(oldRole);
      }
    }

    return { newRoles, unmappedRoles };
  }

  /**
   * Migrate a single user assignment
   */
  async migrateUser(assignment) {
    try {
      const userId = assignment.userId;
      const oldLevel = assignment.assignmentLevel;
      const oldRoles = assignment.workflowRoles || [];

      // Normalize assignment level
      const newLevel = this.normalizeAssignmentLevel(oldLevel);

      // Migrate workflow roles
      const { newRoles, unmappedRoles } = this.migrateWorkflowRoles(oldRoles);

      // Get auto-assigned roles if no roles exist or if migrating from empty
      let finalRoles = newRoles;
      if (finalRoles.length === 0) {
        const assignedRoles = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[newLevel];
        if (assignedRoles) {
          finalRoles = assignedRoles.autoAssignedRoles || [];
        }
      }

      // Prepare update data
      const updateData = {
        assignmentLevel: newLevel,
        workflowRoles: finalRoles,
        migrationStatus: 'MIGRATED',
        legacyAssignmentLevel: oldLevel,
        migratedAt: new Date()
      };

      // Update the assignment
      const result = await HierarchicalUserAssignment.findByIdAndUpdate(
        assignment._id,
        updateData,
        { new: true }
      );

      this.log(`✅ Migrated user: ${userId}`, {
        oldLevel,
        newLevel,
        oldRoles: oldRoles.length > 0 ? oldRoles : 'AUTO',
        newRoles: finalRoles,
        unmappedRoles: unmappedRoles.length > 0 ? unmappedRoles : 'NONE'
      });

      // Track statistics
      if (!this.migrationStats.mappingChanges[`${oldLevel} → ${newLevel}`]) {
        this.migrationStats.mappingChanges[`${oldLevel} → ${newLevel}`] = 0;
      }
      this.migrationStats.mappingChanges[`${oldLevel} → ${newLevel}`]++;

      return { success: true, result };
    } catch (error) {
      this.log(`❌ Failed to migrate user ${assignment.userId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run the complete migration
   */
  async runMigration() {
    try {
      console.log('\n🚀 Starting Workflow Migration (September 2025)...\n');

      // Step 1: Create backup
      const backupPath = await this.createBackup();

      // Step 2: Get all active assignments
      this.log('📋 Fetching all active user assignments...');
      const assignments = await HierarchicalUserAssignment.find({ isActive: true });
      this.migrationStats.totalUsers = assignments.length;
      this.log(`Found ${assignments.length} active assignments to migrate`);

      // Step 3: Migrate each user
      this.log('🔄 Starting migration of individual users...');
      for (const assignment of assignments) {
        const result = await this.migrateUser(assignment);
        if (result.success) {
          this.migrationStats.migratedUsers++;
        } else {
          this.migrationStats.failedUsers++;
        }
      }

      // Step 4: Generate summary report
      this.log('📊 Migration Summary', this.migrationStats);

      // Step 5: Save migration log
      const logPath = path.join(
        __dirname,
        `../backups/workflow-migration-log-${Date.now()}.json`
      );
      fs.writeFileSync(
        logPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            backupPath,
            statistics: this.migrationStats,
            log: this.migrationLog
          },
          null,
          2
        )
      );

      this.log('✅ Migration completed successfully', {
        logPath,
        successCount: this.migrationStats.migratedUsers,
        failureCount: this.migrationStats.failedUsers
      });

      return {
        success: true,
        statistics: this.migrationStats,
        backupPath,
        logPath
      };
    } catch (error) {
      this.log(`🚨 FATAL ERROR during migration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollback(backupPath) {
    try {
      this.log('🔄 Starting rollback...');

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      // Clear existing data
      await HierarchicalUserAssignment.deleteMany({});
      
      // Restore from backup
      await HierarchicalUserAssignment.insertMany(backupData);

      this.log(`✅ Rollback completed successfully. Restored ${backupData.length} assignments.`);
      return { success: true, count: backupData.length };
    } catch (error) {
      this.log(`❌ Rollback failed: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Connect to database
    await connection;
    console.log('✅ Connected to database');

    const migration = new WorkflowMigration();

    // Check for rollback flag
    if (process.argv.includes('--rollback') && process.argv.length > 3) {
      const backupFile = process.argv[process.argv.indexOf('--rollback') + 1];
      console.log(`\n⚠️  Rolling back from backup: ${backupFile}\n`);
      const result = await migration.rollback(backupFile);
      console.log('\n✅ Rollback completed successfully\n');
      process.exit(0);
    }

    // Run normal migration
    const result = await migration.runMigration();

    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Users Migrated: ${result.statistics.migratedUsers}/${result.statistics.totalUsers}`);
    console.log(`Failed: ${result.statistics.failedUsers}`);
    console.log(`Backup Location: ${result.backupPath}`);
    console.log(`Log Location: ${result.logPath}`);
    console.log('\nLevel Mappings:');
    Object.entries(result.statistics.mappingChanges).forEach(([mapping, count]) => {
      console.log(`  ${mapping}: ${count} users`);
    });
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('🚨 Fatal error:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { WorkflowMigration, ASSIGNMENT_LEVEL_MAPPING, WORKFLOW_ROLE_MAPPING };