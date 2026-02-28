require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    const proposalIdObjectId = new ObjectId('69a29d875ddcd46bd7d65834');
    
    // Get all PersonnelServices records
    const allPersonnel = await db.collection('personnelservices')
      .find({ proposalId: proposalIdObjectId })
      .toArray();
    
    console.log(`\n📋 TOTAL FIELD vs COMPONENT SUM COMPARISON\n`);
    console.log(`${'─'.repeat(140)}\n`);
    
    const componentFields = [
      'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
      'subsistenceAllowance', 'medical', 'childrenAllowance', 'meal', 'additionalMedical',
      'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus',
      'yearEndBonus', 'gsisPremium', 'providentFund', 'philhealthPremium', 'pagibigPremium',
      'employeeCompensation', 'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits',
      'terminalLeave', 'courtAppearance'
    ];
    
    let totalFieldSum = 0;
    let componentFieldSum = 0;
    let mismatchCount = 0;
    
    allPersonnel.forEach((ps, i) => {
      // Calculate component sum
      let compSum = 0;
      componentFields.forEach(field => {
        compSum += (Number(ps[field]) || 0);
      });
      
      const databaseTotal = ps.Total || 0;
      totalFieldSum += databaseTotal;
      componentFieldSum += compSum;
      
      const difference = databaseTotal - compSum;
      
      console.log(`${(i+1).toString().padStart(2)}. ${ps.employeeFullName.padEnd(35)} ${ps.positionTitle.padEnd(45)}`);
      console.log(`    Database .Total:      ₱${databaseTotal.toFixed(2)}`);
      console.log(`    Component Sum:        ₱${compSum.toFixed(2)}`);
      
      if (Math.abs(difference) > 0.01) {
        console.log(`    ⚠️  MISMATCH:            ₱${difference.toFixed(2)}`);
        mismatchCount++;
      } else {
        console.log(`    ✅ MATCH`);
      }
      console.log('');
    });
    
    console.log(`${'─'.repeat(140)}\n`);
    console.log(`SUMMARY:`);
    console.log(`  Total sum of .Total fields:    ₱${totalFieldSum.toFixed(2)}`);
    console.log(`  Total sum of component fields: ₱${componentFieldSum.toFixed(2)}`);
    console.log(`  Total Difference:              ₱${(totalFieldSum - componentFieldSum).toFixed(2)}`);
    console.log(`  Records with mismatches:       ${mismatchCount}/${allPersonnel.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
