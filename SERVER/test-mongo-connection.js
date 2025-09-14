/**
 * Test direct MongoDB connection
 */
const mongoose = require('mongoose');

async function testMongoConnection() {
  try {
    console.log('🔄 Testing MongoDB connection to 172.16.4.98:27017...');
    
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget', {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    
    console.log('✅ Connected to MongoDB successfully!');
    
    // Test a simple query
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections in database`);
    
    // Test accessing hierarchical assignments
    const assignmentsCount = await db.collection('hierarchicaluserassignments').countDocuments();
    console.log(`👥 Found ${assignmentsCount} hierarchical assignments`);
    
    // Test region user assignment
    const regionUser = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    if (regionUser) {
      console.log('👤 Region user found:');
      console.log(`   Name: ${regionUser.userName}`);
      console.log(`   Level: ${regionUser.assignmentLevel}`);
      console.log(`   Can Delete: ${regionUser.rolePermissions?.canDeleteProposals}`);
    } else {
      console.log('❌ Region user not found');
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Code:', error.code);
    if (error.cause) {
      console.error('   Cause:', error.cause.message);
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

testMongoConnection();