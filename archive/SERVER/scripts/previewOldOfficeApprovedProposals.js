/**
 * Preview script to see which "Office Approved" proposals will be updated
 * This is a READ-ONLY script that shows what will be changed
 * 
 * Run this FIRST to see what proposals will be affected
 */

const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const path = require('path');

// Load environment variables from SERVER/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const previewOldOfficeApprovedProposals = async () => {
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
    console.log('✅ Connected to database\n');

    // Find all proposals with "Office Approved" status
    const officeApprovedProposals = await Proposal.find({
      status: { $in: ['Office Approved', 'OFFICE APPROVED'] }
    }).sort({ fiscalYear: -1, createdAt: -1 });

    console.log('='.repeat(80));
    console.log('📊 PREVIEW: Proposals with "Office Approved" Status');
    console.log('='.repeat(80));
    console.log(`\nTotal found: ${officeApprovedProposals.length} proposals\n`);

    if (officeApprovedProposals.length === 0) {
      console.log('✅ No proposals with "Office Approved" status found.');
      console.log('✅ All proposals are already in the correct state!');
      process.exit(0);
    }

    console.log('These proposals will be updated from "Office Approved" to "Finalized":\n');

    officeApprovedProposals.forEach((proposal, index) => {
      console.log(`${index + 1}. Proposal ID: ${proposal._id}`);
      console.log(`   Fiscal Year: ${proposal.fiscalYear}`);
      console.log(`   Budget Type: ${proposal.budgetType}`);
      console.log(`   Region: ${proposal.region}`);
      console.log(`   Process By: ${proposal.processBy}`);
      console.log(`   Current Status: ${proposal.status}`);
      console.log(`   Current Workflow Level: ${proposal.workflowLevel || 'N/A'}`);
      console.log(`   Created At: ${proposal.createdAt}`);
      console.log(`   Updated At: ${proposal.updatedAt}`);
      console.log(`   → Will change to: Status = "Finalized", Workflow Level = "FINALIZED"`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('📝 Next Steps:');
    console.log('='.repeat(80));
    console.log('1. Review the list above carefully');
    console.log('2. If you want to proceed with the update, run:');
    console.log('   node SERVER/scripts/updateOldOfficeApprovedProposals.js');
    console.log('');
    console.log('⚠️  WARNING: The update script will change ALL proposals listed above!');
    console.log('='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('❌ Error during preview:', error);
    process.exit(1);
  }
};

// Run the script
previewOldOfficeApprovedProposals();