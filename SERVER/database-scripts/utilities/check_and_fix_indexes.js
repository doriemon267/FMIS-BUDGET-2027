const mongoose = require('mongoose');
require('dotenv').config();

const checkIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    const db = mongoose.connection.db;
    const collection = db.collection('incomecategories');
    
    console.log('Current indexes on incomecategories collection:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // Drop the unique index on incomeCategoryName
    try {
      await collection.dropIndex('incomeCategoryName_1');
      console.log('✅ Successfully dropped incomeCategoryName_1 index');
    } catch (error) {
      console.log('⚠️ Error dropping index:', error.message);
    }
    
    console.log('\nIndexes after dropping:');
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
};

checkIndexes();
