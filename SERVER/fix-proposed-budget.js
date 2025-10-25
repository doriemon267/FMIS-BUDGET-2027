/**
 * Fix script to recalculate proposedBudget for all existing proposals
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');

async function fixProposedBudgets() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');

    console.log('📋 Fetching all proposals...');
    const proposals = await Proposal.find({});
    console.log(`Found ${proposals.length} proposals to check`);

    let fixedCount = 0;
    let errors = 0;

    for (const proposal of proposals) {
      try {
        // Recalculate based on the formula: proposedBudget = totalExpenses + totalIncome
        const totalExpenses = proposal.totalExpenses || 0;
        const totalIncome = proposal.totalIncome || 0;
        const correctProposedBudget = totalExpenses + totalIncome;

        // Check if it needs fixing
        if (proposal.proposedBudget !== correctProposedBudget) {
          console.log(`⚠️  Fixing proposal ${proposal._id}:`);
          console.log(`   Old proposedBudget: ₱${(proposal.proposedBudget || 0).toLocaleString()}`);
          console.log(`   New proposedBudget: ₱${correctProposedBudget.toLocaleString()}`);
          console.log(`   (totalExpenses: ₱${totalExpenses.toLocaleString()} + totalIncome: ₱${totalIncome.toLocaleString()})`);

          await Proposal.findByIdAndUpdate(proposal._id, {
            proposedBudget: correctProposedBudget
          });

          fixedCount++;
        }
      } catch (err) {
        console.error(`❌ Error fixing proposal ${proposal._id}:`, err.message);
        errors++;
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`- Fixed: ${fixedCount} proposals`);
    console.log(`- Errors: ${errors}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixProposedBudgets();