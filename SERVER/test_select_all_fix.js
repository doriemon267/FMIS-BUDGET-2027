/**
 * Test script: Reset permanent personnel and then test Select All + Charge to Income
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');
const Proposal = require('./models/Proposal');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('[Test] Connected to MongoDB');

    // Reset permanent personnel
    console.log('[Test] Resetting permanent personnel...');
    const resetResult = await PersonnelServices.updateMany(
      { statusOfAppointment: 'PERMANENT' },
      {
        $set: {
          chargedToIncomeEligible: false,
          chargedToIncomeAmount: 0,
          chargedToIncomeSubsidyAmount: 0
        }
      }
    );
    console.log('[Test] Reset result:', resetResult);

    // Check current state
    const permanent = await PersonnelServices.find({ statusOfAppointment: 'PERMANENT' }).select('name Total chargedToIncomeEligible chargedToIncomeAmount').lean();
    console.log('\n[Test] After reset - Permanent Personnel:');
    permanent.forEach(p => {
      console.log(`  - ${p.name}: Total=${p.Total}, chargedToIncomeEligible=${p.chargedToIncomeEligible}, chargedToIncomeAmount=${p.chargedToIncomeAmount}`);
    });

    // Simulate what the backend will do with the fixed code
    // When Select All is used, items sent to backend will have no chargedToIncomeAmount
    console.log('\n[Test] Simulating backend fix - resolving amounts:');
    const testPayload = permanent.map(p => ({
      _id: p._id,
      name: p.name,
      chargedToIncomeAmount: undefined // This is what comes from Select All when frontend doesn't provide amount
    }));

    for (const item of testPayload) {
      const record = permanent.find(p => p._id.toString() === item._id.toString());
      let resolvedAmount = 0;
      
      // This is the logic from the backend fix
      const providedAmount = Number(item.chargedToIncomeAmount ?? 0);
      if (Number.isFinite(providedAmount) && providedAmount > 0) {
        resolvedAmount = providedAmount;
      } else {
        // No amount provided - use the full salary total
        resolvedAmount = Number(record.Total || 0);
      }
      
      console.log(`  - ${item.name}: proposedAmount=undefined → resolvedAmount=${resolvedAmount.toFixed(2)}`);
    }

    // Check if proposal exists
    const proposal = await Proposal.findOne({ region: 'CENTRAL OFFICE', fiscalYear: 2026, budgetType: 'INITIAL' }).select('_id').lean();
    if (proposal) {
      console.log('\n[Test] Proposal found:', proposal._id);
    } else {
      console.log('\n[Test] No proposal found - recalculation would need to find one');
    }

    await mongoose.disconnect();
    console.log('[Test] Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
