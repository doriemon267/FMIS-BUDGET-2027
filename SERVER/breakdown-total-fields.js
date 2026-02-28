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
    
    console.log(`\n📋 PERSONNEL SERVICES FIELD BREAKDOWN\n`);
    console.log(`Employee: ${ps.employeeFullName}`);
    console.log(`Position: ${ps.positionTitle}`);
    console.log(`─`.repeat(100));
    
    // List all numeric fields (potential salary components)
    const salaryComponents = [
      'monthlySalary',
      'annualSalary',
      'RATA',
      'PERA',
      'uniformALLOWANCE',
      'productivityIncentive',
      'hazardPay',
      'additionalMedical',
      'subsistenceAllowance',
      'honoraria',
      'medical',
      'childrenAllowance',
      'subsistenceAllowanceMDS',
      'subsistenceAllowanceST',
      'midyearBonus',
      'cashGift',
      'yearEndBonus',
      'gsisPremium',
      'providentFund',
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
    
    console.log('\n💰 SALARY COMPONENT BREAKDOWN:\n');
    let manualSum = 0;
    let componentCount = 0;
    
    salaryComponents.forEach((field) => {
      const value = ps[field] || 0;
      if (value !== 0 || true) { // Show all fields
        componentCount++;
        manualSum += value;
        console.log(`${componentCount.toString().padStart(2)}. ${field.padEnd(30)} : ₱${value.toFixed(2)}`);
      }
    });
    
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`\n📊 VERIFICATION:`);
    console.log(`   Manual Sum of Components: ₱${manualSum.toFixed(2)}`);
    console.log(`   Total Field in Database:  ₱${ps.Total.toFixed(2)}`);
    
    if (Math.abs(manualSum - ps.Total) < 0.01) {
      console.log(`\n✅ MATCH! All components add up to Total.`);
    } else {
      console.log(`\n⚠️  MISMATCH! Difference: ₱${(ps.Total - manualSum).toFixed(2)}`);
    }
    
    // Now sum for ALL 16 employees
    console.log(`\n\n${'═'.repeat(100)}`);
    console.log(`\n📈 TOTAL ACROSS ALL 16 PERSONNEL:\n`);
    
    const allPersonnel = await db.collection('personnelservices')
      .find({ proposalId: proposalIdObjectId })
      .toArray();
    
    const totals = {};
    salaryComponents.forEach(field => totals[field] = 0);
    
    allPersonnel.forEach(person => {
      salaryComponents.forEach(field => {
        totals[field] += (person[field] || 0);
      });
    });
    
    let grandTotal = 0;
    salaryComponents.forEach((field) => {
      const value = totals[field];
      if (value !== 0) {
        grandTotal += value;
        console.log(`${field.padEnd(30)} : ₱${value.toFixed(2)}`);
      }
    });
    
    console.log(`${'─'.repeat(100)}`);
    console.log(`GRAND TOTAL                    : ₱${grandTotal.toFixed(2)}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
