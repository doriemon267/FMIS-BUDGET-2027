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
    
    console.log(`\n${'═'.repeat(120)}`);
    console.log(`📊 COMPLETE FIELD BREAKDOWN FOR PERSONNELSERVICES TOTAL`);
    console.log(`${'═'.repeat(120)}\n`);
    
    // The fields that compose the Total (based on verification)
    const totalComposingFields = [
      // Salary
      'annualSalary',
      // Allowances
      'RATA',
      'PERA',
      'uniformALLOWANCE',
      'productivityIncentive',
      'subsistenceAllowance',        // ← KEY: This was missing from formula
      'medical',
      'childrenAllowance',
      'meal',
      'additionalMedical',
      // Benefits
      'cashGift',
      'subsistenceAllowanceMDS',
      'subsistenceAllowanceST',
      // Bonuses
      'midyearBonus',
      'yearEndBonus',
      // Contributions (employer side)
      'gsisPremium',
      'providentFund',
      'philhealthPremium',
      'pagibigPremium',
      'employeeCompensation',
      // Other
      'loyaltyAward',
      'overtimePay',
      'earnedLeaves',
      'retirementBenefits',
      'terminalLeave',
      'courtAppearance'
    ];
    
    console.log('💰 ALL COMPONENT FIELDS THAT MAKE UP "TOTAL":\n');
    
    const totals = {};
    totalComposingFields.forEach(field => totals[field] = 0);
    
    allPersonnel.forEach(person => {
      totalComposingFields.forEach(field => {
        totals[field] += (Number(person[field]) || 0);
      });
    });
    
    // Categorize and display
    const categories = {
      'BASE SALARY': ['annualSalary'],
      'ALLOWANCES': ['RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive', 'subsistenceAllowance'],
      'EMPLOYEE BENEFITS': ['medical', 'childrenAllowance', 'meal', 'additionalMedical'],
      'BONUSES': ['cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus'],
      'EMPLOYER CONTRIBUTIONS': ['gsisPremium', 'providentFund', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation'],
      'OTHER': ['loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance']
    };
    
    let grandTotal = 0;
    let fieldNum = 1;
    
    for (const [category, fields] of Object.entries(categories)) {
      console.log(`\n${category}:`);
      console.log('─'.repeat(120));
      
      let categoryTotal = 0;
      fields.forEach(field => {
        const value = totals[field];
        categoryTotal += value;
        grandTotal += value;
        if (value !== 0) {
          console.log(`  ${fieldNum.toString().padStart(2)}. ${field.padEnd(35)} : ₱${value.toFixed(2)}`);
          fieldNum++;
        }
      });
      
      if (categoryTotal !== 0) {
        console.log(`     ${category} Subtotal                             : ₱${categoryTotal.toFixed(2)}`);
      }
    }
    
    console.log(`\n${'═'.repeat(120)}`);
    console.log(`\n✅ GRAND TOTAL (All 16 Personnel Combined): ₱${grandTotal.toFixed(2)}\n`);
    
    console.log(`Fields explicitly EXCLUDED from Total:`);
    console.log('─'.repeat(120));
    const excludedFields = ['monthlySalary', 'subsidyEligible', 'subsidyAmount', 'chargedToIncomeEligible', 'chargedToIncomeAmount'];
    excludedFields.forEach(field => {
      console.log(`  ✗ ${field.padEnd(35)} - NOT included in Total calculation`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
