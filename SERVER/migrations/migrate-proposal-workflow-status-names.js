/**
 * Migration Script: Update Proposal Workflow Status Names
 * 
 * This script migrates existing proposals from legacy status names to the new workflow status names:
 * - 'Office Submitted' → 'Forwarded to Manager'
 * - 'Office Approved' → 'Officer Approved'
 * - Updates workflow history records accordingly
 * 
 * Usage: node migrate-proposal-workflow-status-names.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import models
const Proposal = require('../models/Proposal');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const MooeProposal = require('../models/MooeProposal');
const Income = require('../models/Income');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');

const MODELS_TO_UPDATE = [
  { name: 'PersonnelServices', model: PersonnelServices },
  { name: 'CapitalOutlay', model: CapitalOutlay },
  { name: 'MooeProposal', model: MooeProposal },
  { name: 'Income', model: Income }
];

const STATUS_MAPPING = {
  'Office Submitted': 'Forwarded to Manager',
  'OFFICE SUBMITTED': 'FORWARDED_TO_MANAGER',
  'Office Approved': 'Officer Approved',
  'OFFICE APPROVED': 'OFFICER_APPROVED'
};

async function migrateProposals() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');

    // Update Proposal model
    console.log('\n📋 Updating Proposal collection...');
    let proposalCount = 0;
    
    for (const [oldStatus, newStatus] of Object.entries(STATUS_MAPPING)) {
      const result = await Proposal.updateMany(
        { status: oldStatus },
        { 
          $set: { status: newStatus },
          $push: {
            workflowHistory: {
              action: 'MIGRATION',
              comment: `Migrated status from "${oldStatus}" to "${newStatus}"`,
              userId: 'system',
              userName: 'system',
              timestamp: new Date(),
              previousStatus: oldStatus,
              newStatus: newStatus
            }
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`  ✅ Updated ${result.modifiedCount} proposals: "${oldStatus}" → "${newStatus}"`);
        proposalCount += result.modifiedCount;
      }
    }
    console.log(`\n📊 Total Proposals updated: ${proposalCount}`);

    // Update Budget Item models (PersonnelServices, CapitalOutlay, MooeProposal, Income)
    let totalBudgetItemsUpdated = 0;
    
    for (const { name, model } of MODELS_TO_UPDATE) {
      console.log(`\n📦 Updating ${name} collection...`);
      let modelCount = 0;
      
      for (const [oldStatus, newStatus] of Object.entries(STATUS_MAPPING)) {
        const result = await model.updateMany(
          { status: oldStatus },
          { $set: { status: newStatus } }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`  ✅ Updated ${result.modifiedCount} ${name}: "${oldStatus}" → "${newStatus}"`);
          modelCount += result.modifiedCount;
        }
      }
      console.log(`  📊 Total ${name} updated: ${modelCount}`);
      totalBudgetItemsUpdated += modelCount;
    }

    // Update BudgetOfficerEdit records (they track edits with old status names)
    console.log('\n🔧 Updating BudgetOfficerEdit collection...');
    let editCount = 0;
    
    for (const [oldStatus, newStatus] of Object.entries(STATUS_MAPPING)) {
      // Update proposal status references in edits
      const result = await BudgetOfficerEdit.updateMany(
        { 'changes.proposalStatus': oldStatus },
        { $set: { 'changes.$[].proposalStatus': newStatus } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`  ✅ Updated ${result.modifiedCount} edits: "${oldStatus}" → "${newStatus}"`);
        editCount += result.modifiedCount;
      }
    }
    console.log(`  📊 Total BudgetOfficerEdit records updated: ${editCount}`);

    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Proposals updated:        ${proposalCount}`);
    console.log(`Budget items updated:     ${totalBudgetItemsUpdated}`);
    console.log(`Edit records updated:     ${editCount}`);
    console.log(`Total records updated:    ${proposalCount + totalBudgetItemsUpdated + editCount}`);
    console.log('='.repeat(60));

    // Verify the migration
    console.log('\n🔍 Verification:');
    const oldStatusCounts = await Promise.all(
      Object.keys(STATUS_MAPPING)
        .filter(status => status === status.toLowerCase() || status.includes('OFFICE'))
        .map(oldStatus => 
          Proposal.countDocuments({ status: oldStatus })
            .then(count => ({ status: oldStatus, count }))
        )
    );

    const hasOldStatuses = oldStatusCounts.some(item => item.count > 0);
    if (hasOldStatuses) {
      console.warn('  ⚠️  Warning: Found remaining old status names:');
      oldStatusCounts.forEach(item => {
        if (item.count > 0) {
          console.warn(`     - "${item.status}": ${item.count} records`);
        }
      });
    } else {
      console.log('  ✅ No old status names remaining in database');
    }

    await mongoose.connection.close();
    console.log('\n✅ Migration completed and database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateProposals();
}

module.exports = migrateProposals;