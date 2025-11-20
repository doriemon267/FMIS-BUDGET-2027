require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 Checking actual notification messages in database...\n');

    // Get recent notifications
    const recent = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    console.log(`Found ${recent.length} recent notifications:\n`);

    recent.forEach((notif, idx) => {
      console.log(`[${idx + 1}] ID: ${notif._id}`);
      console.log(`    Title: ${notif.title}`);
      console.log(`    Message: ${notif.message}`);
      console.log(`    Message type: ${typeof notif.message}`);
      console.log(`    Message length: ${String(notif.message).length}`);
      
      // Check if message looks like ObjectID
      const msgStr = String(notif.message).trim();
      const isObjectID = /^[a-f0-9]{24}$/i.test(msgStr);
      console.log(`    Is ObjectID pattern: ${isObjectID}`);
      
      if (notif.metadata) {
        console.log(`    Metadata.proposalTitle: ${notif.metadata.proposalTitle}`);
        console.log(`    Metadata.action: ${notif.metadata.action}`);
      }
      console.log();
    });

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
