/**
 * SEED SCRIPT: Import departmentdivisionmappings from JSON file
 *
 * Reads fmis_budget.departmentdivisionmappings.json and upserts records
 * into the departmentdivisionmappings collection.
 * Data is fully dynamic - no hardcoded values.
 *
 * Usage: node migrations/seed-departmentdivisionmappings.js
 * Or:    node migrations/seed-departmentdivisionmappings.js [path/to/custom.json]
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Load .env from SERVER or project root (same as main app)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_JSON_PATH = path.join(__dirname, '../uploads/fmis_budget.departmentdivisionmappings.json');

// Convert MongoDB Extended JSON ($oid, $date) to native types
function convertExtendedJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertExtendedJson);
  if (typeof obj !== 'object') return obj;

  if (obj.$oid) return new mongoose.Types.ObjectId(obj.$oid);
  if (obj.$date) return new Date(obj.$date);

  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertExtendedJson(obj[key]);
  }
  return result;
}

async function run() {
  const jsonPath = process.argv[2] || DEFAULT_JSON_PATH;
  console.log('📂 Reading:', jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error('❌ File not found:', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let docs;
  try {
    docs = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Invalid JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(docs)) {
    console.error('❌ JSON must be an array of documents');
    process.exit(1);
  }

  const mongoUri =
    process.env.MONGODB_BUDGET_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    'mongodb://localhost:27017/fmis_budget';
  console.log('🔄 Connecting to MongoDB...');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  const collection = mongoose.connection.db.collection('departmentdivisionmappings');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = convertExtendedJson(docs[i]);
    const _id = doc._id;

    try {
      const result = await collection.replaceOne(
        { _id },
        { ...doc, updatedAt: new Date() },
        { upsert: true }
      );
      if (result.upsertedCount) inserted++;
      else if (result.modifiedCount) updated++;
    } catch (err) {
      console.error(`  ⚠️ Row ${i + 1} (${doc.departmentName}):`, err.message);
      errors++;
    }
  }

  console.log('\n📊 Result:');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated:  ${updated}`);
  console.log(`   Errors:   ${errors}`);
  console.log(`   Total:    ${docs.length}`);

  await mongoose.disconnect();
  console.log('\n✅ Done');
  process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
