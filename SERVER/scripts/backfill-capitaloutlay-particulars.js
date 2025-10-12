const mongoose = require('mongoose');
const path = require('path');

const MONGODB = process.env.MONGODB_BUDGET_URL;

const buildParticularsSummary = (detailsArr = []) => {
  try {
    const parts = (detailsArr || [])
      .map(d => (d && (d.particulars || '').toString().trim()))
      .filter(Boolean);
    if (parts.length === 0) return '';
    const uniq = Array.from(new Set(parts));
    const first = uniq.slice(0, 3).join(' • ');
    const more = uniq.length > 3 ? ` (+${uniq.length - 3} more)` : '';
    const summary = `${first}${more}`;
    return summary.length > 200 ? summary.slice(0, 197) + '…' : summary;
  } catch {
    return '';
  }
};

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const CapitalOutlay = require(path.join(__dirname, '..', 'models', 'CapitalOutlay'));
    const CapitalOutlayDetails = require(path.join(__dirname, '..', 'models', 'CapitalOutlayDetails'));

    const cursor = CapitalOutlay.find({ $or: [{ particulars: { $exists: false } }, { particulars: '' }] }).cursor();
    let processed = 0, updated = 0;
    for (let co = await cursor.next(); co != null; co = await cursor.next()) {
      processed++;
      const details = await CapitalOutlayDetails.find({ capital_outlay_id: co._id }).select('particulars').lean();
      const summary = buildParticularsSummary(details);
      if (summary) {
        await CapitalOutlay.updateOne({ _id: co._id }, { $set: { particulars: summary } });
        updated++;
        if (updated % 50 === 0) console.log(`Updated ${updated} records so far...`);
      }
    }
    console.log(`Backfill complete. Processed: ${processed}, Updated: ${updated}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Backfill error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
