require('dotenv').config();
const mongoose = require('mongoose');

const url = process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget';
console.log('🔗 Connecting to:', url);

mongoose.connect(url, { serverSelectionTimeoutMS: 5000 }).then(async () => {
  const Settings = require('./models/Settings');
  const count = await Settings.countDocuments();
  console.log('\n✅ Total Settings records:', count);
  
  if (count > 0) {
    const sample = await Settings.find().limit(5).select('fiscalYear budgetType _id');
    console.log('\n📋 Sample fiscal years:');
    sample.forEach(s => {
      console.log(`   • ${s.fiscalYear} (${s.budgetType}) - ID: ${s._id}`);
    });
  } else {
    console.log('\n⚠️  NO FISCAL YEARS IN DATABASE!');
    console.log('   Need to create fiscal years first.\n');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('\n❌ DB Connection Error:', err.message);
  process.exit(1);
});