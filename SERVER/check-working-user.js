/**
 * Check the working Division user to understand the correct JWT format
 */
const mongoose = require('mongoose');

async function checkWorkingUser() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the Division user that's working (from server logs)
    const workingUser = await db.collection('users').findOne({ _id: 345220 });
    
    if (workingUser) {
      console.log('\n👤 Working Division User (345220):');
      console.log(`Name: ${workingUser.FirstName} ${workingUser.LastName}`);
      console.log(`Email: ${workingUser.Email}`);
      console.log(`Roles: ${JSON.stringify(workingUser.Roles)}`);
      console.log(`Employee ID: ${workingUser.EmployeeId}`);
      
      // Check their assignment
      const assignment = await db.collection('hierarchicaluserassignments').findOne({
        userId: 345220
      });
      
      if (assignment) {
        console.log('\n📋 Working User Assignment:');
        console.log(`Assignment Level: ${assignment.assignmentLevel}`);
        console.log(`Region: ${assignment.regions?.[0]?.regionName || 'N/A'}`);
        console.log(`Department: ${assignment.departments?.[0]?.departmentName || 'N/A'}`);
        console.log(`Division: ${assignment.divisions?.[0]?.divisionName || 'N/A'}`);
      } else {
        console.log('\n❌ No assignment found for working user');
      }
    } else {
      console.log('\n❌ Working user not found');
    }
    
    // Now let's compare with our Region user
    const regionUser = await db.collection('users').findOne({ _id: 416461 });
    
    if (regionUser) {
      console.log('\n\n👤 Our Region User (416461):');
      console.log(`Name: ${regionUser.FirstName} ${regionUser.LastName}`);
      console.log(`Email: ${regionUser.Email}`);
      console.log(`Roles: ${JSON.stringify(regionUser.Roles)}`);
      console.log(`Employee ID: ${regionUser.EmployeeId}`);
      
      // Check assignment
      const regionAssignment = await db.collection('hierarchicaluserassignments').findOne({
        userId: 416461
      });
      
      if (regionAssignment) {
        console.log('\n📋 Region User Assignment:');
        console.log(`Assignment Level: ${regionAssignment.assignmentLevel}`);
        console.log(`Region: ${regionAssignment.regions?.[0]?.regionName || 'N/A'}`);
      }
    }
    
    // Let me also check if there are any other patterns in user roles
    console.log('\n\n🔍 Checking role patterns...');
    const allUsers = await db.collection('users').find({}).limit(5).toArray();
    
    allUsers.forEach((user, i) => {
      console.log(`${i+1}. ID: ${user._id}, Roles: ${JSON.stringify(user.Roles)}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkWorkingUser();