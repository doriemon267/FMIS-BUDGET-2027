const mongoose = require('mongoose');
require('dotenv').config();

async function checkStructureType() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
    const UserOrganizationalAssignment = require('./models/UserOrganizationalAssignment');

    console.log('🔍 Checking which structure type is used...');

    const userId = '751754';

    // Check new structure first
    let assignment = null;
    let isNewStructure = false;

    try {
      assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
      if (assignment) {
        isNewStructure = true;
        console.log('✅ NEW STRUCTURE detected');
        console.log(`Access Scope: ${assignment.accessScope}`);
      }
    } catch (error) {
      console.log('❌ New structure not available:', error.message);
    }

    // Check old structure if new failed
    if (!assignment) {
      try {
        assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
        isNewStructure = false;
        console.log('✅ OLD STRUCTURE detected');
        console.log(`Assignment Level: ${assignment.assignmentLevel}`);
      } catch (error) {
        console.log('❌ Old structure also failed:', error.message);
      }
    }

    console.log(`\n🎯 Final result: isNewStructure = ${isNewStructure}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStructureType();