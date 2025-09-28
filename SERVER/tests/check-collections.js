const mongoose = require('mongoose');
require('dotenv').config();

async function checkRegionDepartmentNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    // Check what the region and department collections look like
    const db = mongoose.connection.db;

    // Check if there are Region and Department collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📋 Available collections:');
    collectionNames.forEach(name => console.log(`  - ${name}`));

    // Try to find region and department by ObjectId
    const regionId = '68be0fba37907a9f5551c935';
    const deptId = '68be0fba37907a9f5551c93f';

    // Check if there's a regions collection
    if (collectionNames.includes('regions') || collectionNames.includes('regionmasters')) {
      const RegionModel = mongoose.model('Region', new mongoose.Schema({ Region: String }));
      const regionDoc = await RegionModel.findById(regionId);
      console.log(`\n🏢 Region ${regionId}: ${regionDoc?.Region || 'NOT FOUND'}`);
    }

    // Check if there's a departments collection
    if (collectionNames.includes('departments') || collectionNames.includes('departmentmasters')) {
      const DeptModel = mongoose.model('Department', new mongoose.Schema({ Department: String }));
      const deptDoc = await DeptModel.findById(deptId);
      console.log(`🏬 Department ${deptId}: ${deptDoc?.Department || 'NOT FOUND'}`);
    }

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRegionDepartmentNames();