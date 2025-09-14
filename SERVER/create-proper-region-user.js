/**
 * Create a proper Region user and test API
 */
const mongoose = require('mongoose');

async function createRegionUser() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Create a Region user (using plain text password for testing)
    const hashedPassword = 'TestPass123!';
    
    const regionUser = {
      _id: 416461, // Use the same ID as in the assignment
      FirstName: 'Nelson',
      LastName: 'Eloso',
      Email: 'nelson.region@test.com',
      Password: hashedPassword,
      EmployeeId: 'REG001',
      Roles: ['REGION_USER'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert or update the user
    const result = await db.collection('users').replaceOne(
      { _id: 416461 },
      regionUser,
      { upsert: true }
    );
    
    console.log('✅ Region user created/updated:', result);
    
    // Verify the user exists
    const createdUser = await db.collection('users').findOne({ _id: 416461 });
    console.log('\n👤 Created User:');
    console.log(`Name: ${createdUser.FirstName} ${createdUser.LastName}`);
    console.log(`Email: ${createdUser.Email}`);
    
    // Verify the assignment
    const assignment = await db.collection('hierarchicaluserassignments').findOne({
      userId: 416461
    });
    console.log('\n📋 Assignment:');
    console.log(`Level: ${assignment.assignmentLevel}`);
    console.log(`Region: ${assignment.regions?.[0]?.regionName}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

createRegionUser();