const mongoose = require('mongoose');
require('dotenv').config();
const checkIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;
    const collection = db.collection('incomecategories');
    const indexes = await collection.indexes();
    );
    // Drop the unique index on incomeCategoryName
    try {
      await collection.dropIndex('incomeCategoryName_1');
      } catch (error) {
      }
    const newIndexes = await collection.indexes();
    );
    await mongoose.disconnect();
    } catch (error) {
    console.error('Error:', error);
  }
};
checkIndexes();