/**
 * Migration Script: Backfill proposalId for all existing budget items
 * 
 * This script ensures that all Income, PersonnelServices, MOOE, and CapitalOutlay
 * items are linked to their parent proposal via the proposalId field.
 * 
 * This fixes the bug where total calculations were including items from ALL proposals
 * instead of just the specific proposal.
 * 
 * Run: node scripts/backfill-proposalIds.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');

async function backfillProposalIds() {
  try {
    console.log('🔗 Starting proposalId backfill migration...');
    
    await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URL);
    console.log('✅ Database connected');

    // Get all proposals
    const proposals = await Proposal.find({});
    console.log(`📊 Found ${proposals.length} proposals to process`);

    let stats = {
      incomeUpdated: 0,
      psUpdated: 0,
      mooeUpdated: 0,
      coUpdated: 0,
      errors: []
    };

    // For each proposal, find and link its budget items
    for (const proposal of proposals) {
      const criteria = {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType
      };

      try {
        // Update Income items
        const incomeResult = await Income.updateMany(
          { ...criteria, proposalId: { $exists: false } },
          { $set: { proposalId: proposal._id } }
        );
        stats.incomeUpdated += incomeResult.modifiedCount;

        // Update PersonnelServices items
        const psResult = await PersonnelServices.updateMany(
          { ...criteria, proposalId: { $exists: false } },
          { $set: { proposalId: proposal._id } }
        );
        stats.psUpdated += psResult.modifiedCount;

        // Update MOOE items
        const mooeResult = await MOOE.updateMany(
          { ...criteria, proposalId: { $exists: false } },
          { $set: { proposalId: proposal._id } }
        );
        stats.mooeUpdated += mooeResult.modifiedCount;

        // Update CapitalOutlay items
        const coResult = await CapitalOutlay.updateMany(
          { ...criteria, proposalId: { $exists: false } },
          { $set: { proposalId: proposal._id } }
        );
        stats.coUpdated += coResult.modifiedCount;

        console.log(`✅ Processed Proposal ${proposal._id}:`, {
          income: incomeResult.modifiedCount,
          personnelServices: psResult.modifiedCount,
          mooe: mooeResult.modifiedCount,
          capitalOutlay: coResult.modifiedCount
        });
      } catch (error) {
        console.error(`❌ Error processing proposal ${proposal._id}:`, error.message);
        stats.errors.push({
          proposalId: proposal._id,
          error: error.message
        });
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log('=====================================');
    console.log(`Income items updated:           ${stats.incomeUpdated}`);
    console.log(`PersonnelServices items updated: ${stats.psUpdated}`);
    console.log(`MOOE items updated:             ${stats.mooeUpdated}`);
    console.log(`CapitalOutlay items updated:    ${stats.coUpdated}`);
    console.log(`Total items updated:            ${stats.incomeUpdated + stats.psUpdated + stats.mooeUpdated + stats.coUpdated}`);
    console.log(`Errors encountered:             ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach(err => {
        console.log(`  - Proposal ${err.proposalId}: ${err.error}`);
      });
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

backfillProposalIds();