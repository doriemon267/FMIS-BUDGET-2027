require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Get all recent notifications
    const notifs = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    console.log('Total notifications found:', notifs.length);
    notifs.forEach((n, idx) => {
      console.log(`\n--- Notification ${idx + 1} ---`);
      console.log('ID:', n._id);
      console.log('Title:', n.title);
      console.log('Message:', n.message);
      console.log('Recipient:', n.recipientUserId);
      console.log('ProposalId:', n.metadata?.proposalId);
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
