/**
 * Check what processBy values exist in the database
 */
const mongoose = require('mongoose');
const PersonnelService = require('./models/PersonnelServices');

async function checkProcessBy() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    console.log('✓ Connected\n');

    // Get unique processBy values
    const processById = await PersonnelService.distinct('processBy');
    console.log('Unique processBy values in PersonnelService:');
    processById.forEach((val, i) => {
      console.log(`  ${i+1}. ${val}`);
    });

    // Get unique regions
    const regions = await PersonnelService.distinct('region');
    console.log('\nUnique region values in PersonnelService:');
    regions.forEach((val, i) => {
      console.log(`  ${i+1}. ${val}`);
    });

    // Show a sample record
    const sample = await PersonnelService.findOne({});
    console.log('\nSample record:');
    console.log(`  processBy: ${sample?.processBy}`);
    console.log(`  region: ${sample?.region}`);
    console.log(`  budgetType: ${sample?.budgetType}`);
    console.log(`  fiscalYear: ${sample?.fiscalYear}`);
    console.log(`  status: ${sample?.status}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProcessBy();
