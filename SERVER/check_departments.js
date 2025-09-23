const mongoose = require('mongoose');
require('dotenv').config();

async function checkDepartments() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    const db = mongoose.connection.db;

    const deptNames = ['HEAD OFFICE', 'DIVISION I', 'DIVISION II', 'DIVISION III', 'DIVISION IV'];
    const depts = await db.collection('departments').find({Department: {$in: deptNames}}).toArray();
    const mappings = await db.collection('departmentdivisionmappings').find({}).toArray();

    console.log('Departments to check:');
    depts.forEach(dept => {
      const deptMappings = mappings.filter(m => m.departmentId && m.departmentId.toString() === dept._id.toString());
      console.log('Department: ' + dept.Department + ', ID: ' + dept._id + ', Mappings: ' + deptMappings.length);
      if (deptMappings.length > 1) {
        console.log('  Multiple regions - should be split');
      } else if (deptMappings.length === 1) {
        console.log('  Single region mapping');
      } else {
        console.log('  No mappings found');
      }
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkDepartments();