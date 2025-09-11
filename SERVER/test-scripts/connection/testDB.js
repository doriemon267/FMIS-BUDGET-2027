// Test database connection
require('dotenv').config();
const mongoose = require('mongoose');
async function testDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    // // Test collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    collections.forEach(col => );
    // Test Chart of Accounts collection
    const ChartOfAccounts = mongoose.model('ChartOfAccounts', new mongoose.Schema({}, { strict: false }));
    const coaCount = await ChartOfAccounts.countDocuments();
    if (coaCount === 0) {
      }
    await mongoose.disconnect();
    } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}
testDB();