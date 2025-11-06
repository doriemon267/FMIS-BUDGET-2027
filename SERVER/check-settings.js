/**
 * Check what's in the settings collection
 */
const mongoose = require('mongoose');

async function checkSettings() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    console.log('✓ Connected\n');

    const db = mongoose.connection.db;
    const settingsCol = db.collection('settings');
    
    const allSettings = await settingsCol.find({}).toArray();
    
    console.log('All settings in database:\n');
    allSettings.forEach((setting, idx) => {
      console.log(`Setting ${idx + 1}:`);
      console.log(`  _id: ${setting._id}`);
      console.log(`  budgetType: ${setting.budgetType}`);
      console.log(`  fiscalYear: ${setting.fiscalYear}`);
      console.log(`  isActive: ${setting.isActive}`);
      console.log();
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSettings();
