require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    const notifs = await Notification.find({ message: /^[a-f0-9]{24}$/ }).limit(3).lean();
    console.log('Found notifications with ObjectID as message:', notifs.length);
    if (notifs.length > 0) {
      console.log('Sample:', JSON.stringify(notifs[0], null, 2));
    }
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
