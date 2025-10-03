/**
 * Fix Capital Outlay Category - Remove invalid subline items like "Land"
 * 
 * This script will:
 * 1. Find the Capital Outlay category in the database
 * 2. Replace its sublineItems with the correct Capital Outlay subline items
 * 3. Show before and after comparison
 */

const mongoose = require('mongoose');
require('dotenv').config();

const categorySchema = new mongoose.Schema({
  categoryName: String,
  description: String,
  sublineItems: [String]
});

const Category = mongoose.model('Category', categorySchema);

// Correct Capital Outlay subline items according to Philippine government budget standards
const CORRECT_CAPITAL_OUTLAY_ITEMS = [
  "Infrastructure Outlay",
  "Building and Other Structures",
  "Machinery and Equipment Outlay",
  "Transportation Equipment Outlay",
  "Furniture, Fixtures and Books Outlay"
];

async function fixCapitalOutlayCategory() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_BUDGET_URL;
    console.log('Using MongoDB URI:', mongoUri ? '✅ Found' : '❌ Not Found');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find Capital Outlay category
    const capitalOutlay = await Category.findOne({ 
      categoryName: /capital.*outlay/i 
    });

    if (!capitalOutlay) {
      console.log('❌ Capital Outlay category not found in database!');
      console.log('   Creating new Capital Outlay category...');
      
      const newCategory = new Category({
        categoryName: 'Capital Outlay',
        description: 'Capital expenditures for infrastructure, buildings, machinery, equipment, transportation, and furniture',
        sublineItems: CORRECT_CAPITAL_OUTLAY_ITEMS
      });
      
      await newCategory.save();
      console.log('✅ Capital Outlay category created successfully!');
      console.log('   ID:', newCategory._id);
      console.log('   Subline Items:', newCategory.sublineItems);
      return;
    }

    console.log('📋 CAPITAL OUTLAY CATEGORY FOUND');
    console.log('   Name:', capitalOutlay.categoryName);
    console.log('   ID:', capitalOutlay._id);
    console.log('\n❌ CURRENT (INCORRECT) SUBLINE ITEMS:');
    console.log('  ', capitalOutlay.sublineItems);

    // Check for wrong items
    const wrongItems = capitalOutlay.sublineItems.filter(
      item => !CORRECT_CAPITAL_OUTLAY_ITEMS.includes(item)
    );

    if (wrongItems.length > 0) {
      console.log('\n⚠️  WRONG ITEMS DETECTED:');
      wrongItems.forEach(item => console.log(`   ❌ "${item}"`));
      console.log('\n   These items do NOT belong to Capital Outlay!');
      console.log('   Items like "Land", "Buildings", etc. belong to:');
      console.log('   → Property, Plant and Equipment (UACS: 1-06-xx-xxx)');
      console.log('   NOT Capital Outlay (UACS: 5-01-xx-xxx or 5-02-xx-xxx)');
    }

    console.log('\n✅ CORRECT SUBLINE ITEMS SHOULD BE:');
    console.log('  ', CORRECT_CAPITAL_OUTLAY_ITEMS);

    // Update the category
    console.log('\n🔧 Updating Capital Outlay category...');
    capitalOutlay.sublineItems = CORRECT_CAPITAL_OUTLAY_ITEMS;
    await capitalOutlay.save();

    console.log('✅ Capital Outlay category updated successfully!');
    console.log('\n📋 UPDATED SUBLINE ITEMS:');
    console.log('  ', capitalOutlay.sublineItems);

    console.log('\n✅ FIX COMPLETE!');
    console.log('\n📝 What was fixed:');
    console.log('   • Removed invalid items like "Land" that belong to Property, Plant & Equipment');
    console.log('   • Replaced with correct Philippine government Capital Outlay categories');
    console.log('   • These align with UACS codes 5-01-xx-xxx and 5-02-xx-xxx');
    console.log('\n🔄 Next steps:');
    console.log('   1. Restart your server if it\'s running');
    console.log('   2. Refresh your browser');
    console.log('   3. Try adding a Capital Outlay item again');
    console.log('   4. You should now only see the correct 5 subline items');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixCapitalOutlayCategory();