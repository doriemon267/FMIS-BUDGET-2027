/**
 * Cleanup Script: Remove orphaned/mismatched BudgetOfficerEdit records
 * 
 * This script will:
 * 1. Delete BudgetOfficerEdit records where the proposal no longer exists
 * 2. Delete BudgetOfficerEdit records where status is "Submitted" but proposal status is "Division Submitted"
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const Proposal = require('../models/Proposal');

async function cleanupBudgetOfficerEdits() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all BudgetOfficerEdit records with "Submitted" or "Approved" status
    console.log('📋 Finding BudgetOfficerEdit records to clean up...\n');
    const editsToCheck = await BudgetOfficerEdit.find({
      status: { $in: ['Submitted', 'Approved'] }
    });
    
    console.log(`Found ${editsToCheck.length} edit(s) to check\n`);

    const toDelete = [];
    
    for (const edit of editsToCheck) {
      console.log('─────────────────────────────────────────────────────');
      console.log(`Checking Edit ID: ${edit._id}`);
      console.log(`  Proposal ID: ${edit.proposalId}`);
      console.log(`  Status: ${edit.status}`);
      console.log(`  Fiscal Year: ${edit.fiscalYear}`);
      console.log(`  Department: ${edit.department}`);
      console.log(`  Division: ${edit.division}`);
      
      // Check if proposal exists
      const proposal = await Proposal.findById(edit.proposalId);
      
      if (!proposal) {
        console.log(`  ❌ Proposal not found - WILL DELETE`);
        toDelete.push({
          editId: edit._id,
          reason: 'Proposal not found (orphaned record)'
        });
      } else {
        console.log(`  Proposal Status: ${proposal.status}`);
        console.log(`  Proposal Workflow Level: ${proposal.workflowLevel || 'Not set'}`);
        
        // Check for mismatch: Edit is "Submitted" but Proposal is "Division Submitted"
        if (edit.status === 'Submitted' && proposal.status === 'Division Submitted') {
          console.log(`  ⚠️ MISMATCH: Edit is "Submitted" but Proposal is "Division Submitted" - WILL DELETE`);
          toDelete.push({
            editId: edit._id,
            reason: 'Status mismatch (Edit: Submitted, Proposal: Division Submitted)'
          });
        } else {
          console.log(`  ✅ Status is consistent - KEEP`);
        }
      }
      console.log('');
    }

    // Summary before deletion
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`Total edits checked: ${editsToCheck.length}`);
    console.log(`Edits to delete: ${toDelete.length}`);
    console.log(`Edits to keep: ${editsToCheck.length - toDelete.length}\n`);

    if (toDelete.length > 0) {
      console.log('Records to be deleted:');
      toDelete.forEach((item, idx) => {
        console.log(`  ${idx + 1}. Edit ID: ${item.editId}`);
        console.log(`     Reason: ${item.reason}`);
      });
      console.log('');

      // Perform deletion
      console.log('🗑️ Deleting records...\n');
      const deleteIds = toDelete.map(item => item.editId);
      const deleteResult = await BudgetOfficerEdit.deleteMany({
        _id: { $in: deleteIds }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} record(s)\n`);
    } else {
      console.log('✅ No records to delete\n');
    }

    // Final verification
    console.log('📋 Final verification...');
    const remainingSubmitted = await BudgetOfficerEdit.find({
      status: { $in: ['Submitted', 'Approved'] }
    });
    console.log(`Remaining "Submitted" or "Approved" edits: ${remainingSubmitted.length}\n`);

    if (remainingSubmitted.length > 0) {
      console.log('Remaining records:');
      for (const edit of remainingSubmitted) {
        const proposal = await Proposal.findById(edit.proposalId);
        console.log(`  - Edit ID: ${edit._id}`);
        console.log(`    Proposal ID: ${edit.proposalId}`);
        console.log(`    Edit Status: ${edit.status}`);
        console.log(`    Proposal Status: ${proposal ? proposal.status : 'NOT FOUND'}`);
        console.log('');
      }
    }

    console.log('✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupBudgetOfficerEdits();