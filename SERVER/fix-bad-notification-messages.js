require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    
    console.log('🔍 Checking for notifications with ObjectID-like messages...');
    
    // Find any notification where message looks like an ObjectID
    const badNotifs = await Notification.find({
      message: { $regex: '^[a-f0-9]{24}$', $options: 'i' }
    }).lean();
    
    if (badNotifs.length > 0) {
      console.log(`❌ Found ${badNotifs.length} notifications with ObjectID messages!`);
      console.log('\nSamples:');
      badNotifs.slice(0, 3).forEach(n => {
        console.log(`  _id: ${n._id}`);
        console.log(`  title: ${n.title}`);
        console.log(`  message: ${n.message}`);
        console.log(`  metadata.proposalTitle: ${n.metadata?.proposalTitle}`);
      });
      
      // Clear the bad message fields
      console.log('\n🔄 Clearing ObjectID message fields...');
      const result = await Notification.updateMany(
        { message: { $regex: '^[a-f0-9]{24}$', $options: 'i' } },
        { $set: { message: '' } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} notifications`);
    } else {
      console.log('✅ No notifications with ObjectID messages found');
      
      // Check for empty messages
      const emptyMsgs = await Notification.find({
        $or: [
          { message: '' },
          { message: null },
          { message: { $exists: false } }
        ]
      }).limit(3).lean();
      
      console.log(`\nℹ️ Found ${emptyMsgs.length} notifications with empty/missing messages`);
      if (emptyMsgs.length > 0) {
        emptyMsgs.forEach(n => {
          console.log(`  title: ${n.title}, proposalTitle: ${n.metadata?.proposalTitle}`);
        });
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
