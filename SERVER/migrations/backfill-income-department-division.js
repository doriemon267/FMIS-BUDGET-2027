// Backfill script to set department/division on Income documents based on consolidation metadata or heuristics
// Usage: node SERVER/migrations/backfill-income-department-division.js

const mongoose = require('mongoose');
const path = require('path');

// Load models
const Income = require(path.join(__dirname, '..', 'models', 'Income'));
const HierarchicalUserAssignment = require(path.join(__dirname, '..', 'models', 'HierarchicalUserAssignment'));

(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.DB_URI || 'mongodb://172.16.4.98:27017/fmis_budget';
    await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
    console.log('Connected to MongoDB');

    const cursor = Income.find({ $or: [ { department: { $exists: false } }, { department: null } ] }).cursor();
    let updated = 0, checked = 0;

    for (let income = await cursor.next(); income != null; income = await cursor.next()) {
      checked++;

      // Try to derive from consolidationMetadata if present
      const meta = income.consolidationMetadata || {};
      const ctx = meta.consolidatedContext || {};
      let department = income.department || ctx.department || income.originalDepartment || null;
      let division = income.division || ctx.division || income.originalDivision || null;

      // If still missing, try based on who submitted (requires more schema/user linkage, fallback skipped)

      if (department || division) {
        income.department = department || income.department;
        income.division = division || income.division;
        await income.save();
        updated++;
      }

      if (checked % 500 === 0) {
        console.log(`Progress: checked=${checked}, updated=${updated}`);
      }
    }

    console.log(`Done. Checked: ${checked}, Updated: ${updated}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Backfill error:', err);
    process.exit(1);
  }
})();