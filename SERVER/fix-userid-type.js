/**
 * Fix the userId in the assignment to match the user ID type
 */
const mongoose = require('mongoose');

async function fixUserIdType() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check the user
    const user = await db.collection('users').findOne({ _id: 416461 });
    console.log('👤 User found:', user ? `${user.FirstName} ${user.LastName}` : 'Not found');
    
    // Update the assignment to use numeric userId to match
    const assignmentId = "68c618c141dceb37ad19feb3";
    
    const updateResult = await db.collection('hierarchicaluserassignments').updateOne(
      { _id: new mongoose.Types.ObjectId(assignmentId) },
      {
        $set: {
          userId: 416461, // Change from string to number
        }
      }
    );
    
    console.log('Assignment update result:', updateResult);
    
    // Verify
    const updatedAssignment = await db.collection('hierarchicaluserassignments').findOne({
      _id: new mongoose.Types.ObjectId(assignmentId)
    });
    
    console.log('\n✅ Updated Assignment:');
    console.log(`User ID: ${updatedAssignment.userId} (type: ${typeof updatedAssignment.userId})`);
    console.log(`Assignment Level: ${updatedAssignment.assignmentLevel}`);
    console.log(`Region: ${updatedAssignment.regions?.[0]?.regionName}`);
    
    // Test if user can be found now
    const userCheck = await db.collection('users').findOne({ _id: updatedAssignment.userId });
    console.log(`\n👤 User found with assignment userId: ${userCheck ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixUserIdType();