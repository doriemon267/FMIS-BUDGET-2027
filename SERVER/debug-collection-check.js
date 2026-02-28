require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    const db = mongoose.connection.db;
    
    console.log('📊 PROPOSAL COLLECTION RECORD COUNTS:');
    for (const collection of ['Proposal', 'proposals', 'NewProposalWorkflow', 'newproposalworkflows', 'draftproposals']) {
      const count = await db.collection(collection).countDocuments();
      console.log(`  ${collection}: ${count} records`);
    }
    
    // Check Proposal (capitalized)
    console.log('\n📋 PROPOSAL (Capitalized) - First 5 records:');
    const proposals = await db.collection('Proposal').find({}).limit(5).toArray();
    proposals.forEach((p, i) => {
      console.log(`  ${i+1}. ID: ${p._id}, Title: ${p.title || 'N/A'}, Projected Subsidy: ₱${p.projectedSubsidy || 0}`);
    });
    
    // Check proposals (lowercase)
    console.log('\n📋 proposals (lowercase) - First 5 records:');
    const props = await db.collection('proposals').find({}).limit(5).toArray();
    props.forEach((p, i) => {
      console.log(`  ${i+1}. ID: ${p._id}, Title: ${p.title || 'N/A'}, Projected Subsidy: ₱${p.projectedSubsidy || 0}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
