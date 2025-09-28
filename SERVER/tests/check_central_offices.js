const mongoose = require('mongoose');
require('dotenv').config();

async function checkCentralOffices() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    const db = mongoose.connection.db;

    const deptNames = ['PUBLIC AFFAIRS AND STAFF INFORMATION', 'LEGAL SERVICES', 'INTERNAL AUDIT SERVICES'];
    const depts = await db.collection('departments').find({Department: {$in: deptNames}}).toArray();
    const mappings = await db.collection('departmentdivisionmappings').find({}).toArray();

    console.log('Central office departments:');
    depts.forEach(dept => {
      const deptMappings = mappings.filter(m => m.departmentId && m.departmentId.toString() === dept._id.toString());
      console.log('Department: ' + dept.Department + ', ID: ' + dept._id + ', Mappings: ' + deptMappings.length);
      if (deptMappings.length > 0) {
        deptMappings.forEach(mapping => console.log('  Region: ' + mapping.regionId));
      } else {
        console.log('  No mappings found');
      }
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkCentralOffices();