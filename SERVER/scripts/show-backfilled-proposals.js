const mongoose = require('mongoose');
const path = require('path');

const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    // Find proposals that have a workflowHistory entry created by our backfill script
    const docs = await Proposal.find({ 'workflowHistory.comment': /Backfilled submittedToManager/ }).lean();
    if (!docs.length) {
      console.log('No backfilled proposals found by workflowHistory marker.');
      process.exit(0);
    }

    console.log(`Found ${docs.length} backfilled proposals:`);
    for (const d of docs) {
      console.log('---');
      console.log('id:', d._id);
      console.log('title:', d.title || 'N/A');
      console.log('status:', d.status);
      console.log('submittedToManagerAt:', d.submittedToManagerAt);
      console.log('submittedToManagerBy:', JSON.stringify(d.submittedToManagerBy));
      const marker = (d.workflowHistory || []).find(h => /Backfilled submittedToManager/.test(h.comment));
      if (marker) {
        console.log('workflowHistory.marker.timestamp:', marker.timestamp);
        console.log('workflowHistory.marker.comment:', marker.comment);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
