const mongoose = require('mongoose');
const Notification = require('./models/Notification');

(async () => {
  try {
    const mongoUri = 'mongodb://172.16.4.98:27017/fmis_budget';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Find notifications where message is just an ID (hex strings)
    const idLikeMessages = await Notification.find({
      message: { $regex: '^[a-f0-9]{24}$', $options: 'i' } // MongoDB ObjectId format
    }).limit(10).lean();
    
    console.log(`\n📊 Found ${idLikeMessages.length} notifications with ID-like messages`);
    
    if (idLikeMessages.length > 0) {
      console.log('\n📋 Sample notifications with ID messages:');
      idLikeMessages.slice(0, 3).forEach((n, i) => {
        console.log(`\n${i+1}. ID: ${n._id}`);
        console.log(`   Title: "${n.title}"`);
        console.log(`   Message: "${n.message}"`);
        console.log(`   Type: ${n.type}`);
        console.log(`   Metadata proposalTitle: ${n.metadata?.proposalTitle}`);
        console.log(`   Org: ${JSON.stringify(n.org)}`);
      });
      
      // Get sample for fixing
      const sample = idLikeMessages[0];
      console.log(`\n🔧 Would fix notifications like:`);
      console.log(`   From message: "${sample.message}"`);
      console.log(`   To message: "${sample.title || sample.metadata?.proposalTitle || 'Notification'}"`);
    }
    
    // Also check for messages that are too short
    const shortMessages = await Notification.find({
      message: { $exists: true },
      $expr: { $lt: [{ $strLenCP: '$message' }, 10] }
    }).limit(10).lean();
    
    console.log(`\n📊 Found ${shortMessages.length} notifications with very short messages`);
    if (shortMessages.length > 0) {
      console.log('Sample short messages:');
      shortMessages.slice(0, 3).forEach((n, i) => {
        console.log(`  ${i+1}. Title: "${n.title}", Message: "${n.message}"`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
