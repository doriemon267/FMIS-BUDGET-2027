const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const Notification = require('./models/Notification');

    // Get ALL notifications (not just recent) to check for ANY ObjectID messages
    const recent = await Notification.find()
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${recent.length} recent notifications:\n`);

    let hasObjectIdMessages = 0;

    recent.forEach((notif, idx) => {
      const msg = String(notif.message || 'undefined').trim();
      const msgLen = msg.length;
      const isObjectId = /^[a-f0-9]{24}$/i.test(msg);

      console.log(`[${idx + 1}] ${notif.title}`);
      console.log(`    Message: "${msg.substring(0, 80)}${msg.length > 80 ? '...' : ''}"`);
      console.log(`    Length: ${msgLen}, Is ObjectID: ${isObjectId}`);
      console.log(`    ProposalTitle: ${notif.metadata?.proposalTitle}`);
      console.log();

      if (isObjectId) hasObjectIdMessages++;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`❌ ObjectID-pattern messages: ${hasObjectIdMessages}`);
    console.log(`✅ Proper messages: ${recent.length - hasObjectIdMessages}`);

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
