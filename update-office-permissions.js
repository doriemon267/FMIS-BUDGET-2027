const mongoose = require('mongoose');

// Update existing OFFICE level users to have ApproveProposals permission
async function updateOfficeUsersPermissions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fmis-budget-september');

    console.log('🔄 Updating OFFICE level users permissions...\n');

    const HierarchicalUserAssignment = require('./SERVER/models/HierarchicalUserAssignment');

    // Find all OFFICE level users
    const officeUsers = await HierarchicalUserAssignment.find({
      assignmentLevel: 'OFFICE',
      isActive: true
    });

    console.log(`Found ${officeUsers.length} OFFICE level users`);

    for (const user of officeUsers) {
      if (!user.rolePermissions.ApproveProposals) {
        user.rolePermissions.ApproveProposals = true;
        await user.save();
        console.log(`✅ Updated ${user.userName} (${user.userId}) - ApproveProposals: true`);
      } else {
        console.log(`ℹ️  ${user.userName} (${user.userId}) already has ApproveProposals permission`);
      }
    }

    console.log('\n🎉 Update complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

updateOfficeUsersPermissions();