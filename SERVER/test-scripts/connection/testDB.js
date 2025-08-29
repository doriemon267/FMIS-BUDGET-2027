// Test database connection
require('dotenv').config();
const mongoose = require('mongoose');

async function testDB() {
  try {
    console.log('Testing database connection...');
    console.log('MongoDB URL:', process.env.MONGODB_URL);
    
    await mongoose.connect(process.env.MONGODB_URL);
    // console.log('✅ Connected to MongoDB successfully!');
    
    // Test collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Collections found:', collections.length);
    collections.forEach(col => console.log('  -', col.name));
    
    // Test Chart of Accounts collection
    const ChartOfAccounts = mongoose.model('ChartOfAccounts', new mongoose.Schema({}, { strict: false }));
    const coaCount = await ChartOfAccounts.countDocuments();
    console.log('📋 Chart of Accounts records:', coaCount);
    
    if (coaCount === 0) {
      console.log('⚠️ No Chart of Accounts found - this is the MOOE issue!');
    }
    
    await mongoose.disconnect();
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDB();
