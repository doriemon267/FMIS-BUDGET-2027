require('dotenv').config();
const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    // Get first PersonnelServices record to see structure
    console.log('📋 SAMPLE PersonnelServices RECORD:\n');
    const sample = await db.collection('personnelservices').findOne({});
    
    if (sample) {
      console.log(JSON.stringify(sample, null, 2));
      
      console.log('\n\n🔍 CHECKING PROPOSAL ID QUERIES:\n');
      
      // Try different ways to query
      const proposalIdString = '69a29d875ddcd46bd7d65834';
      const proposalIdObjectId = new ObjectId(proposalIdString);
      
      const count1 = await db.collection('personnelservices').countDocuments({});
      console.log(`1. All PersonnelServices: ${count1} records`);
      
      const count2 = await db.collection('personnelservices').countDocuments({ proposalId: proposalIdString });
      console.log(`2. proposalId as String: ${count2} records`);
      
      const count3 = await db.collection('personnelservices').countDocuments({ proposalId: proposalIdObjectId });
      console.log(`3. proposalId as ObjectId: ${count3} records`);
      
      // Get all distinct proposalIds
      const distinctIds = await db.collection('personnelservices').distinct('proposalId');
      console.log(`\n4. Distinct proposalIds in database:\n`);
      distinctIds.forEach((id, i) => {
        console.log(`   ${i+1}. ${id} (type: ${typeof id})`);
      });
      
      // Get sum of all PersonnelServices regardless of proposal
      const allSum = await db.collection('personnelservices').aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]).toArray();
      
      if (allSum.length > 0) {
        console.log(`\n5. ALL PersonnelServices Total: ₱${allSum[0].total.toFixed(2)} (${allSum[0].count} records)`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
