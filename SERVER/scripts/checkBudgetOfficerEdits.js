/**
 * Script to check existing BudgetOfficerEdit records
 * This will help us understand what's blocking the submission
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const Proposal = require('../models/Proposal');

async function checkBudgetOfficerEdits() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all BudgetOfficerEdit records
    console.log('📋 Checking all BudgetOfficerEdit records...\n');
    const allEdits = await BudgetOfficerEdit.find({}).sort({ createdAt: -1 }).limit(20);
    
    console.log(`Found ${allEdits.length} BudgetOfficerEdit records (showing latest 20):\n`);
    
    for (const edit of allEdits) {
      console.log('─────────────────────────────────────────────────────');
      console.log(`Edit ID: ${edit._id}`);
      console.log(`Proposal ID: ${edit.proposalId}`);
      console.log(`Status: ${edit.status}`);
      console.log(`Fiscal Year: ${edit.fiscalYear}`);
      console.log(`Budget Type: ${edit.budgetType}`);
      console.log(`Department: ${edit.department}`);
      console.log(`Division: ${edit.division}`);
      console.log(`Edited By: ${edit.editedBy?.userName || 'Unknown'} (${edit.editedBy?.userId || 'N/A'})`);
      console.log(`Created At: ${edit.createdAt}`);
      console.log(`Submitted At: ${edit.submittedAt || 'Not submitted'}`);
      console.log(`Comments: ${edit.comments || 'No comments'}`);
      
      // Check if proposal still exists
      const proposal = await Proposal.findById(edit.proposalId);
      if (proposal) {
        console.log(`Proposal Status: ${proposal.status}`);
        console.log(`Proposal Workflow Level: ${proposal.workflowLevel || 'Not set'}`);
      } else {
        console.log(`⚠️ WARNING: Proposal not found!`);
      }
      console.log('');
    }

    // Find specifically "Submitted" or "Approved" edits
    console.log('\n📋 Checking "Submitted" or "Approved" BudgetOfficerEdit records...\n');
    const submittedEdits = await BudgetOfficerEdit.find({
      status: { $in: ['Submitted', 'Approved'] }
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${submittedEdits.length} "Submitted" or "Approved" edits:\n`);
    
    for (const edit of submittedEdits) {
      console.log('─────────────────────────────────────────────────────');
      console.log(`Edit ID: ${edit._id}`);
      console.log(`Proposal ID: ${edit.proposalId}`);
      console.log(`Status: ${edit.status}`);
      console.log(`Fiscal Year: ${edit.fiscalYear}`);
      console.log(`Department: ${edit.department}`);
      console.log(`Division: ${edit.division}`);
      console.log(`Edited By: ${edit.editedBy?.userName || 'Unknown'}`);
      console.log(`Submitted At: ${edit.submittedAt}`);
      
      // Check proposal status
      const proposal = await Proposal.findById(edit.proposalId);
      if (proposal) {
        console.log(`Proposal Status: ${proposal.status}`);
        console.log(`Proposal Workflow Level: ${proposal.workflowLevel || 'Not set'}`);
        
        // Check if proposal status matches edit status
        if (edit.status === 'Submitted' && proposal.status !== 'Office Submitted') {
          console.log(`⚠️ MISMATCH: Edit is "Submitted" but Proposal status is "${proposal.status}"`);
        }
      } else {
        console.log(`⚠️ WARNING: Proposal not found!`);
      }
      console.log('');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`Total BudgetOfficerEdit records: ${allEdits.length}`);
    console.log(`"Submitted" or "Approved" edits: ${submittedEdits.length}`);
    
    const statusCounts = {};
    allEdits.forEach(edit => {
      statusCounts[edit.status] = (statusCounts[edit.status] || 0) + 1;
    });
    
    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkBudgetOfficerEdits();