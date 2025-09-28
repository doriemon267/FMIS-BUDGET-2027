const mongoose = require('mongoose');
require('dotenv').config();

async function testPopulate() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    console.log('🔍 Testing populate in getUserPermissions...');

    const assignment = await HierarchicalUserAssignment.getUserPermissions('751754');

    console.log('👤 Assignment object:');
    console.log(`assignmentLevel: ${assignment.assignmentLevel}`);
    console.log(`regionId: ${JSON.stringify(assignment.regionId)}`);
    console.log(`departmentId: ${JSON.stringify(assignment.departmentId)}`);

    console.log('\n🔍 Access tests:');
    console.log(`assignment.regionId?.Region: ${assignment.regionId?.Region}`);
    console.log(`assignment.departmentId?.Department: ${assignment.departmentId?.Department}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPopulate();