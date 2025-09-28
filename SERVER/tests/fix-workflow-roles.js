/**
 * Fix Missing Workflow Roles for Region Level Users
 * 
 * This script finds Region level users who don't have workflow roles assigned
 * and assigns them the appropriate roles.
 */

const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
const { assignWorkflowRoles } = require('./helpers/workflowRoleManager');

// Database connection
const DB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

async function connectToDatabase() {
  try {
    await mongoose.connect(DB_URL);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

async function fixMissingWorkflowRoles() {
  console.log('🔧 Searching for users with missing workflow roles...');
  
  try {
    // Find all active users who don't have workflow roles or have empty workflow roles
    const usersWithoutRoles = await HierarchicalUserAssignment.find({
      isActive: true,
      $or: [
        { workflowRoles: { $exists: false } },
        { workflowRoles: { $size: 0 } },
        { workflowRoles: null }
      ]
    }).populate('regionId', 'Region regionName')
      .populate('departmentId', 'Department departmentName');

    console.log(`📋 Found ${usersWithoutRoles.length} users without workflow roles`);

    let fixedCount = 0;
    let regionCount = 0;
    let departmentCount = 0;
    let divisionCount = 0;

    for (const user of usersWithoutRoles) {
      console.log(`\n🔄 Processing user: ${user.userName} (Level: ${user.assignmentLevel})`);
      
      try {
        const result = await assignWorkflowRoles(user.userId, user.assignmentLevel);
        
        if (result.success) {
          console.log(`   ✅ Assigned roles: ${result.workflowRoles.join(', ')}`);
          fixedCount++;
          
          // Count by level
          switch (user.assignmentLevel) {
            case 'REGION':
              regionCount++;
              break;
            case 'DEPARTMENT':
              departmentCount++;
              break;
            case 'DIVISION':
              divisionCount++;
              break;
          }
        } else {
          console.log(`   ❌ Failed to assign roles: ${result.message}`);
        }
      } catch (error) {
        console.log(`   ❌ Error processing user ${user.userName}: ${error.message}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total users processed: ${usersWithoutRoles.length}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    console.log(`   Region users fixed: ${regionCount}`);
    console.log(`   Department users fixed: ${departmentCount}`);
    console.log(`   Division users fixed: ${divisionCount}`);

    // Show current workflow role distribution
    console.log('\n📈 Current Workflow Role Distribution:');
    
    const roleDistribution = await HierarchicalUserAssignment.aggregate([
      { $match: { isActive: true, workflowRoles: { $exists: true, $ne: [] } } },
      { $unwind: '$workflowRoles' },
      { $group: { _id: '$workflowRoles', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    roleDistribution.forEach(role => {
      console.log(`   ${role._id}: ${role.count} users`);
    });

    // Show Region users specifically
    console.log('\n🌍 Region Level Users Status:');
    const regionUsers = await HierarchicalUserAssignment.find({
      isActive: true,
      assignmentLevel: 'REGION'
    }).populate('regionId', 'Region regionName');

    regionUsers.forEach(user => {
      const roles = user.workflowRoles || [];
      const region = user.regionId?.Region || user.regionId?.regionName || 'Unknown';
      console.log(`   ${user.userName} (${region}): ${roles.length > 0 ? roles.join(', ') : 'NO ROLES'}`);
    });

    if (fixedCount > 0) {
      console.log('\n🎉 Workflow roles have been successfully assigned!');
      console.log('   Region users should now be able to approve and finalize submissions.');
    }

  } catch (error) {
    console.error('❌ Error fixing workflow roles:', error);
  }
}

async function runFixScript() {
  console.log('🚀 Starting Workflow Role Fix Script');
  console.log('=' .repeat(50));
  
  await connectToDatabase();
  await fixMissingWorkflowRoles();
  
  console.log('\n✅ Script completed successfully!');
  await mongoose.connection.close();
  console.log('📤 Database connection closed');
}

// Run the script
if (require.main === module) {
  runFixScript().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixMissingWorkflowRoles };