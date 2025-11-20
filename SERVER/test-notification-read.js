/**
 * Test: Try to mark a notification as read
 * Simulate what the frontend should be doing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('\n=== TESTING NOTIFICATION READ FUNCTIONALITY ===\n');
    
    // 1. Get an UNREAD notification
    const unreadNotif = await Notification.findOne({ status: 'UNREAD' }).lean();
    
    if (!unreadNotif) {
      console.log('❌ No UNREAD notifications found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`Found UNREAD notification: ${unreadNotif._id}`);
    console.log(`  Title: ${unreadNotif.title}`);
    console.log(`  Status: ${unreadNotif.status}`);
    console.log(`  readAt: ${unreadNotif.readAt}`);
    
    // 2. Try to mark it as read using updateMany (like the API does)
    console.log('\nAttempting to mark as READ...');
    
    const result = await Notification.updateMany(
      { _id: unreadNotif._id },
      { 
        $set: { 
          status: 'READ', 
          readAt: new Date() 
        } 
      }
    );
    
    console.log(`\nUpdate Result:`);
    console.log(`  Matched: ${result.matchedCount}`);
    console.log(`  Modified: ${result.modifiedCount}`);
    
    // 3. Verify it was updated
    console.log('\nVerifying update...');
    
    const updated = await Notification.findById(unreadNotif._id).lean();
    
    console.log(`After Update:`);
    console.log(`  ID: ${updated._id}`);
    console.log(`  Status: ${updated.status} ${updated.status === 'READ' ? '✅' : '❌'}`);
    console.log(`  readAt: ${updated.readAt} ${updated.readAt ? '✅' : '❌'}`);
    console.log(`  updatedAt: ${updated.updatedAt}`);
    
    // 4. Get all notifications and show status
    console.log('\n\n=== ALL NOTIFICATIONS STATUS ===\n');
    
    const allNotifs = await Notification.find({}).lean();
    
    const unreadCount = allNotifs.filter(n => n.status === 'UNREAD').length;
    const readCount = allNotifs.filter(n => n.status === 'READ').length;
    
    console.log(`Total Notifications: ${allNotifs.length}`);
    console.log(`  - UNREAD: ${unreadCount}`);
    console.log(`  - READ: ${readCount}`);
    
    console.log('\nDetailed List:');
    allNotifs.forEach((n, i) => {
      console.log(`[${i+1}] Status: ${n.status}, Title: ${n.title}, readAt: ${n.readAt ? '✅' : '❌'}`);
    });
    
    // 5. Check if there's an issue with the frontend
    console.log('\n\n=== POTENTIAL ISSUES ===\n');
    
    if (unreadCount > 0) {
      console.log(`⚠️  There are still ${unreadCount} UNREAD notifications`);
      console.log('   - API endpoint working but frontend might not be calling it');
      console.log('   - Or frontend is calling it but not showing the result');
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
