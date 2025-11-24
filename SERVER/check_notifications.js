require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('Connected to MongoDB');

    const docs = await Notification.find({ message: { $exists: false } }).limit(5).lean();
    console.log('Notifications without message:', docs.length);
    console.log(JSON.stringify(docs, null, 2));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();