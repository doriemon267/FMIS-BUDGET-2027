const mongoose = require('mongoose');
const DatabaseBackup = require('./models/DatabaseBackup');
const { runManualCleanup, getStorageStats, checkBackupHealth } = require('./utils/backupCleanup');
require('dotenv').config();
// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');
    } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};
// Test backup system functionality
const testBackupSystem = async () => {
  try {
    // Test 1: Create a test backup record
    const testBackup = new DatabaseBackup({
      name: 'test_backup_' + Date.now(),
      description: 'Test backup for system verification',
      type: 'manual',
      status: 'completed',
      size: 1024 * 1024, // 1MB
      filePath: '/test/path/backup.gz'
    });
    await testBackup.save();
    // Test 2: Retrieve backup history
    const backups = await DatabaseBackup.find({}).limit(5);
    // Test 3: Test cleanup utilities
    const storageStats = await getStorageStats();
    // Test 4: Test health check
    const healthResult = await checkBackupHealth();
    if (healthResult.success) {
      } else {
      }
    // Test 5: Test backup expiration
    const expiredBackup = new DatabaseBackup({
      name: 'expired_test_backup',
      description: 'Test expired backup',
      type: 'manual',
      status: 'completed',
      retentionDays: 1,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    });
    await expiredBackup.save();
    const isExpired = expiredBackup.isExpired();
    // Test 6: Virtual fields
    const backupWithVirtuals = await DatabaseBackup.findOne({}).limit(1);
    if (backupWithVirtuals) {
      }
    // Cleanup test records
    await DatabaseBackup.deleteMany({ 
      name: { $regex: /^(test_backup_|expired_test_backup)/ } 
    });
    } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    }
};
// Run the test
const runTest = async () => {
  await connectDB();
  await testBackupSystem();
};
runTest().catch(console.error);