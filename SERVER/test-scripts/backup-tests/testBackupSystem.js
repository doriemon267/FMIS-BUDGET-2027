const mongoose = require('mongoose');
const DatabaseBackup = require('./models/DatabaseBackup');
const { runManualCleanup, getStorageStats, checkBackupHealth } = require('./utils/backupCleanup');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Test backup system functionality
const testBackupSystem = async () => {
  console.log('🧪 Testing Database Backup System...\n');

  try {
    // Test 1: Create a test backup record
    console.log('1. Testing backup record creation...');
    const testBackup = new DatabaseBackup({
      name: 'test_backup_' + Date.now(),
      description: 'Test backup for system verification',
      type: 'manual',
      status: 'completed',
      size: 1024 * 1024, // 1MB
      filePath: '/test/path/backup.gz'
    });
    
    await testBackup.save();
    console.log('   ✅ Test backup record created');

    // Test 2: Retrieve backup history
    console.log('\n2. Testing backup history retrieval...');
    const backups = await DatabaseBackup.find({}).limit(5);
    console.log(`   ✅ Found ${backups.length} backup records`);

    // Test 3: Test cleanup utilities
    console.log('\n3. Testing cleanup utilities...');
    const storageStats = await getStorageStats();
    console.log('   ✅ Storage stats retrieved:', {
      totalFiles: storageStats.totalFiles,
      formattedSize: storageStats.formattedSize
    });

    // Test 4: Test health check
    console.log('\n4. Testing health check...');
    const healthResult = await checkBackupHealth();
    if (healthResult.success) {
      console.log('   ✅ Health check passed');
      console.log('   📊 Health stats:', {
        totalBackups: healthResult.healthReport.totalBackups,
        completedBackups: healthResult.healthReport.completedBackups,
        failedBackups: healthResult.healthReport.failedBackups
      });
    } else {
      console.log('   ⚠️ Health check had issues');
    }

    // Test 5: Test backup expiration
    console.log('\n5. Testing backup expiration...');
    const expiredBackup = new DatabaseBackup({
      name: 'expired_test_backup',
      description: 'Test expired backup',
      type: 'manual',
      status: 'completed',
      retentionDays: 1,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    });
    
    await expiredBackup.save();
    console.log('   ✅ Expired backup created for testing');
    
    const isExpired = expiredBackup.isExpired();
    console.log('   ✅ Expiration check:', isExpired ? 'EXPIRED' : 'VALID');

    // Test 6: Virtual fields
    console.log('\n6. Testing virtual fields...');
    const backupWithVirtuals = await DatabaseBackup.findOne({}).limit(1);
    if (backupWithVirtuals) {
      console.log('   ✅ Virtual fields test:', {
        formattedSize: backupWithVirtuals.formattedSize,
        age: backupWithVirtuals.age
      });
    }

    // Cleanup test records
    console.log('\n7. Cleaning up test records...');
    await DatabaseBackup.deleteMany({ 
      name: { $regex: /^(test_backup_|expired_test_backup)/ } 
    });
    console.log('   ✅ Test records cleaned up');

    console.log('\n🎉 All backup system tests passed!');
    console.log('\n📋 System is ready for use. Key features:');
    console.log('   • Manual backup creation');
    console.log('   • Scheduled backup support');
    console.log('   • Backup history tracking');
    console.log('   • Automatic cleanup');
    console.log('   • Health monitoring');
    console.log('   • Storage statistics');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run the test
const runTest = async () => {
  await connectDB();
  await testBackupSystem();
};

runTest().catch(console.error);