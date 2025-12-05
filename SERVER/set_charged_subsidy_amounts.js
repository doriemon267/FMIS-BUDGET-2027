/**
 * Set chargedToIncomeSubsidyAmount for all charged-to-income records
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('[Fix] Connected to MongoDB');

    // Update chargedToIncomeSubsidyAmount for all records marked as chargedToIncomeEligible
    const chargedRecords = await PersonnelServices.find({ chargedToIncomeEligible: true });
    console.log('[Fix] Found', chargedRecords.length, 'records marked as chargedToIncomeEligible');
    
    let updateCount = 0;
    for (const record of chargedRecords) {
      const subsidyAmount = record.subsidyAmount || 0;
      const currentChargedSubsidy = record.chargedToIncomeSubsidyAmount || 0;
      
      if (Math.abs(subsidyAmount - currentChargedSubsidy) > 0.01) {
        await PersonnelServices.updateOne(
          { _id: record._id },
          { $set: { chargedToIncomeSubsidyAmount: subsidyAmount } }
        );
        updateCount++;
        console.log(`  ✓ Updated: chargedToIncomeSubsidyAmount = ${subsidyAmount.toFixed(2)}`);
      }
    }
    
    console.log(`\n[Fix] Updated ${updateCount} records`);
    
    // Verify
    const verified = await PersonnelServices.find({ chargedToIncomeEligible: true }).select('chargedToIncomeSubsidyAmount subsidyAmount').lean();
    const totalChargedSubsidy = verified.reduce((s, v) => s + (v.chargedToIncomeSubsidyAmount || 0), 0);
    console.log(`[Fix] Total chargedToIncomeSubsidyAmount: ₱${totalChargedSubsidy.toFixed(2)}`);

    await mongoose.disconnect();
    console.log('[Fix] Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
