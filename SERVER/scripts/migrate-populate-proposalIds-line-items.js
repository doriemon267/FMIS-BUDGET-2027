require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection using MONGODB_BUDGET_URL only
const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

if (!MONGODB_BUDGET_URL) {
  console.error('❌ Error: MONGODB_BUDGET_URL not found in .env file');
  process.exit(1);
}

console.log(`🔗 Connecting to MongoDB Budget Database...`);
console.log(`📍 URL: ${MONGODB_BUDGET_URL}`);

mongoose.connect(MONGODB_BUDGET_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB Budget Database');
  runMigration();
})
.catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

async function runMigration() {
  const db = mongoose.connection.db;
  
  try {
    console.log('\n📋 Starting Migration: Populate proposalId in Line Items\n');

    // Get all proposals first
    const proposalsCollection = db.collection('proposals');
    const proposals = await proposalsCollection.find({}).toArray();
    
    console.log(`📊 Found ${proposals.length} proposals in database\n`);

    if (proposals.length === 0) {
      console.log('⚠️  No proposals found. Nothing to migrate.');
      await mongoose.disconnect();
      return;
    }

    // Create a map of proposals by their key attributes
    const proposalMap = new Map();
    proposals.forEach(proposal => {
      const key = `${proposal.fiscalYear}|${proposal.budgetType}|${proposal.processBy}|${proposal.region}`;
      proposalMap.set(key, proposal._id);
    });

    // Collections to update
    const collectionsToUpdate = [
      { name: 'personnelservices', displayName: 'Personnel Services' },
      { name: 'income', displayName: 'Income' },
      { name: 'mooe', displayName: 'MOOE' },
      { name: 'capitaloutlay', displayName: 'Capital Outlay' }
    ];

    let totalUpdated = 0;

    // Update each collection
    for (const collectionInfo of collectionsToUpdate) {
      console.log(`\n🔄 Processing ${collectionInfo.displayName}...`);
      
      const collection = db.collection(collectionInfo.name);
      const items = await collection.find({}).toArray();
      
      console.log(`   Found: ${items.length} records`);

      let matched = 0;
      let updated = 0;

      for (const item of items) {
        // Skip if already has proposalId
        if (item.proposalId) {
          continue;
        }

        // Try to find matching proposal
        const key = `${item.fiscalYear}|${item.budgetType}|${item.processBy}|${item.region}`;
        const proposalId = proposalMap.get(key);

        if (proposalId) {
          matched++;
          
          // Update the record
          const result = await collection.updateOne(
            { _id: item._id },
            { $set: { proposalId: proposalId } }
          );

          if (result.modifiedCount > 0) {
            updated++;
          }
        }
      }

      console.log(`   ✅ Matched: ${matched} records`);
      console.log(`   ✅ Updated: ${updated} records`);
      totalUpdated += updated;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ MIGRATION COMPLETED SUCCESSFULLY`);
    console.log(`📊 Total Records Updated: ${totalUpdated}`);
    console.log(`${'='.repeat(50)}\n`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}