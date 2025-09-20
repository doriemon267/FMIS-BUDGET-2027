const mongoose = require('mongoose');
require('dotenv').config();

async function checkDepartmentUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    // Check if there's a HierarchicalUserAssignment model
    let UserAssignment;
    try {
      UserAssignment = require('./models/HierarchicalUserAssignment');
    } catch (e) {
      console.log('❌ HierarchicalUserAssignment model not found');
      return;
    }

    console.log('🔍 Checking Department user assignments...\n');

    // Find users with DEPARTMENT assignment level
    const deptUsers = await UserAssignment.find({
      assignmentLevel: 'DEPARTMENT'
    }).select('userId assignmentLevel regionId departmentId divisionName').limit(5);

    console.log('👤 Department level users:');
    deptUsers.forEach((user, i) => {
      console.log(`${i + 1}. User ID: ${user.userId}`);
      console.log(`   Assignment Level: ${user.assignmentLevel}`);
      console.log(`   Region: ${user.regionId?.Region || 'N/A'}`);
      console.log(`   Department: ${user.departmentId?.Department || 'N/A'}`);
      console.log('   ---');
    });

    if (deptUsers.length === 0) {
      console.log('⚠️  No Department level users found in HierarchicalUserAssignment');
    }

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDepartmentUser();