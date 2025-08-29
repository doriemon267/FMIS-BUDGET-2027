const mongoose = require('mongoose');
require('dotenv').config();

const fixAllIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    const db = mongoose.connection.db;
    const collection = db.collection('incomecategories');
    
    console.log('Current indexes on incomecategories collection:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // Drop problematic unique indexes
    const indexesToDrop = ['name_1'];
    
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Successfully dropped ${indexName} index`);
      } catch (error) {
        console.log(`⚠️ Error dropping ${indexName} index:`, error.message);
      }
    }
    
    console.log('\nIndexes after cleanup:');
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
};

fixAllIndexes();
