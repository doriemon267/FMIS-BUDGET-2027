const mongoose = require('mongoose');
require('dotenv').config();

async function debugFullAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    console.log('🔍 Full assignment object debug...');

    const assignment = await HierarchicalUserAssignment.getUserPermissions('751754');

    console.log('👤 Full Assignment Object:');
    console.log(JSON.stringify(assignment, null, 2));

    console.log('\n🔍 Fallback checks:');
    console.log(`assignment.regions: ${JSON.stringify(assignment.regions)}`);
    console.log(`assignment.departments: ${JSON.stringify(assignment.departments)}`);
    console.log(`assignment.regions?.[0]?.regionName: ${assignment.regions?.[0]?.regionName}`);
    console.log(`assignment.departments?.[0]?.departmentName: ${assignment.departments?.[0]?.departmentName}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugFullAssignment();