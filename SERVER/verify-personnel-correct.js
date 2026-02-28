require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    const proposalIdObjectId = new ObjectId('69a29d875ddcd46bd7d65834');
    
    console.log(`\n🔍 VERIFYING PersonnelServices Total (CORRECT FIELD NAME)\n`);
    
    // Get all PersonnelServices with correct ObjectId
    const personnelServices = await db.collection('personnelservices')
      .find({ proposalId: proposalIdObjectId })
      .toArray();
    
    console.log(`📊 Found ${personnelServices.length} PersonnelServices records\n`);
    
    let grandTotal = 0;
    
    console.log('Record Details:');
    console.log('─'.repeat(120));
    personnelServices.forEach((ps, i) => {
      const amount = ps.Total || 0;
      grandTotal += amount;
      
      console.log(`${i+1}. ${ps.employeeFullName || 'N/A'} - ${ps.positionTitle || 'N/A'}`);
      console.log(`   Total: ₱${amount.toFixed(2)}`);
      console.log(`   chargedToIncomeEligible: ${ps.chargedToIncomeEligible} | chargedToIncomeAmount: ₱${(ps.chargedToIncomeAmount || 0).toFixed(2)}`);
      console.log('─'.repeat(120));
    });
    
    console.log(`\n✅ MANUAL CALCULATION BY SUMMING 'Total' FIELD:`);
    console.log(`   Total Records: ${personnelServices.length}`);
    console.log(`   Grand Total: ₱${grandTotal.toFixed(2)}`);
    
    // Database aggregate using correct field
    const aggregateResult = await db.collection('personnelservices').aggregate([
      { $match: { proposalId: proposalIdObjectId } },
      { $group: { _id: null, total: { $sum: '$Total' }, count: { $sum: 1 } } }
    ]).toArray();
    
    if (aggregateResult.length > 0) {
      console.log(`\n📊 DATABASE AGGREGATE (using 'Total' field):`);
      console.log(`   Total Records: ${aggregateResult[0].count}`);
      console.log(`   Aggregate Sum: ₱${aggregateResult[0].total.toFixed(2)}`);
      
      if (Math.abs(grandTotal - aggregateResult[0].total) < 0.01) {
        console.log(`\n✅ VERIFIED! Manual matches aggregate.`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
