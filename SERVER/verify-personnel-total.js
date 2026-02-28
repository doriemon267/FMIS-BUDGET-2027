require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    // Get the proposal ID
    const proposal = await db.collection('proposals').findOne({});
    const proposalId = proposal._id.toString();
    
    console.log(`\n🔍 VERIFYING PersonnelServices Total for Proposal: ${proposalId}\n`);
    
    // Query all PersonnelServices for this proposal
    const personnelServices = await db.collection('personnelservices').find({
      proposalId: proposalId,
      fiscalYear: 2027,
      budgetType: 'Initial'
    }).toArray();
    
    console.log(`📊 Found ${personnelServices.length} PersonnelServices records\n`);
    
    let grandTotal = 0;
    let recordCount = 0;
    
    console.log('Record Details:');
    console.log('─'.repeat(100));
    personnelServices.forEach((ps, i) => {
      recordCount++;
      const amount = ps.totalAmount || 0;
      grandTotal += amount;
      
      console.log(`${i+1}. Position: ${ps.positionTitle || 'N/A'}`);
      console.log(`   Amount: ₱${amount.toFixed(2)}`);
      console.log(`   chargedToIncomeEligible: ${ps.chargedToIncomeEligible}`);
      console.log(`   chargedToIncomeAmount: ₱${(ps.chargedToIncomeAmount || 0).toFixed(2)}`);
      console.log('─'.repeat(100));
    });
    
    console.log(`\n✅ MANUAL CALCULATION RESULT:`);
    console.log(`   Total Records Summed: ${recordCount}`);
    console.log(`   Grand Total: ₱${grandTotal.toFixed(2)}`);
    
    // Also get the database aggregate sum for comparison
    const aggregateResult = await db.collection('personnelservices').aggregate([
      {
        $match: {
          proposalId: proposalId,
          fiscalYear: 2027,
          budgetType: 'Initial'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    if (aggregateResult.length > 0) {
      console.log(`\n📊 DATABASE AGGREGATE RESULT:`);
      console.log(`   Total Records: ${aggregateResult[0].count}`);
      console.log(`   Aggregate Sum: ₱${aggregateResult[0].total.toFixed(2)}`);
      
      if (Math.abs(grandTotal - aggregateResult[0].total) < 0.01) {
        console.log(`\n✅ MATCH! Manual calculation matches database aggregate.`);
      } else {
        console.log(`\n⚠️  MISMATCH! Manual: ₱${grandTotal.toFixed(2)} vs Aggregate: ₱${aggregateResult[0].total.toFixed(2)}`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
