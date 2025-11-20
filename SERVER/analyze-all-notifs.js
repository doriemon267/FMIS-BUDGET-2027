const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);

    const Notification = require('./models/Notification');

    // Get ALL notifications
    const allNotifs = await Notification.find()
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Total notifications in database: ${allNotifs.length}\n`);

    // Show sample of what's in DB
    console.log('Sample of 10 most recent:');
    allNotifs.slice(0, 10).forEach((n, i) => {
      const msg = String(n.message || '').substring(0, 60);
      console.log(`[${i + 1}] Message: "${msg}"`);
    });

    // Count by type
    const byType = {};
    allNotifs.forEach(n => {
      const type = n.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    console.log('\nNotifications by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Check unique recipients
    const recipients = new Set(allNotifs.map(n => n.recipientUserId));
    console.log(`\nUnique recipients: ${recipients.size}`);
    console.log('First 5 recipients:');
    Array.from(recipients).slice(0, 5).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r}`);
    });

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
