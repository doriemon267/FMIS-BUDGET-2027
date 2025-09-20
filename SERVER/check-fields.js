const mongoose = require('mongoose');
require('dotenv').config();

async function checkPopulateFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const db = mongoose.connection.db;

    // Check region document structure
    const regionDoc = await db.collection('regions').findOne({ _id: new mongoose.Types.ObjectId('68be0fba37907a9f5551c935') });
    console.log('🏢 Region document:');
    console.log(JSON.stringify(regionDoc, null, 2));

    // Check department document structure
    const deptDoc = await db.collection('departments').findOne({ _id: new mongoose.Types.ObjectId('68be0fba37907a9f5551c93f') });
    console.log('\n🏬 Department document:');
    console.log(JSON.stringify(deptDoc, null, 2));

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPopulateFields();