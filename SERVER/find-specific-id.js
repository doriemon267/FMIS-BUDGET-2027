const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';
const TARGET_ID = '68be0fba37907a9f5551c936';

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);

    const Notification = require('./models/Notification');

    console.log(`🔍 Searching for notification ID: ${TARGET_ID}\n`);

    // Try as string ID
    const notif = await Notification.findOne({
      $or: [
        { _id: TARGET_ID },
        { recipientUserId: TARGET_ID },
        { message: TARGET_ID }
      ]
    }).lean();

    if (notif) {
      console.log('✅ Found notification:');
      console.log(`  _id: ${notif._id}`);
      console.log(`  title: ${notif.title}`);
      console.log(`  message: ${notif.message}`);
      console.log(`  recipientUserId: ${notif.recipientUserId}`);
      console.log(`  createdAt: ${new Date(notif.createdAt).toLocaleString()}`);
    } else {
      // Try as ObjectId
      const objId = mongoose.Types.ObjectId.createFromHexString(TARGET_ID);
      const notif2 = await Notification.findOne({
        $or: [
          { _id: objId }
        ]
      }).lean();

      if (notif2) {
        console.log('✅ Found notification by ObjectId:');
        console.log(`  _id: ${notif2._id}`);
        console.log(`  title: ${notif2.title}`);
        console.log(`  message: ${notif2.message}`);
        console.log(`  recipientUserId: ${notif2.recipientUserId}`);
      } else {
        console.log('❌ Notification not found');
        console.log('\nSearching for recent notifications with this ID pattern...');
        const recent = await Notification.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        
        recent.forEach((n, i) => {
          console.log(`\n[${i + 1}] ID: ${n._id}`);
          console.log(`    Message: ${String(n.message).substring(0, 80)}`);
          console.log(`    RecipientUserId: ${n.recipientUserId}`);
        });
      }
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
