require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Get notifications for Andrie Barrameda
    const notifs = await Notification.find({
      recipientUserId: { $regex: 'andrie', $options: 'i' }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
    
    console.log('Found notifications for Andrie:', notifs.length);
    
    notifs.forEach((n, idx) => {
      console.log(`\n--- Notification ${idx + 1} ---`);
      console.log('_id:', n._id);
      console.log('title:', n.title);
      console.log('message:', n.message);
      console.log('Full notification object:', JSON.stringify(n, null, 2));
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
