/**
 * Set subsidyAmount = Total for all Personnel Services records
 * This ensures all PS get government subsidy automatically
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('[Fix] Connected to MongoDB');

    // Get all PS records
    const allPS = await PersonnelServices.find();
    console.log('[Fix] Found', allPS.length, 'personnel services records');

    let updateCount = 0;
    for (const record of allPS) {
      const fullTotal = record.Total || 0;
      const currentSubsidy = record.subsidyAmount || 0;
      
      if (Math.abs(fullTotal - currentSubsidy) > 0.01) {
        // Subsidy is different from Total, update it
        await PersonnelServices.updateOne(
          { _id: record._id },
          {
            $set: {
              subsidyAmount: fullTotal,
              subsidyEligible: fullTotal > 0 ? true : false
            }
          }
        );
        updateCount++;
        console.log(`  ✓ Updated: ${currentSubsidy.toFixed(2)} → ${fullTotal.toFixed(2)}`);
      }
    }

    console.log(`\n[Fix] Updated ${updateCount} records`);

    // Verify by status
    const permanent = await PersonnelServices.find({ statusOfAppointment: 'PERMANENT' }).select('subsidyAmount Total').lean();
    const casual = await PersonnelServices.find({ statusOfAppointment: 'CASUAL' }).select('subsidyAmount Total').lean();
    
    const psSubsidy = permanent.reduce((s, p) => s + (p.subsidyAmount || 0), 0);
    const casualSubsidy = casual.reduce((s, c) => s + (c.subsidyAmount || 0), 0);
    
    console.log('\n[Fix] Verification:');
    console.log(`  PS-Permanent: ${permanent.length} records, total subsidy: ₱${psSubsidy.toFixed(2)}`);
    console.log(`  PS-Casual: ${casual.length} records, total subsidy: ₱${casualSubsidy.toFixed(2)}`);
    console.log(`  TOTAL PS subsidy: ₱${(psSubsidy + casualSubsidy).toFixed(2)}`);

    await mongoose.disconnect();
    console.log('[Fix] Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
