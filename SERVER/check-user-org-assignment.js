/**
 * Check UserOrganizationalAssignment for Region user
 */
const mongoose = require('mongoose');
const UserOrganizationalAssignment = require('./models/UserOrganizationalAssignment');

async function checkUserOrgAssignment() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const userId = 416461;
    
    console.log(`🔍 Checking UserOrganizationalAssignment for userId: ${userId}`);
    
    // Get user permissions from UserOrganizationalAssignment model
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    
    console.log('UserOrganizationalAssignment result:');
    if (assignment) {
      console.log('   Access Scope:', assignment.accessScope);
      console.log('   Assignment Level:', assignment.assignmentLevel);
      console.log('   Regions:', assignment.regions?.length || 0);
      console.log('   Departments:', assignment.departments?.length || 0);
      console.log('   Divisions:', assignment.divisions?.length || 0);
    } else {
      console.log('   No assignment found');
    }
    
    // Also check raw database records
    console.log('\n📊 Raw database records:');
    const db = mongoose.connection.db;
    
    // Check userorganizationalassignments collection
    const orgAssignments = await db.collection('userorganizationalassignments').find({ userId: { $in: [userId, String(userId)] } }).toArray();
    console.log(`UserOrganizationalAssignments: ${orgAssignments.length}`);
    orgAssignments.forEach((assignment, i) => {
      console.log(`   ${i+1}. Level: ${assignment.assignmentLevel}, Scope: ${assignment.accessScope}, Active: ${assignment.isActive}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkUserOrgAssignment();