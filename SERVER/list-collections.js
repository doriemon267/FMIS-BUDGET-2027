/**
 * List all collections in the database
 */
const mongoose = require('mongoose');

async function listCollections() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    
    console.log('✓ Connected\n');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('Collections in database:');
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`  - ${col.name} (${count} documents)`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listCollections();
