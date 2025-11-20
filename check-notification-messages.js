require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./SERVER/models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check for notifications without message field
    const noMessage = await Notification.find({ message: { $exists: false } }).limit(5).lean();
    console.log('Notifications without message field:', noMessage.length);
    if (noMessage.length > 0) {
      console.log('Sample:', JSON.stringify(noMessage[0], null, 2));
    }
    
    // Check for empty message strings
    const emptyMsg = await Notification.find({ message: '' }).limit(5).lean();
    console.log('Notifications with empty message:', emptyMsg.length);
    if (emptyMsg.length > 0) {
      console.log('Sample:', JSON.stringify(emptyMsg[0], null, 2));
    }
    
    // Check for null messages
    const nullMsg = await Notification.find({ message: null }).limit(5).lean();
    console.log('Notifications with null message:', nullMsg.length);
    
    // Get all recent notifications to check structure
    const recent = await Notification.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log('\n5 Most recent notifications:');
    recent.forEach((n, i) => {
      console.log(`${i+1}. Title: "${n.title}", Message: "${n.message}", Has metadata: ${!!n.metadata}`);
    });
    
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
