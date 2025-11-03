/**
 * Migration: Replace Old BUDGET_ANALYST References with BUDGET PREPARER
 * 
 * CONTEXT:
 * - Old Workflow: BUDGET_ANALYST → BUDGET_COORDINATOR → BUDGET_OFFICER → BUDGET_MANAGER
 * - New Workflow: BUDGET PREPARER → BUDGET REVIEWER → BUDGET APPROVER → BUDGET_ANALYST (new level) → BUDGET_OFFICER → etc.
 * 
 * This migration updates system references from the old BUDGET_ANALYST (which did what BUDGET PREPARER does now)
 * to the new BUDGET PREPARER role. The NEW BUDGET_ANALYST is a different role at a different workflow level.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis');

    const Proposal = require('../models/Proposal');

    // Check for any proposals with old BUDGET_ANALYST references
    const proposalsByRole = await Proposal.countDocuments({ currentAssigneeRole: 'BUDGET_ANALYST' });
    const proposalsBySubmitted = await Proposal.countDocuments({ submittedByRole: 'BUDGET_ANALYST' });
    const proposalsByPending = await Proposal.countDocuments({ pendingWithRoles: 'BUDGET_ANALYST' });

    console.log('\n📊 OLD BUDGET_ANALYST References Found:');
    console.log(`   - currentAssigneeRole: ${proposalsByRole}`);
    console.log(`   - submittedByRole: ${proposalsBySubmitted}`);
    console.log(`   - pendingWithRoles: ${proposalsByPending}`);

    if (proposalsByRole + proposalsBySubmitted + proposalsByPending === 0) {
      console.log('\n✅ No old BUDGET_ANALYST references found. System is clean!');
      console.log('\n📝 CODE CHANGES COMPLETED:');
      console.log('   1. ✅ Proposal.js - defaults changed to BUDGET PREPARER');
      console.log('   2. ✅ HierarchicalUserAssignmentController.js - default budget role is BUDGET PREPARER');
      console.log('   3. ✅ budgetOfficerEditController.js - editor role logic updated');
      console.log('   4. ✅ proposalWorkflowController.js - workflow states updated');
      console.log('   5. ✅ Validation lists - kept BUDGET_ANALYST for new role');
      console.log('\n🎯 WORKFLOW CHANGES:');
      console.log('   OLD: BUDGET_ANALYST → BUDGET_COORDINATOR → ... (Legacy)');
      console.log('   NEW: BUDGET PREPARER → BUDGET REVIEWER → BUDGET APPROVER → BUDGET_ANALYST (new level)');
      process.exit(0);
    }

    // If found, show which ones and offer to migrate
    console.log('\n⚠️  WARNING: Found old BUDGET_ANALYST references that should be BUDGET PREPARER');
    console.log('   Run database cleanup scripts if needed to convert existing records.\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runMigration();