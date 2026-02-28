require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

function calculatePersonnelTotal(personnel) {
  if (!personnel) return 0;
  return (
    (Number(personnel.annualSalary) || 0) +
    (Number(personnel.RATA) || 0) +
    (Number(personnel.PERA) || 0) +
    (Number(personnel.uniformALLOWANCE) || 0) +
    (Number(personnel.productivityIncentive) || 0) +
    (Number(personnel.additionalMedical) || 0) +
    (Number(personnel.subsistenceAllowance) || 0) +
    (Number(personnel.medical) || 0) +
    (Number(personnel.childrenAllowance) || 0) +
    (Number(personnel.meal) || 0) +
    (Number(personnel.cashGift) || 0) +
    (Number(personnel.subsistenceAllowanceMDS) || 0) +
    (Number(personnel.subsistenceAllowanceST) || 0) +
    (Number(personnel.midyearBonus) || 0) +
    (Number(personnel.yearEndBonus) || 0) +
    (Number(personnel.gsisPremium) || 0) +
    (Number(personnel.providentFund) || 0) +
    (Number(personnel.philhealthPremium) || 0) +
    (Number(personnel.pagibigPremium) || 0) +
    (Number(personnel.employeeCompensation) || 0) +
    (Number(personnel.loyaltyAward) || 0) +
    (Number(personnel.overtimePay) || 0) +
    (Number(personnel.earnedLeaves) || 0) +
    (Number(personnel.retirementBenefits) || 0) +
    (Number(personnel.terminalLeave) || 0) +
    (Number(personnel.courtAppearance) || 0)
  );
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    const proposalIdObjectId = new ObjectId('69a29d875ddcd46bd7d65834');
    
    // Get all PersonnelServices records
    const allPersonnel = await db.collection('personnelservices')
      .find({ proposalId: proposalIdObjectId })
      .toArray();
    
    console.log(`\n🔄 RECALCULATING PERSONNEL TOTALS WITH UPDATED FORMULA\n`);
    console.log(`Processing ${allPersonnel.length} records...\n`);
    
    let updateCount = 0;
    let totalOldSum = 0;
    let totalNewSum = 0;
    
    for (const ps of allPersonnel) {
      const newTotal = calculatePersonnelTotal(ps);
      const oldTotal = ps.Total || 0;
      
      totalOldSum += oldTotal;
      totalNewSum += newTotal;
      
      if (Math.abs(newTotal - oldTotal) > 0.01) {
        // Update the record
        await db.collection('personnelservices').updateOne(
          { _id: ps._id },
          { $set: { Total: newTotal, updatedAt: new Date() } }
        );
        
        console.log(`✅ ${ps.employeeFullName.padEnd(35)}`);
        console.log(`   Old Total: ₱${oldTotal.toFixed(2)}`);
        console.log(`   New Total: ₱${newTotal.toFixed(2)}`);
        console.log(`   Difference: ₱${(newTotal - oldTotal).toFixed(2)}\n`);
        
        updateCount++;
      }
    }
    
    console.log(`${'═'.repeat(90)}`);
    console.log(`\n📊 SUMMARY:\n`);
    console.log(`Records updated: ${updateCount}/${allPersonnel.length}`);
    console.log(`\nOld Grand Total: ₱${totalOldSum.toFixed(2)}`);
    console.log(`New Grand Total: ₱${totalNewSum.toFixed(2)}`);
    console.log(`Total Difference: ₱${(totalNewSum - totalOldSum).toFixed(2)}`);
    
    if (totalNewSum - totalOldSum === 46105.72) {
      console.log(`\n✅ VERIFIED! Difference matches expected ₱46,105.72`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
