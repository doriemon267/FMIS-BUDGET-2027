/**
 * Fix: Set chargedToIncomeAmount to full Total for all records marked as chargedToIncomeEligible
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('[Fix] Connected to MongoDB');

    // Get all records marked as charged-to-income
    const chargedRecords = await PersonnelServices.find({ chargedToIncomeEligible: true });
    console.log('[Fix] Found', chargedRecords.length, 'records marked as chargedToIncomeEligible');

    let updateCount = 0;
    for (const record of chargedRecords) {
      const fullTotal = record.Total || 0;
      const currentAmount = record.chargedToIncomeAmount || 0;
      
      if (Math.abs(fullTotal - currentAmount) > 0.01) {
        // Amount is different, update it
        await PersonnelServices.updateOne(
          { _id: record._id },
          {
            $set: {
              chargedToIncomeAmount: fullTotal,
              chargedToIncomeSubsidyAmount: record.subsidyAmount || 0
            }
          }
        );
        updateCount++;
        console.log(`  ✓ Updated ${record._id}: ${currentAmount.toFixed(2)} → ${fullTotal.toFixed(2)}`);
      }
    }

    console.log(`\n[Fix] Updated ${updateCount} records`);

    // Verify
    const verified = await PersonnelServices.find({ chargedToIncomeEligible: true }).select('name Total chargedToIncomeAmount chargedToIncomeEligible').lean();
    console.log('\n[Fix] Verification:');
    verified.forEach(v => {
      const match = v.Total === v.chargedToIncomeAmount ? '✓' : '✗';
      console.log(`  ${match} ${v.name}: Total=${v.Total}, Charged=${v.chargedToIncomeAmount}`);
    });

    const totalCharged = verified.reduce((s, v) => s + (v.chargedToIncomeAmount || 0), 0);
    console.log(`\nTotal charged-to-income: ₱${totalCharged.toFixed(2)}`);

    await mongoose.disconnect();
    console.log('[Fix] Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
