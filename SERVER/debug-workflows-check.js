require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    console.log('📋 newproposalworkflows (lowercase):');
    const workflows = await db.collection('newproposalworkflows').find({}).toArray();
    workflows.forEach((w, i) => {
      console.log(`\n${i+1}. ID: ${w._id}`);
      console.log(`   Title: ${w.title || 'N/A'}`);
      console.log(`   Projected Subsidy: ₱${w.projectedSubsidy || 0}`);
      console.log(`   Projected Corporate Income: ₱${w.projectedCorporateIncome || 0}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
