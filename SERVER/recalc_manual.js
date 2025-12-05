require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
const recalculateProposalTotals = require('./utils/recalculateProposalTotals');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== RECALCULATING PROPOSAL TOTALS ===\n');
    
    // Find the proposal
    const proposal = await Proposal.findOne({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    });
    
    if (!proposal) {
      console.log('❌ Proposal not found');
      process.exit(1);
    }
    
    console.log('Found Proposal:', proposal._id);
    console.log('Before recalculation:');
    console.log('  totalIncome:', proposal.totalIncome);
    console.log('  totalExpenses:', proposal.totalExpenses);
    console.log('  projectedSubsidy:', proposal.projectedSubsidy);
    
    // Trigger recalculation using proposal ID
    await recalculateProposalTotals.recalculateAndSaveProposalTotals({ proposalId: proposal._id });
    
    // Fetch updated proposal
    const updated = await Proposal.findOne({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    });
    
    console.log('\n✅ After recalculation:');
    console.log('  totalIncome: ₱' + updated.totalIncome.toFixed(2));
    console.log('  totalExpenses: ₱' + updated.totalExpenses.toFixed(2));
    console.log('  projectedSubsidy: ₱' + updated.projectedSubsidy.toFixed(2));
    console.log('  projectedIncome: ₱' + updated.projectedIncome.toFixed(2));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
})();
