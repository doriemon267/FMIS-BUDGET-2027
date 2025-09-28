const mongoose = require('mongoose');
require('dotenv').config();

async function checkNewStructureAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const UserOrganizationalAssignment = require('./models/UserOrganizationalAssignment');

    console.log('🔍 Checking new structure assignment details...');

    const assignment = await UserOrganizationalAssignment.getUserPermissions('751754');

    console.log('👤 New Structure Assignment:');
    console.log(`Access Scope: ${assignment.accessScope}`);
    console.log(`User ID: ${assignment.userId}`);

    console.log('\n🔍 Available properties:');
    Object.keys(assignment).forEach(key => {
      if (key !== 'rolePermissions' && key !== 'restrictions') {
        console.log(`${key}: ${JSON.stringify(assignment[key])}`);
      }
    });

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkNewStructureAssignment();