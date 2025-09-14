/**
 * Check user assignments and hierarchical access
 */
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
const User = require('./models/User');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    // Find Nelson Eloso's user record
    const nelson = await User.findOne({
      $or: [
        { FirstName: /nelson/i, LastName: /eloso/i },
        { Email: /nelson/i },
        { Username: /nelson/i }
      ]
    }).lean();
    
    if (nelson) {
      console.log('\n👤 Nelson Eloso User Info:');
      console.log({
        id: nelson._id,
        name: `${nelson.FirstName} ${nelson.LastName}`,
        email: nelson.Email,
        roles: nelson.Roles
      });
      
      // Find Nelson's hierarchical assignment
      const assignment = await HierarchicalUserAssignment.findOne({
        userId: nelson._id
      }).populate('regionId departmentId').lean();
      
      if (assignment) {
        console.log('\n🏢 Nelson\'s Hierarchical Assignment:');
        console.log({
          assignmentLevel: assignment.assignmentLevel,
          regionId: assignment.regionId,
          departmentId: assignment.departmentId,
          divisionName: assignment.divisionName,
          rolePermissions: assignment.rolePermissions
        });
      } else {
        console.log('\n❌ No hierarchical assignment found for Nelson');
      }
    } else {
      console.log('\n❌ Nelson Eloso user not found');
      
      // Show all users for reference
      const users = await User.find({}).select('FirstName LastName Email Roles').lean();
      console.log('\n📋 All users:');
      users.forEach((user, i) => {
        console.log(`${i+1}. ${user.FirstName} ${user.LastName} - ${user.Email} - ${user.Roles}`);
      });
    }
    
    // Show all assignments
    const allAssignments = await HierarchicalUserAssignment.find({})
      .populate('userId regionId departmentId')
      .lean();
    
    console.log('\n📋 All Hierarchical Assignments:');
    allAssignments.forEach((assignment, i) => {
      console.log(`${i+1}. User: ${assignment.userId?.FirstName} ${assignment.userId?.LastName}`);
      console.log(`   Level: ${assignment.assignmentLevel}`);
      console.log(`   Region: ${assignment.regionId?.Region || assignment.regionId?.regionName}`);
      console.log(`   Department: ${assignment.departmentId?.Department || assignment.departmentId?.departmentName}`);
      console.log(`   Division: ${assignment.divisionName}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();