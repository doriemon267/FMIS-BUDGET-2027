/**
 * Verify Capital Outlay Category - Check if subline items are correct
 */

const mongoose = require('mongoose');
require('dotenv').config();

const categorySchema = new mongoose.Schema({
  categoryName: String,
  description: String,
  sublineItems: [String]
});

const Category = mongoose.model('Category', categorySchema);

const CORRECT_ITEMS = [
  "Infrastructure Outlay",
  "Building and Other Structures",
  "Machinery and Equipment Outlay",
  "Transportation Equipment Outlay",
  "Furniture, Fixtures and Books Outlay"
];

async function verifyCategory() {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL;
    console.log('Using MongoDB URI:', mongoUri ? '✅ Found' : '❌ Not Found');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const capitalOutlay = await Category.findOne({ 
      categoryName: /capital.*outlay/i 
    });

    if (!capitalOutlay) {
      console.log('❌ Capital Outlay category not found!');
      return;
    }

    console.log('📋 CAPITAL OUTLAY CATEGORY');
    console.log('   Name:', capitalOutlay.categoryName);
    console.log('   ID:', capitalOutlay._id);
    console.log('   Subline Items:', capitalOutlay.sublineItems);

    const isCorrect = CORRECT_ITEMS.every(item => capitalOutlay.sublineItems.includes(item)) &&
                      capitalOutlay.sublineItems.every(item => CORRECT_ITEMS.includes(item));

    if (isCorrect) {
      console.log('\n✅ ✅ ✅ VERIFICATION PASSED! ✅ ✅ ✅');
      console.log('   Capital Outlay category has correct subline items!');
    } else {
      console.log('\n❌ VERIFICATION FAILED!');
      const wrong = capitalOutlay.sublineItems.filter(item => !CORRECT_ITEMS.includes(item));
      const missing = CORRECT_ITEMS.filter(item => !capitalOutlay.sublineItems.includes(item));
      
      if (wrong.length > 0) {
        console.log('   Wrong items:', wrong);
      }
      if (missing.length > 0) {
        console.log('   Missing items:', missing);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

verifyCategory();