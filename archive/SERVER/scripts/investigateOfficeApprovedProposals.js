/**
 * Investigation script to find proposals with "Office Approved" status
 * that should be "Division Submitted" or "Office Submitted"
 * 
 * This script checks for proposals that may have been incorrectly approved
 */

const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const path = require('path');

// Load environment variables from SERVER/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const investigateOfficeApprovedProposals = async () => {
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
    }).sort({ updatedAt: -1 });

    console.log('='.repeat(80));
    console.log('📊 INVESTIGATION: Proposals with "Office Approved" Status');
    console.log('='.repeat(80));
    console.log(`\nTotal found: ${officeApprovedProposals.length} proposals\n`);

    if (officeApprovedProposals.length === 0) {
      console.log('✅ No proposals with "Office Approved" status found.');
      process.exit(0);
    }

    console.log('Analyzing each proposal:\n');

    for (const [index, proposal] of officeApprovedProposals.entries()) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`${index + 1}. Proposal ID: ${proposal._id}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`   Fiscal Year: ${proposal.fiscalYear}`);
      console.log(`   Budget Type: ${proposal.budgetType}`);
      console.log(`   Region: ${proposal.region}`);
      console.log(`   Department: ${proposal.department || 'N/A'}`);
      console.log(`   Division: ${proposal.division || 'N/A'}`);
      console.log(`   Process By: ${proposal.processBy}`);
      console.log(`   Current Status: ${proposal.status}`);
      console.log(`   Current Workflow Level: ${proposal.workflowLevel || 'N/A'}`);
      console.log(`   Created At: ${proposal.createdAt}`);
      console.log(`   Updated At: ${proposal.updatedAt}`);
      console.log(`   Created By User ID: ${proposal.createdByUserId || 'N/A'}`);
      
      // Check workflow history
      if (proposal.workflowHistory && proposal.workflowHistory.length > 0) {
        console.log(`\n   📜 Workflow History (${proposal.workflowHistory.length} entries):`);
        proposal.workflowHistory.forEach((entry, idx) => {
          console.log(`      ${idx + 1}. ${entry.action} - ${entry.timestamp}`);
          console.log(`         By: ${entry.userName} (${entry.userId})`);
          console.log(`         Status: ${entry.previousStatus} → ${entry.newStatus}`);
          console.log(`         Comment: ${entry.comment || 'No comment'}`);
        });
      } else {
        console.log(`\n   ⚠️  No workflow history found!`);
      }

      // Check approval fields
      if (proposal.submittedByOfficer) {
        console.log(`\n   ✅ Submitted by Officer:`);
        console.log(`      User: ${proposal.submittedByOfficer.userName} (${proposal.submittedByOfficer.userId})`);
        console.log(`      Date: ${proposal.submittedByOfficer.date}`);
        console.log(`      Comment: ${proposal.submittedByOfficer.comment || 'No comment'}`);
      }

      if (proposal.approvedByManager) {
        console.log(`\n   ✅ Approved by Manager:`);
        console.log(`      User: ${proposal.approvedByManager.userName} (${proposal.approvedByManager.userId})`);
        console.log(`      Date: ${proposal.approvedByManager.date}`);
        console.log(`      Comment: ${proposal.approvedByManager.comment || 'No comment'}`);
      }

      // Determine if this is suspicious
      const hasOfficerSubmission = !!proposal.submittedByOfficer;
      const hasManagerApproval = !!proposal.approvedByManager;
      const workflowHistoryCount = proposal.workflowHistory?.length || 0;

      console.log(`\n   🔍 Analysis:`);
      if (!hasOfficerSubmission && hasManagerApproval) {
        console.log(`      ⚠️  SUSPICIOUS: Manager approved without Officer submission!`);
      } else if (hasOfficerSubmission && hasManagerApproval) {
        console.log(`      ✅ Normal workflow: Officer submitted → Manager approved`);
      } else if (!hasOfficerSubmission && !hasManagerApproval) {
        console.log(`      ⚠️  VERY SUSPICIOUS: No Officer submission AND no Manager approval!`);
        console.log(`      ❌ This proposal should NOT be "Office Approved"!`);
      }

      if (workflowHistoryCount === 0) {
        console.log(`      ⚠️  WARNING: No workflow history - status may have been set incorrectly!`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📝 Summary:');
    console.log('='.repeat(80));
    
    const suspicious = officeApprovedProposals.filter(p => 
      !p.submittedByOfficer || !p.approvedByManager || !p.workflowHistory?.length
    );

    console.log(`Total "Office Approved" proposals: ${officeApprovedProposals.length}`);
    console.log(`Suspicious proposals (missing proper workflow): ${suspicious.length}`);
    
    if (suspicious.length > 0) {
      console.log(`\n⚠️  ${suspicious.length} proposal(s) may have been incorrectly set to "Office Approved"`);
      console.log(`\nProposal IDs that need investigation:`);
      suspicious.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p._id} - ${p.fiscalYear} ${p.budgetType} (${p.region})`);
      });
    }

    console.log('='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    process.exit(1);
  }
};

// Run the script
investigateOfficeApprovedProposals();