require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    const proposalIdObjectId = new ObjectId('69a29d875ddcd46bd7d65834');
    
    // Get only the first employee
    const ps = await db.collection('personnelservices')
      .findOne({ 
        proposalId: proposalIdObjectId,
        employeeFullName: 'TANIEGRA, SUSSIE T.'
      });
    
    if (!ps) {
      console.log('Employee not found');
      process.exit(1);
    }
    
    console.log(`\n🔍 DETAILED BREAKDOWN FOR: ${ps.employeeFullName} (${ps.positionTitle})\n`);
    
    const componentFields = [
      'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
      'subsistenceAllowance', 'medical', 'childrenAllowance', 'meal', 'additionalMedical',
      'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus',
      'yearEndBonus', 'gsisPremium', 'providentFund', 'philhealthPremium', 'pagibigPremium',
      'employeeCompensation', 'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits',
      'terminalLeave', 'courtAppearance'
    ];
    
    let componentSum = 0;
    const allValues = [];
    
    componentFields.forEach(field => {
      const value = Number(ps[field]) || 0;
      componentSum += value;
      allValues.push({ field, value });
    });
    
    console.log('All Component Fields:');
    console.log('─'.repeat(80));
    
    allValues.forEach(({ field, value }) => {
      if (value !== 0) {
        console.log(`${field.padEnd(35)} : ₱${value.toFixed(2)}`);
      }
    });
    
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Component Sum: ₱${componentSum.toFixed(2)}`);
    console.log(`Database.Total: ₱${ps.Total.toFixed(2)}`);
    console.log(`Missing from Total: ₱${(componentSum - ps.Total).toFixed(2)}`);
    
    console.log(`\n🔎 SEARCHING FOR MISSING AMOUNT...\n`);
    
    // Check which fields might have the missing amount
    const suspiciousFields = [];
    Object.keys(ps).forEach(field => {
      const value = Number(ps[field]) || 0;
      if (value > 1000 && !componentFields.includes(field) && value !== ps._id) {
        suspiciousFields.push({ field, value });
      }
    });
    
    if (suspiciousFields.length > 0) {
      console.log('Fields that might be missing from components:');
      suspiciousFields.forEach(({ field, value }) => {
        console.log(`  ${field.padEnd(35)} : ₱${value.toFixed(2)}`);
      });
    }
    
    // Check all fields in the record
    console.log(`\n\nAll Non-Zero Numeric Fields in Database Record:`);
    console.log('─'.repeat(80));
    let fieldNum = 1;
    Object.entries(ps).forEach(([field, value]) => {
      if (typeof value === 'number' && value !== 0 && field !== '__v') {
        console.log(`${fieldNum.toString().padStart(2)}. ${field.padEnd(35)} : ${value}`);
        fieldNum++;
      }
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
