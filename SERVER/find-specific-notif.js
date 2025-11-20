require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Find the specific notification
    const notifs = await Notification.find({
      $or: [
        { _id: new mongoose.Types.ObjectId('68be0fba37907a9f5551c936') },
        { message: '68be0fba37907a9f5551c936' },
        { 'metadata.proposalId': '68be0fba37907a9f5551c936' },
        { 'metadata.proposalId': new mongoose.Types.ObjectId('68be0fba37907a9f5551c936') }
      ]
    }).lean();
    
    console.log('Found notifications matching that ID:', notifs.length);
    
    if (notifs.length > 0) {
      notifs.forEach((n) => {
        console.log('\n📋 Notification:');
        console.log('_id:', n._id);
        console.log('title:', n.title);
        console.log('message:', n.message);
        console.log('metadata:', JSON.stringify(n.metadata, null, 2));
        console.log('\n Full object:', JSON.stringify(n, null, 2).substring(0, 500));
      });
    } else {
      // Get ANY recent notifications
      console.log('\n⏳ That ID not found. Getting recent notifications instead...');
      const recent = await Notification.find({})
        .sort({ createdAt: -1 })
        .limit(2)
        .lean();
      
      recent.forEach((n) => {
        console.log('\n📋 Recent Notification:');
        console.log('_id:', n._id);
        console.log('title:', n.title);
        console.log('message:', n.message);
        console.log('metadata.proposalId:', n.metadata?.proposalId);
      });
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
