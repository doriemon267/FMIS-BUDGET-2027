const mongoose = require('mongoose');
require('dotenv').config();
const fixAllIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;
    const collection = db.collection('incomecategories');
    const indexes = await collection.indexes();
    );
    // Drop problematic unique indexes
    const indexesToDrop = ['name_1'];
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        } catch (error) {
        }
    }
    const newIndexes = await collection.indexes();
    );
    await mongoose.disconnect();
    } catch (error) {
    console.error('Error:', error);
  }
};
fixAllIndexes();