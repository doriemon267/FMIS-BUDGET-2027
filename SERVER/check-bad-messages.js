const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);

    const Notification = require('./models/Notification');

    // Check for notifications without message field
    const noMessage = await Notification.find({
      $or: [
        { message: { $exists: false } },
        { message: null },
        { message: '' }
      ]
    }).limit(10).lean();

    console.log(`\n❌ Notifications WITHOUT message field: ${noMessage.length}`);
    
    if (noMessage.length > 0) {
      noMessage.forEach((n, i) => {
        console.log(`\n[${i + 1}]`);
        console.log(`  _id: ${n._id}`);
        console.log(`  title: ${n.title}`);
        console.log(`  message: ${n.message}`);
        console.log(`  relatedEntityId: ${n.relatedEntityId}`);
        console.log(`  metadata: ${JSON.stringify(n.metadata).substring(0, 100)}`);
      });
    }

    // Check for messages that are actually objects instead of strings
    const allNotifs = await Notification.find().lean();
    const badMessages = allNotifs.filter(n => {
      return typeof n.message === 'object' || (typeof n.message !== 'string' && n.message !== null && n.message !== undefined);
    });

    console.log(`\n❌ Notifications with non-string message field: ${badMessages.length}`);
    if (badMessages.length > 0) {
      badMessages.slice(0, 3).forEach((n, i) => {
        console.log(`\n[${i + 1}]`);
        console.log(`  message type: ${typeof n.message}`);
        console.log(`  message value: ${JSON.stringify(n.message)}`);
      });
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
