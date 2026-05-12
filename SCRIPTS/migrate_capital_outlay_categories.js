/**
 * ============================================================
 * MIGRATION: Clear & Fix Capital Outlay Records for FY2027
 * ============================================================
 * STEP 1 (this script):
 *   - Deletes ALL CapitalOutlay + CapitalOutlayDetails records
 *     for the active fiscal year (default: 2027) so the user
 *     can re-upload with the fixed controller.
 *   - Seeds the 6 standard categories first.
 *
 * STEP 2 (user action):
 *   - Re-upload the Excel file from the Capital Outlay upload page.
 *   - The fixed controller will now group correctly per category.
 *
 * Run from SERVER folder:
 *   node ..\SCRIPTS\migrate_capital_outlay_categories.js
 *
 * To clear a different fiscal year:
 *   CLEAR_FY=2026 node ..\SCRIPTS\migrate_capital_outlay_categories.js
 * ============================================================
 */

const path = require('path');
const SERVER_DIR = path.resolve(__dirname, '..', 'SERVER');
const dotenv   = require(path.join(SERVER_DIR, 'node_modules', 'dotenv'));
const mongoose = require(path.join(SERVER_DIR, 'node_modules', 'mongoose'));

dotenv.config({ path: path.join(SERVER_DIR, '.env') });

const MONGODB_URI = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
const FISCAL_YEAR = process.env.CLEAR_FY || '2027';

if (!MONGODB_URI) { console.error('❌ MONGODB_BUDGET_URL not found in SERVER/.env'); process.exit(1); }

// ── Inline Schemas ──────────────────────────────────────────────────────────
const Category = mongoose.model('Category', new mongoose.Schema({
  categoryName: { type: String, required: true, unique: true, trim: true },
  description:  String,
  sublineItems: { type: [String], default: [] },
}));

const CapitalOutlay = mongoose.model('CapitalOutlay', new mongoose.Schema({}, { strict: false }), 'capitaloutlays');
const CapitalOutlayDetails = mongoose.model('CapitalOutlayDetails', new mongoose.Schema({}, { strict: false }), 'capitaloutlaydetails');

// ── 6 Standard Categories ───────────────────────────────────────────────────
const STANDARD_CATEGORIES = [
  'ACQUISITION OF FURNITURE & FIXTURES AND BOOKS',
  'ACQUISITION OF MACHINERY AND EQUIPMENT',
  'ACQUISITION OF TRANSPORTATION EQUIPMENT',
  'INTANGIBLE ASSETS - INCLUDES COMPUTER SOFTWARE',
  'ACQUISITION OF LOT/LAND TITLING',
  'IMPLEMENTATION/CONSTRUCTION/REHABILITATION OF GOVERNMENT FACILITIES/BUILDINGS & STRUCTURES (REGULAR)',
];

// ── Main ───────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🔌 Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`✅ Connected\n`);
  console.log(`⚠️  Target Fiscal Year: ${FISCAL_YEAR}\n`);

  // ── Step 1: Seed standard categories ───────────────────────────────────
  console.log('📂 Step 1: Seeding standard categories...');
  for (const name of STANDARD_CATEGORIES) {
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const doc = await Category.findOneAndUpdate(
      { categoryName: new RegExp(`^${escape(name)}$`, 'i') },
      { $setOnInsert: { categoryName: name } },
      { upsert: true, new: true }
    );
    console.log(`  ✔ [${doc._id}] ${doc.categoryName}`);
  }

  // ── Step 2: Count records to be deleted ────────────────────────────────
  const masterFilter = {
    $or: [
      { fiscalYear: FISCAL_YEAR },
      { fiscalYear: Number(FISCAL_YEAR) },
      { fiscal_year: FISCAL_YEAR },
      { fiscal_year: Number(FISCAL_YEAR) },
    ]
  };

  const masterCount = await CapitalOutlay.countDocuments(masterFilter);
  const masterIds   = await CapitalOutlay.find(masterFilter).distinct('_id');
  const detailCount = await CapitalOutlayDetails.countDocuments({
    capital_outlay_id: { $in: masterIds }
  });

  console.log(`\n📊 Records to DELETE for FY${FISCAL_YEAR}:`);
  console.log(`   CapitalOutlay (master)  : ${masterCount}`);
  console.log(`   CapitalOutlayDetails    : ${detailCount}`);

  if (masterCount === 0 && detailCount === 0) {
    console.log('\n✅ Nothing to delete. You may now re-upload the Excel file.');
    await mongoose.disconnect();
    return;
  }

  // ── Step 3: Delete records ──────────────────────────────────────────────
  console.log(`\n🗑️  Step 2: Deleting records...`);

  const detailResult = await CapitalOutlayDetails.deleteMany({
    capital_outlay_id: { $in: masterIds }
  });
  console.log(`   Deleted ${detailResult.deletedCount} CapitalOutlayDetails`);

  const masterResult = await CapitalOutlay.deleteMany(masterFilter);
  console.log(`   Deleted ${masterResult.deletedCount} CapitalOutlay masters`);

  // ── Done ────────────────────────────────────────────────────────────────
  console.log(`\n✅ Done! All FY${FISCAL_YEAR} Capital Outlay data cleared.`);
  console.log(`\n📤 NEXT STEP: Go to the Capital Outlay Upload page and re-upload`);
  console.log(`   your Excel file. The fixed controller will now correctly`);
  console.log(`   group items per category (FURNITURE, MACHINERY, CONSTRUCTION, etc.)\n`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Script failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
