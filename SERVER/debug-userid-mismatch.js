/**
 * Debug the userId mismatch issue for Region user assignment
 */
const mongoose = require('mongoose');

async function debugUserIdMismatch() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Check what's actually in the hierarchical assignments collection
    const assignments = await db.collection('hierarchicaluserassignments').find({}).toArray();
    
    console.log(`📊 Total hierarchical assignments: ${assignments.length}`);
    assignments.forEach((assignment, i) => {
      console.log(`\n${i+1}. User ID: ${assignment.userId} (type: ${typeof assignment.userId})`);
      console.log(`   Name: ${assignment.userName}`);
      console.log(`   Level: ${assignment.assignmentLevel}`);
      console.log(`   Active: ${assignment.isActive}`);
    });
    
    // Test the getUserPermissions method with different userId formats
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
    
    console.log('\n🧪 Testing getUserPermissions with different userId formats:');
    
    // Test with number
    console.log('\n1. Testing with number 416461...');
    const resultNum = await HierarchicalUserAssignment.getUserPermissions(416461);
    console.log(`Result: ${resultNum ? 'FOUND' : 'NOT FOUND'}`);
    if (resultNum) {
      console.log(`   Assignment Level: ${resultNum.assignmentLevel}`);
    }
    
    // Test with string
    console.log('\n2. Testing with string "416461"...');
    const resultStr = await HierarchicalUserAssignment.getUserPermissions("416461");
    console.log(`Result: ${resultStr ? 'FOUND' : 'NOT FOUND'}`);
    if (resultStr) {
      console.log(`   Assignment Level: ${resultStr.assignmentLevel}`);
    }
    
    // Let's also test the middleware directly
    console.log('\n🔧 Testing middleware logic:');
    
    // Simulate what happens in the middleware
    const userId = 416461; // This is what comes from JWT
    const assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
    
    if (!assignment) {
      console.log('❌ getUserPermissions returned null - this is the issue!');
      
      // Debug: try to find why it's null
      console.log('\n🔍 Debugging why getUserPermissions is null:');
      
      // Check raw query
      const rawResult = await db.collection('hierarchicaluserassignments').findOne({ 
        userId: userId, 
        isActive: true 
      });
      console.log(`Raw query with userId=${userId}:`, rawResult ? 'FOUND' : 'NOT FOUND');
      
      const rawResult2 = await db.collection('hierarchicaluserassignments').findOne({ 
        userId: String(userId), 
        isActive: true 
      });
      console.log(`Raw query with userId="${userId}":`, rawResult2 ? 'FOUND' : 'NOT FOUND');
      
      // Check what userId values exist
      const allUserIds = await db.collection('hierarchicaluserassignments').distinct('userId');
      console.log('\nAll userId values in database:', allUserIds.map(id => `${id} (${typeof id})`));
      
    } else {
      console.log('✅ getUserPermissions found assignment!');
      console.log(`   Level: ${assignment.assignmentLevel}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

debugUserIdMismatch();