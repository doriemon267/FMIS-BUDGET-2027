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
    
    const componentFields = [
      'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
      'subsistenceAllowance', 'medical', 'childrenAllowance', 'meal', 'additionalMedical',
      'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus',
      'yearEndBonus', 'gsisPremium', 'providentFund', 'philhealthPremium', 'pagibigPremium',
      'employeeCompensation', 'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits',
      'terminalLeave', 'courtAppearance'
    ];
    
    console.log(`\n✅ FINAL VERIFICATION - All Records Match\n`);
    console.log(`${'═'.repeat(100)}\n`);
    
    let allFormulaTotals = 0;
    let allDatabaseTotals = 0;
    let mismatchCount = 0;
    
    allPersonnel.forEach((person, i) => {
      let personFormulaTotal = 0;
      componentFields.forEach(field => {
        personFormulaTotal += (Number(person[field]) || 0);
      });
      
      const dbTotal = person.Total || 0;
      allFormulaTotals += personFormulaTotal;
      allDatabaseTotals += dbTotal;
      
      if (Math.abs(personFormulaTotal - dbTotal) > 0.01) {
        console.log(`❌ ${(i+1).toString().padStart(2)}. ${person.employeeFullName.padEnd(35)} - MISMATCH`);
        mismatchCount++;
      } else {
        console.log(`✅ ${(i+1).toString().padStart(2)}. ${person.employeeFullName.padEnd(35)} - ₱${dbTotal.toFixed(2)}`);
      }
    });
    
    console.log(`\n${'═'.repeat(100)}\n`);
    console.log(`📊 FINAL SUMMARY:\n`);
    console.log(`  Records with mismatches: ${mismatchCount}/${allPersonnel.length}`);
    console.log(`  Formula Total Sum:       ₱${allFormulaTotals.toFixed(2)}`);
    console.log(`  Database Total Sum:      ₱${allDatabaseTotals.toFixed(2)}`);
    console.log(`  Difference:              ₱${Math.abs(allFormulaTotals - allDatabaseTotals).toFixed(2)}\n`);
    
    if (mismatchCount === 0 && Math.abs(allFormulaTotals - allDatabaseTotals) < 0.01) {
      console.log(`✅✅✅ PERFECT MATCH! All records are now consistent! ✅✅✅\n`);
    }

    // Also check proposals table
    const proposal = await db.collection('proposals').findOne({ _id: proposalIdObjectId });
    const workflow = await db.collection('newproposalworkflows').findOne({ });
    
    console.log(`📋 PROPOSAL FIELDS:\n`);
    console.log(`  Proposal projectedSubsidy:        ₱${(proposal?.projectedSubsidy || 0).toFixed(2)}`);
    console.log(`  Workflow projectedSubsidy:        ₱${(workflow?.projectedSubsidy || 0).toFixed(2)}`);
    console.log(`  PersonnelServices Grand Total:    ₱${allDatabaseTotals.toFixed(2)}\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
