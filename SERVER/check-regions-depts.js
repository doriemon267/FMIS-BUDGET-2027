require('dotenv').config();
const mongoose = require('mongoose');

async function checkRegionsAndDepts() {
  try {
    const budgetUrl = process.env.MONGODB_BUDGET_URL;
    await mongoose.connect(budgetUrl);
    console.log('✅ Connected\n');

    // Check regions
    const Region = mongoose.model('Region', new mongoose.Schema({}, { strict: false }), 'regions');
    const regions = await Region.find();
    console.log('📍 Regions:');
    regions.forEach(r => {
      console.log(`   ${r._id} - ${r.regionName || r.name || r.RegionName}`);
    });

    // Check departments
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
    const depts = await Department.find();
    console.log('\n🏢 Departments:');
    depts.forEach(d => {
      console.log(`   ${d._id} - ${d.departmentName || d.name || d.DepartmentName}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkRegionsAndDepts();
