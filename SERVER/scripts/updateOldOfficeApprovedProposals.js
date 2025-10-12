/**
 * Script to update OLD "Office Approved" proposals to "Finalized"
 * This is a one-time migration script to clean up proposals that were
 * approved before the new workflow was implemented.
 * 
 * Run this script ONCE to update all existing "Office Approved" proposals.
 */

const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const path = require('path');

// Load environment variables from SERVER/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const updateOldOfficeApprovedProposals = async () => {
  try {
    console.log('🔄 Connecting to database...');
    const dbUrl = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!dbUrl) {
      throw new Error('Database URL not found in .env file. Please check MONGODB_BUDGET_URL variable.');
    }
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database');

    // Find all proposals with "Office Approved" status
    const officeApprovedProposals = await Proposal.find({
      status: { $in: ['Office Approved', 'OFFICE APPROVED'] }
    });

    console.log(`\n📊 Found ${officeApprovedProposals.length} proposals with "Office Approved" status`);

    if (officeApprovedProposals.length === 0) {
      console.log('✅ No proposals to update. Exiting...');
      process.exit(0);
    }

    // Ask for confirmation
    console.log('\n⚠️  This will update ALL "Office Approved" proposals to "Finalized" status.');
    console.log('⚠️  This action cannot be undone easily.');
    console.log('\nProposals to be updated:');
    
    officeApprovedProposals.forEach((proposal, index) => {
      console.log(`  ${index + 1}. ${proposal.fiscalYear} - ${proposal.budgetType} - ${proposal.region} - ${proposal.processBy}`);
    });

    console.log('\n🔄 Starting update process...\n');

    let updatedCount = 0;
    let errorCount = 0;

    for (const proposal of officeApprovedProposals) {
      try {
        console.log(`Updating proposal: ${proposal.fiscalYear} - ${proposal.budgetType} - ${proposal.region} - ${proposal.processBy}`);

        // Update the proposal status
        proposal.status = 'Finalized';
        proposal.workflowLevel = 'FINALIZED';
        await proposal.save();

        // Update related entities
        const queryParams = {
          fiscalYear: proposal.fiscalYear,
          budgetType: proposal.budgetType,
          region: proposal.region,
          processBy: proposal.processBy
        };

        // Update Income records
        await Income.updateMany(
          queryParams,
          { 
            $set: { 
              status: 'Finalized',
              workflowLevel: 'FINALIZED'
            } 
          }
        );

        // Update PersonnelServices records
        await PersonnelServices.updateMany(
          queryParams,
          { 
            $set: { 
              status: 'Finalized',
              workflowLevel: 'FINALIZED'
            } 
          }
        );

        // Update MOOE records
        await MOOE.updateMany(
          queryParams,
          { 
            $set: { 
              status: 'Finalized',
              workflowLevel: 'FINALIZED'
            } 
          }
        );

        // Update CapitalOutlay records
        await CapitalOutlay.updateMany(
          queryParams,
          { 
            $set: { 
              status: 'Finalized',
              workflowLevel: 'FINALIZED'
            } 
          }
        );

        console.log(`  ✅ Updated proposal and all related entities`);
        updatedCount++;

      } catch (error) {
        console.error(`  ❌ Error updating proposal ${proposal._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Update Summary:');
    console.log(`  ✅ Successfully updated: ${updatedCount} proposals`);
    console.log(`  ❌ Failed to update: ${errorCount} proposals`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
};

// Run the script
updateOldOfficeApprovedProposals();