/**
 * Check and fix Region user rolePermissions for delete operations
 */
const mongoose = require('mongoose');

async function fixRegionDeletePermissions() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Check current rolePermissions for Region user
    const current = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    console.log('📋 Current rolePermissions for Nelson Eloso (416461):');
    console.log(JSON.stringify(current.rolePermissions, null, 2));
    
    // Update rolePermissions to allow delete operations for Region users
    const result = await db.collection('hierarchicaluserassignments').updateOne(
      { userId: 416461 },
      { 
        $set: { 
          'rolePermissions.canDeleteProposals': true,
          'rolePermissions.canEditAllProposals': true,
          'rolePermissions.canCreateProposals': true,
          'rolePermissions.canApproveProposals': true,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log('\n🔧 Update result:', result.modifiedCount > 0 ? 'SUCCESS' : 'NO CHANGES');
    
    // Verify the update
    const updated = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    console.log('\n✅ Updated rolePermissions for Nelson Eloso (416461):');
    console.log(JSON.stringify(updated.rolePermissions, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixRegionDeletePermissions();