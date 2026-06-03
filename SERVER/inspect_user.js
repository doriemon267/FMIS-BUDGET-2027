const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    const mongoUrl = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget';
    console.log('Connecting to:', mongoUrl);
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    const User = require('./models/User');
    const userDoc = await User.findOne({ userId: '100017' }).lean();
    console.log('User 100017 document:', JSON.stringify(userDoc, null, 2));

    const huaDoc = await mongoose.connection.db.collection('hierarchicaluserassignments').findOne({ userId: { $in: ['100017', 100017] } });
    console.log('HUA 100017 document:', JSON.stringify(huaDoc, null, 2));

    if (huaDoc && huaDoc.regionId) {
      const regionDoc = await mongoose.connection.db.collection('regions').findOne({ _id: huaDoc.regionId });
      console.log('Region document:', JSON.stringify(regionDoc, null, 2));
    }

    if (huaDoc && huaDoc.departmentId) {
      const deptDoc = await mongoose.connection.db.collection('departments').findOne({ _id: huaDoc.departmentId });
      console.log('Department document:', JSON.stringify(deptDoc, null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
