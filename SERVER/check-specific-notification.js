require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Search for notifications with that specific ID
    const notifs = await Notification.find({ 
      $or: [
        { message: '68be0fba37907a9f5551c936' },
        { 'metadata.proposalId': '68be0fba37907a9f5551c936' },
        { _id: '68be0fba37907a9f5551c936' }
      ]
    }).limit(5).lean();
    
    console.log('Found matching notifications:', notifs.length);
    notifs.forEach((n, idx) => {
      console.log(`\n--- Notification ${idx + 1} ---`);
      console.log('ID:', n._id);
      console.log('Title:', n.title);
      console.log('Message:', n.message);
      console.log('Metadata:', JSON.stringify(n.metadata, null, 2));
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
