// Test MongoDB connection
require('dotenv').config();
const mongoose = require('mongoose');
async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    // // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    );
    await mongoose.disconnect();
    } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
  }
}
testConnection();