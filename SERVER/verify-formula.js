require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    const proposalIdObjectId = new ObjectId('69a29d875ddcd46bd7d65834');
    
    // Get first PersonnelServices record
    const ps = await db.collection('personnelservices')
      .findOne({ proposalId: proposalIdObjectId });
    
    if (!ps) {
      console.log('No PersonnelServices found');
      process.exit(1);
    }
    
    console.log(`\n📋 FORMULA-BASED TOTAL CALCULATION\n`);
    console.log(`Employee: ${ps.employeeFullName} (${ps.positionTitle})`);
    console.log(`${'─'.repeat(100)}\n`);
    
    // This is the formula from calculatePersonnelTotal function
    const formulaFields = [
      'annualSalary',
      'RATA',
      'PERA',
      'uniformALLOWANCE',
      'productivityIncentive',
      'medical',
      'childrenAllowance',
      'meal',
      'cashGift',
      'subsistenceAllowanceMDS',
      'subsistenceAllowanceST',
      'midyearBonus',
      'yearEndBonus',
      'gsisPremium',
      'philhealthPremium',
      'pagibigPremium',
      'employeeCompensation',
      'loyaltyAward',
      'overtimePay',
      'earnedLeaves',
      'retirementBenefits',
      'terminalLeave',
      'courtAppearance'
    ];
    
    console.log('💰 FIELDS USED IN TOTAL CALCULATION:\n');
    let formulaTotal = 0;
    
    formulaFields.forEach((field, i) => {
      const value = Number(ps[field]) || 0;
      formulaTotal += value;
      if (value !== 0) {
        console.log(`${(i+1).toString().padStart(2)}. ${field.padEnd(30)} : ₱${value.toFixed(2)}`);
      }
    });
    
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`\nFormula Total (sum):            ₱${formulaTotal.toFixed(2)}`);
    console.log(`Database Total field:           ₱${ps.Total.toFixed(2)}`);
    console.log(`Difference:                     ₱${(ps.Total - formulaTotal).toFixed(2)}`);
    
    if (Math.abs(formulaTotal - ps.Total) < 0.01) {
      console.log(`\n✅ MATCH! Database Total matches formula.`);
    } else {
      console.log(`\n⚠️  MISMATCH! Let me check which fields are NOT in the formula:\n`);
      
      const notInFormula = [
        'monthlySalary',
        'hazardPay',
        'additionalMedical',
        'subsistenceAllowance',
        'providentFund',
        'subsidyEligible',
        'subsidyAmount',
        'chargedToIncomeEligible',
        'chargedToIncomeAmount'
      ];
      
      console.log('Fields in database but NOT in formula:');
      const unaccountedFor = {};
      let unaccountedTotal = 0;
      
      notInFormula.forEach((field) => {
        const value = Number(ps[field]) || 0;
        if (value !== 0) {
          unaccountedFor[field] = value;
          unaccountedTotal += value;
          console.log(`  - ${field.padEnd(30)} : ₱${value.toFixed(2)}`);
        }
      });
      
      console.log(`\nTotal of unaccounted fields:    ₱${unaccountedTotal.toFixed(2)}`);
      console.log(`Formula Total + Unaccounted:    ₱${(formulaTotal + unaccountedTotal).toFixed(2)}`);
    }
    
    // Now check ALL 16 employees
    console.log(`\n\n${'═'.repeat(100)}`);
    console.log(`\n📊 VERIFICATION ACROSS ALL 16 PERSONNEL:\n`);
    
    const allPersonnel = await db.collection('personnelservices')
      .find({ proposalId: proposalIdObjectId })
      .toArray();
    
    let allFormulaTotals = 0;
    let allDatabaseTotals = 0;
    let allDifference = 0;
    
    allPersonnel.forEach(person => {
      let personFormulaTotal = 0;
      formulaFields.forEach(field => {
        personFormulaTotal += (Number(person[field]) || 0);
      });
      allFormulaTotals += personFormulaTotal;
      allDatabaseTotals += (person.Total || 0);
      allDifference += ((person.Total || 0) - personFormulaTotal);
    });
    
    console.log(`Sum of all Formula Totals:      ₱${allFormulaTotals.toFixed(2)}`);
    console.log(`Sum of all Database Totals:     ₱${allDatabaseTotals.toFixed(2)}`);
    console.log(`Total Difference:               ₱${allDifference.toFixed(2)}`);
    
    if (Math.abs(allFormulaTotals - allDatabaseTotals) < 0.01) {
      console.log(`\n✅ MATCH! All database totals match formulas.`);
    } else {
      console.log(`\n⚠️  MISMATCH ACROSS ALL RECORDS!`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
