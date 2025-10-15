require('dotenv').config();
const mongoose = require('mongoose');

async function findNCR() {
  try {
    const budgetUrl = process.env.MONGODB_BUDGET_URL;
    await mongoose.connect(budgetUrl);

    const Region = mongoose.model('Region', new mongoose.Schema({}, { strict: false }), 'regions');
    const regions = await Region.find();
    
    console.log('All Regions:');
    regions.forEach(r => {
      console.log(`${r._id} - ${r.Region}`);
    });

    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
    const depts = await Department.find();
    
    console.log('\nAll Departments:');
    depts.forEach(d => {
      console.log(`${d._id} - ${d.Department}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

findNCR();
