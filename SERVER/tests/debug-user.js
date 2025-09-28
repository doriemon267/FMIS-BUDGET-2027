const mongoose = require('mongoose');
require('dotenv').config();

async function debugUserAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const UserAssignment = require('./models/HierarchicalUserAssignment');

    console.log('🔍 Debugging Department user assignment structure...\n');

    // Get Department user with full details
    const deptUser = await UserAssignment.findOne({
      userId: '751754',
      assignmentLevel: 'DEPARTMENT'
    });

    console.log('👤 Full Department User Object:');
    console.log(JSON.stringify(deptUser, null, 2));

    console.log('\n🔍 Key Properties:');
    console.log(`regionId: ${JSON.stringify(deptUser.regionId)}`);
    console.log(`departmentId: ${JSON.stringify(deptUser.departmentId)}`);
    console.log(`regionId?.Region: ${deptUser.regionId?.Region}`);
    console.log(`departmentId?.Department: ${deptUser.departmentId?.Department}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugUserAssignment();