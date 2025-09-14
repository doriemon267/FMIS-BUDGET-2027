/**
 * Check the Region user assignment details
 */
const mongoose = require('mongoose');

async function checkRegionUserDetails() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the Region user assignment
    const regionAssignment = await db.collection('hierarchicaluserassignments').findOne({
      assignmentLevel: 'REGION'
    });
    
    console.log('\n📋 Region User Assignment:');
    console.log(JSON.stringify(regionAssignment, null, 2));
    
    if (regionAssignment) {
      // Get the actual user
      const user = await db.collection('users').findOne({ _id: regionAssignment.userId });
      
      console.log('\n👤 User Details:');
      if (user) {
        console.log(`Name: ${user.FirstName} ${user.LastName}`);
        console.log(`Email: ${user.Email}`);
        console.log(`Employee ID: ${user.EmployeeId}`);
      } else {
        console.log('❌ User not found');
      }
      
      // Check if this user has the correct assignment structure
      console.log('\n🔍 Assignment Analysis:');
      console.log(`Assignment Level: ${regionAssignment.assignmentLevel}`);
      console.log(`Regions: ${JSON.stringify(regionAssignment.regions)}`);
      console.log(`Has proper regionId: ${regionAssignment.regions?.[0]?.regionId ? 'YES' : 'NO'}`);
      console.log(`Region Name: ${regionAssignment.regions?.[0]?.regionName || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkRegionUserDetails();