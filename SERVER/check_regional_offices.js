const mongoose = require('mongoose');
require('dotenv').config();

async function checkRegionalOffices() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    const db = mongoose.connection.db;

    const depts = await db.collection('departments').find({Department: 'REGIONAL OFFICE'}).toArray();
    const mappings = await db.collection('departmentdivisionmappings').find({}).toArray();

    console.log('REGIONAL OFFICE departments:');
    depts.forEach(dept => {
      const deptMappings = mappings.filter(m => m.departmentId && m.departmentId.toString() === dept._id.toString());
      console.log('Department: ' + dept.Department + ', ID: ' + dept._id + ', Mappings: ' + deptMappings.length);
      deptMappings.forEach(mapping => console.log('  Region: ' + mapping.regionId));
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkRegionalOffices();