/**
 * Fix Nelson Eloso's assignment level from NONE to REGION
 */
const mongoose = require('mongoose');

async function fixRegionUserAssignmentLevel() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Check current assignment
    const current = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    console.log('📋 Current assignment for Nelson Eloso (416461):');
    console.log('   Assignment Level:', current.assignmentLevel);
    console.log('   Region:', current.regionId);
    console.log('   Department:', current.departmentId);
    console.log('   Division:', current.divisionName);
    
    // Update assignment level to REGION
    const result = await db.collection('hierarchicaluserassignments').updateOne(
      { userId: 416461 },
      { 
        $set: { 
          assignmentLevel: 'REGION',
          updatedAt: new Date()
        } 
      }
    );
    
    console.log('\n🔧 Update result:', result.modifiedCount > 0 ? 'SUCCESS' : 'NO CHANGES');
    
    // Verify the update
    const updated = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    console.log('\n✅ Updated assignment for Nelson Eloso (416461):');
    console.log('   Assignment Level:', updated.assignmentLevel);
    console.log('   Region:', updated.regionId);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixRegionUserAssignmentLevel();