require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    // Find notifications where message looks like an ObjectID
    const notifs = await Notification.find({ 
      message: /^[a-f0-9]{24}$/i 
    }).lean();
    
    console.log('✅ Found notifications with ObjectID as message:', notifs.length);
    
    if (notifs.length > 0) {
      console.log('\n📋 Sample notifications:');
      notifs.slice(0, 3).forEach((n, idx) => {
        console.log(`\n--- Notification ${idx + 1} ---`);
        console.log('_id:', n._id);
        console.log('title:', n.title);
        console.log('message:', n.message);
        console.log('metadata.proposalTitle:', n.metadata?.proposalTitle);
        console.log('metadata.proposalId:', n.metadata?.proposalId);
      });
      
      // Update them
      console.log('\n\n🔄 Updating notifications with empty/ID messages...');
      const updateResult = await Notification.updateMany(
        { message: /^[a-f0-9]{24}$/i },
        { 
          $set: { message: '' }  // Clear the ID, let display fallback to title
        }
      );
      
      console.log('✅ Update result:', updateResult);
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
