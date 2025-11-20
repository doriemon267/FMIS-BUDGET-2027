require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Get notifications with specific titles from screenshot
    const notifs = await Notification.find({
      title: { $in: ['Proposal Submitted for Review', 'Proposal Returned to Reviewer'] }
    }).limit(10).lean();
    
    console.log('Found notifications:', notifs.length);
    notifs.forEach((n, idx) => {
      console.log(`\n--- Notification ${idx + 1} ---`);
      console.log('Title:', n.title);
      console.log('Message:', JSON.stringify(n.message));
      console.log('Message type:', typeof n.message);
      console.log('Message length:', n.message?.length);
      if (n.message && n.message.length === 24) {
        console.log('⚠️  Message looks like an ObjectID!');
      }
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
