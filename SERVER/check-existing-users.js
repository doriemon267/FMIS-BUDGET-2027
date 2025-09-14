/**
 * Check existing users to find one that might work for testing
 */
const mongoose = require('mongoose');

async function checkExistingUsers() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get first 5 users to see structure
    const users = await db.collection('users').find({}).limit(5).toArray();
    
    console.log('\n👥 Sample Users:');
    users.forEach((user, i) => {
      console.log(`${i+1}. ID: ${user._id}`);
      console.log(`   Name: ${user.FirstName} ${user.LastName}`);
      console.log(`   Email: ${user.Email}`);
      console.log(`   Roles: ${user.Roles}`);
      console.log(`   Password: ${user.Password?.substring(0, 20)}...`);
      console.log('');
    });
    
    // Check if user 345220 (the one showing in logs) has assignment
    const divisionUser = await db.collection('users').findOne({ _id: 345220 });
    if (divisionUser) {
      console.log('\n👤 Division User (from logs):');
      console.log(`Name: ${divisionUser.FirstName} ${divisionUser.LastName}`);
      console.log(`Email: ${divisionUser.Email}`);
      
      // Check their assignment
      const assignment = await db.collection('hierarchicaluserassignments').findOne({
        userId: 345220
      });
      
      if (assignment) {
        console.log('\n📋 Division User Assignment:');
        console.log(`Level: ${assignment.assignmentLevel}`);
        console.log(`Region: ${assignment.regions?.[0]?.regionName || assignment.regionId?.Region || 'N/A'}`);
        console.log(`Department: ${assignment.departments?.[0]?.departmentName || assignment.departmentId?.Department || 'N/A'}`);
        console.log(`Division: ${assignment.divisions?.[0]?.divisionName || assignment.divisionName || 'N/A'}`);
      }
    }
    
    // Let me also create a simple user with known password for testing
    console.log('\n🔧 Creating a simple test user...');
    const testUser = {
      _id: 999999,
      FirstName: 'Test',
      LastName: 'Region',
      Email: 'testregion@test.com',
      Password: 'TestPass123!', // Plain text for now
      Roles: ['REGION_USER'],
      isActive: true
    };
    
    await db.collection('users').replaceOne(
      { _id: 999999 },
      testUser,
      { upsert: true }
    );
    
    // Create assignment for test user - pointing to CENTRAL OFFICE
    const testAssignment = {
      userId: 999999,
      userName: 'Test Region',
      email: 'testregion@test.com',
      assignmentLevel: 'REGION',
      regionId: new mongoose.Types.ObjectId('68be0fba37907a9f5551c935'),
      regions: [{
        regionId: new mongoose.Types.ObjectId('68be0fba37907a9f5551c935'),
        regionName: 'CENTRAL OFFICE'
      }],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('hierarchicaluserassignments').replaceOne(
      { userId: 999999 },
      testAssignment,
      { upsert: true }
    );
    
    console.log('✅ Test user and assignment created');
    console.log('Email: testregion@test.com');
    console.log('Password: TestPass123!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkExistingUsers();