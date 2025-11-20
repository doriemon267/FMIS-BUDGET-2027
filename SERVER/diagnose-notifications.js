/**
 * Diagnose Notification System
 * Check why notifications are not updating status
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== NOTIFICATION SYSTEM DIAGNOSIS ===\n');
    
    // 1. Check Notification model/collection
    const notifColl = db.collection('notifications');
    const allNotifications = await notifColl.find({}).toArray();
    
    console.log(`Total Notifications: ${allNotifications.length}\n`);
    
    // 2. Check specific notification from screenshot
    const targetId = '68be0fba37907a9f5551c936';
    console.log(`Looking for notifications with ID containing: ${targetId}\n`);
    
    const relevantNotifs = await notifColl.find({
      $or: [
        { userId: targetId },
        { relatedUserId: targetId },
        { recipientId: targetId },
        { proposalId: targetId },
        { _id: mongoose.Types.ObjectId.isValid(targetId) ? new mongoose.Types.ObjectId(targetId) : null }
      ]
    }).toArray();
    
    console.log(`Found ${relevantNotifs.length} notifications for that proposal\n`);
    
    // 3. Show sample notifications
    console.log('=== SAMPLE NOTIFICATIONS ===\n');
    
    allNotifications.slice(0, 5).forEach((notif, i) => {
      console.log(`[${i+1}] Notification Details:`);
      console.log(`  ID: ${notif._id}`);
      console.log(`  Type: ${notif.type}`);
      console.log(`  Title: ${notif.title}`);
      console.log(`  Message: ${notif.message}`);
      console.log(`  isRead: ${notif.isRead}`);
      console.log(`  read: ${notif.read}`);
      console.log(`  readAt: ${notif.readAt}`);
      console.log(`  status: ${notif.status}`);
      console.log(`  createdAt: ${notif.createdAt}`);
      console.log(`  updatedAt: ${notif.updatedAt}`);
      console.log('');
    });
    
    // 4. Check for duplicates
    console.log('=== CHECKING FOR DUPLICATES ===\n');
    
    const duplicateCheck = await notifColl.aggregate([
      {
        $group: {
          _id: { type: '$type', title: '$title', message: '$message' },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicateCheck.length > 0) {
      console.log(`Found ${duplicateCheck.length} duplicate notifications:\n`);
      duplicateCheck.forEach((dup, i) => {
        console.log(`[${i+1}] Type: ${dup._id.type}, Count: ${dup.count}`);
        console.log(`    IDs: ${dup.ids.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicate notifications found\n');
    }
    
    // 5. Check notification fields
    console.log('\n=== NOTIFICATION FIELDS CHECK ===\n');
    
    console.log('Sample notification structure:');
    if (allNotifications.length > 0) {
      const sample = allNotifications[0];
      console.log(JSON.stringify(sample, null, 2));
    }
    
    // 6. Check if there's a "Proposal Returned to Approver" type
    console.log('\n=== NOTIFICATION TYPES IN SYSTEM ===\n');
    
    const types = await notifColl.distinct('type');
    console.log(`Found ${types.length} notification types:`);
    types.forEach(t => console.log(`  - ${t}`));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
