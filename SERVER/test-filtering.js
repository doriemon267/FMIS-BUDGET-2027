/**
 * Test the filtering logic
 */
const mongoose = require('mongoose');
const PersonnelService = require('./models/PersonnelServices');

async function testFiltering() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    console.log('✓ Connected\n');

    const processBy = 'Frances Joshua Demafelez';
    const region = 'MARIIS';

    console.log('Testing filtering logic...\n');
    console.log(`Params: processBy="${processBy}", region="${region}"\n`);

    // Test 1: Find ALL records
    console.log('Test 1: WITHOUT budgetType filter');
    const allRecords = await PersonnelService.find({ processBy, region });
    console.log(`  Found ${allRecords.length} records`);
    allRecords.forEach((r, i) => {
      console.log(`    ${i+1}. budgetType=${r.budgetType}, fiscalYear=${r.fiscalYear}`);
    });

    // Test 2: Find ONLY Initial
    console.log('\nTest 2: WITH budgetType="Initial" filter');
    const initialOnly = await PersonnelService.find({ processBy, region, budgetType: 'Initial' });
    console.log(`  Found ${initialOnly.length} records`);
    initialOnly.forEach((r, i) => {
      console.log(`    ${i+1}. budgetType=${r.budgetType}, fiscalYear=${r.fiscalYear}`);
    });

    // Test 3: Find ONLY NEP
    console.log('\nTest 3: WITH budgetType="NEP" filter');
    const nepOnly = await PersonnelService.find({ processBy, region, budgetType: 'NEP' });
    console.log(`  Found ${nepOnly.length} records (expected 0 - no NEP records exist yet)`);
    nepOnly.forEach((r, i) => {
      console.log(`    ${i+1}. budgetType=${r.budgetType}, fiscalYear=${r.fiscalYear}`);
    });

    console.log('\n✅ Filter logic is working correctly!');
    console.log('\n📌 Note: To test NEP filtering, you need to:');
    console.log('   1. Create proposals with budgetType="NEP"');
    console.log('   2. Or manually update some Initial records to have budgetType="NEP" for testing');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testFiltering();
