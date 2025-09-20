const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function checkUserWorkflowRoles() {
  try {
    // Use the same connection as the main app
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/fmis-budget-september');

    console.log('🔍 Checking user workflow roles...\n');

    // Find users with Department assignment level
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    const deptUsers = await HierarchicalUserAssignment.find({
      assignmentLevel: 'DEPARTMENT',
      isActive: true
    }).select('userId userName assignmentLevel workflowRoles rolePermissions').limit(5);

    console.log('👥 Department Level Users:');
    deptUsers.forEach((user, i) => {
      console.log(`${i + 1}. ${user.userName} (${user.userId})`);
      console.log(`   Assignment Level: ${user.assignmentLevel}`);
      console.log(`   Workflow Roles: ${JSON.stringify(user.workflowRoles)}`);
      console.log(`   Role Permissions: ${JSON.stringify(user.rolePermissions)}`);
      console.log(`   Has departmentConsolidator: ${user.workflowRoles.includes('departmentConsolidator')}`);
      console.log('   ---');
    });

    // Also check if there are any users with departmentConsolidator role
    const usersWithDeptConsolidator = await HierarchicalUserAssignment.find({
      workflowRoles: { $in: ['departmentConsolidator'] },
      isActive: true
    }).select('userId userName assignmentLevel workflowRoles').limit(5);

    console.log('\n🎯 Users with departmentConsolidator role:');
    usersWithDeptConsolidator.forEach((user, i) => {
      console.log(`${i + 1}. ${user.userName} (${user.userId})`);
      console.log(`   Assignment Level: ${user.assignmentLevel}`);
      console.log(`   Workflow Roles: ${JSON.stringify(user.workflowRoles)}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('💡 Make sure MongoDB is running and the connection string is correct');
  } finally {
    await mongoose.disconnect();
  }
}

checkUserWorkflowRoles();