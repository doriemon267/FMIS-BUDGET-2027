const mongoose = require('mongoose');
const path = require('path');

const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    // Find proposals that were backfilled but have undefined/null submittedToManagerAt
    const docs = await Proposal.find({ 'workflowHistory.comment': /Backfilled submittedToManager/, $or: [ { submittedToManagerAt: { $exists: false } }, { submittedToManagerAt: null } ] }).lean();
    if (!docs.length) {
      console.log('No proposals found needing repair.');
      process.exit(0);
    }

    console.log(`Found ${docs.length} proposals needing repair:`);

    let totalRepaired = 0;

    for (const d of docs) {
      // Find the best CONSOLIDATE workflowHistory entry to use as source
      // Prefer the CONSOLIDATE entry with newStatus 'Office Submitted'
      let source = (d.workflowHistory || []).slice().reverse().find(h => h.action === 'CONSOLIDATE' && h.newStatus === 'Office Submitted');
      if (!source) {
        // fallback: the last CONSOLIDATE entry
        source = (d.workflowHistory || []).slice().reverse().find(h => h.action === 'CONSOLIDATE');
      }

      if (!source) {
        console.log(` - ${d._id}: no CONSOLIDATE entry found; skipping`);
        continue;
      }

      const ts = source.timestamp || source.time || null;
      const userId = source.userId || null;
      const userName = source.userName || source.user || null;

      if (!ts) {
        console.log(` - ${d._id}: source CONSOLIDATE entry missing timestamp; skipping`);
        continue;
      }

      // perform update
      const update = {
        $set: {
          submittedToManagerAt: ts,
          submittedToManagerBy: { userId, userName },
          status: 'Office Submitted'
        },
        $push: {
          workflowHistory: {
            action: 'CONSOLIDATE',
            comment: `Repaired submittedToManager from workflowHistory entry ${source._id}`,
            userId: userId || null,
            userName: userName || null,
            timestamp: new Date(),
            previousStatus: d.status || 'Office Approved',
            newStatus: 'Office Submitted'
          }
        }
      };

      const res = await Proposal.updateOne({ _id: d._id }, update);
      if (res.modifiedCount && res.modifiedCount > 0) {
        totalRepaired++;
        console.log(` - ${d._id}: repaired (used workflowHistory entry ${source._id})`);
      } else {
        console.log(` - ${d._id}: update reported modifiedCount=0 (may already be set)`);
      }
    }

    console.log(`Total repaired: ${totalRepaired}`);
    process.exit(0);
  } catch (err) {
    console.error('Repair error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
