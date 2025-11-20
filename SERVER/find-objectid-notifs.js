const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const Notification = require('./models/Notification');

    // Find notifications with ObjectID-like messages
    console.log('🔍 Searching for notifications with ObjectID-pattern messages...\n');
    
    const allNotifs = await Notification.find()
      .lean();

    const objectIdNotifs = allNotifs.filter(n => {
      const msg = String(n.message || '').trim();
      return /^[a-f0-9]{24}$/i.test(msg);
    });

    if (objectIdNotifs.length === 0) {
      console.log('✅ No ObjectID-pattern messages found in database');
    } else {
      console.log(`❌ Found ${objectIdNotifs.length} notifications with ObjectID messages:\n`);
      objectIdNotifs.slice(0, 5).forEach((n, i) => {
        console.log(`[${i + 1}]`);
        console.log(`  ID: ${n._id}`);
        console.log(`  Message: ${n.message}`);
        console.log(`  RecipientUserId: ${n.recipientUserId}`);
        console.log(`  Title: ${n.title}`);
        console.log(`  CreatedAt: ${new Date(n.createdAt).toLocaleString()}`);
        console.log();
      });
    }

    console.log(`\nTotal notifications: ${allNotifs.length}`);
    console.log(`With ObjectID messages: ${objectIdNotifs.length}`);

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
