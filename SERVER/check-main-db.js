require('dotenv').config();
const mongoose = require('mongoose');

async function checkMainDB() {
  try {
    const MONGODB_MAIN_URL = process.env.MONGODB_MAIN_URL || 'mongodb://127.0.0.1:27017/fmis_main';
    console.log('Connecting to:', MONGODB_MAIN_URL);
    
    await mongoose.connect(MONGODB_MAIN_URL);
    console.log('✅ Connected\n');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Collections in fmis_main:');
    collections.forEach(col => console.log('  -', col.name));
    
    // Check users collection
    if (collections.some(c => c.name === 'users')) {
      console.log('\n📊 Users collection stats:');
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const count = await User.countDocuments();
      console.log('  Total users:', count);
      
      if (count > 0) {
        const sample = await User.findOne();
        console.log('\n  Sample user fields:');
        console.log('  ', Object.keys(sample.toObject()));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkMainDB();
