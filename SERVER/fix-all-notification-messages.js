const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    const mongoUri = 'mongodb://172.16.4.98:27017/fmis_budget';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // 1. Find and fix notifications with ID-like messages
    const idPattern = /^[a-f0-9]{24}$/i;
    const idMessages = await Notification.find({
      $or: [
        { message: { $regex: '^[a-f0-9]{24}$', $options: 'i' } },
        { message: { $regex: '^[0-9a-f]{8}-' } }, // UUIDs
      ]
    });
    
    console.log(`\n🔍 Found ${idMessages.length} notifications with ID-like messages`);
    
    if (idMessages.length > 0) {
      console.log('Fixing ID-like messages...');
      let fixed = 0;
      
      for (const notif of idMessages) {
        // Try to use title, metadata.proposalTitle, or a generic message
        const newMessage = notif.title || notif.metadata?.proposalTitle || 'Notification';
        await Notification.updateOne(
          { _id: notif._id },
          { message: newMessage }
        );
        fixed++;
        console.log(`  ✅ Fixed: "${notif.message}" → "${newMessage}"`);
      }
      
      console.log(`\n✅ Fixed ${fixed} notifications`);
    }
    
    // 2. Fix notifications with empty/null/undefined messages
    const emptyResult = await Notification.updateMany(
      {
        $or: [
          { message: { $exists: false } },
          { message: '' },
          { message: null }
        ]
      },
      [
        {
          $set: {
            message: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$title', ''] } }, 0] },
                '$title',
                'Notification'
              ]
            }
          }
        }
      ]
    );
    
    if (emptyResult.modifiedCount > 0) {
      console.log(`\n✅ Fixed ${emptyResult.modifiedCount} notifications with empty messages`);
    }
    
    // 3. Fix messages that are just whitespace or too short (likely corrupted)
    const tooShort = await Notification.find({
      message: { $exists: true },
      $expr: { $lt: [{ $strLenCP: '$message' }, 5] }
    });
    
    console.log(`\n🔍 Found ${tooShort.length} notifications with very short messages`);
    
    if (tooShort.length > 0) {
      let shortFixed = 0;
      for (const notif of tooShort) {
        if (notif.message && notif.message.trim()) continue; // Skip if it's valid
        
        const newMessage = notif.title || notif.metadata?.proposalTitle || 'Notification';
        await Notification.updateOne(
          { _id: notif._id },
          { message: newMessage }
        );
        shortFixed++;
        console.log(`  ✅ Fixed short message: "${notif.message}" → "${newMessage}"`);
      }
      
      console.log(`\n✅ Fixed ${shortFixed} short messages`);
    }
    
    // 4. Verify all notifications now have non-empty messages
    const problematic = await Notification.find({
      $or: [
        { message: { $exists: false } },
        { message: '' },
        { message: null }
      ]
    });
    
    console.log(`\n✅ Final check: ${problematic.length} notifications still have empty messages`);
    
    // 5. Show sample of fixed notifications
    const samples = await Notification.find({ status: 'UNREAD' })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    
    console.log('\n📋 Sample of recent UNREAD notifications:');
    samples.forEach((n, i) => {
      console.log(`  ${i+1}. "${n.title}"`);
      console.log(`     Message: "${n.message.substring(0, 60)}${n.message.length > 60 ? '...' : ''}"`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ All done!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e);
    process.exit(1);
  }
})();
