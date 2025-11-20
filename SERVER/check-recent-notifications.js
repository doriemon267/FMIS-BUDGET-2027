const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    const mongoUri = 'mongodb://172.16.4.98:27017/fmis_budget';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get recent unread notifications
    const recent = await Notification.find({ status: 'UNREAD' })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    
    console.log(`\n📊 Found ${recent.length} recent UNREAD notifications\n`);
    
    if (recent.length > 0) {
      recent.forEach((n, i) => {
        console.log(`${i+1}. ${n.title}`);
        console.log(`   Message: "${n.message}"`);
        console.log(`   Type: ${n.type}`);
        console.log(`   Org region: ${n.org?.region || 'N/A'}`);
        console.log(`   Org department: ${n.org?.department || 'N/A'}`);
        console.log(`   Metadata keys: ${Object.keys(n.metadata || {}).join(', ')}`);
        console.log();
      });
    }
    
    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
