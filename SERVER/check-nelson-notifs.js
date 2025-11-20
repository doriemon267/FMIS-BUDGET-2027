require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Get all notifications for Nelson Eloso
    const notifs = await Notification.find({ 
      recipientUserId: { $regex: 'nelson.*eloso', $options: 'i' }
    }).limit(5).lean();
    
    console.log('Found notifications:', notifs.length);
    notifs.forEach((n, idx) => {
      console.log(`\n--- Notification ${idx + 1} ---`);
      console.log('ID:', n._id);
      console.log('Title:', n.title);
      console.log('Message:', n.message);
      console.log('Metadata:', JSON.stringify(n.metadata, null, 2));
      console.log('RecipientUserId:', n.recipientUserId);
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
