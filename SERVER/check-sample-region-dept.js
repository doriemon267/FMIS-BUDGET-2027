require('dotenv').config();
const mongoose = require('mongoose');

async function checkRegionsAndDepts() {
  try {
    const budgetUrl = process.env.MONGODB_BUDGET_URL;
    await mongoose.connect(budgetUrl);
    console.log('✅ Connected\n');

    // Check regions - get first one with all fields
    const Region = mongoose.model('Region', new mongoose.Schema({}, { strict: false }), 'regions');
    const region = await Region.findOne();
    console.log('📍 Sample Region:');
    console.log(JSON.stringify(region, null, 2));

    // Check departments - get first one with all fields
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
    const dept = await Department.findOne();
    console.log('\n🏢 Sample Department:');
    console.log(JSON.stringify(dept, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkRegionsAndDepts();
