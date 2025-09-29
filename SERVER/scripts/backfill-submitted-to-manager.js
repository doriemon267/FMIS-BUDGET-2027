const mongoose = require('mongoose');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const apply = !!argv.apply;
const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    // Find consolidated proposals that likely represent a submit-to-manager event
    const consolidated = await Proposal.find({ isConsolidated: true }).lean();
    console.log(`Found ${consolidated.length} consolidated proposals to inspect`);

    let totalCandidates = 0;
    let totalUpdated = 0;

    for (const cons of consolidated) {
      // If the consolidated proposal already has submittedToManagerAt/by, use that; else try submittedDate
      const submittedAt = cons.submittedToManagerAt || cons.submittedDate || cons.consolidatedByOfficer?.date || null;
      const submittedBy = cons.submittedToManagerBy || cons.consolidatedByOfficer || null;

      if (!submittedAt) {
        // Nothing to base on; skip but report
        console.log(`Skipping consolidated ${cons._id} - no submitted date metadata available`);
        continue;
      }

      const originalIds = (cons.consolidatedProposals || []).map(x => x.proposalId).filter(Boolean);
      if (!originalIds.length) {
        continue;
      }

      // Find originals that are missing submittedToManagerAt or status isn't Office Submitted
      const candidates = await Proposal.find({ _id: { $in: originalIds }, $or: [ { submittedToManagerAt: { $exists: false } }, { status: { $ne: 'Office Submitted' } } ] }).lean();
      if (!candidates.length) continue;

      totalCandidates += candidates.length;
      console.log(`Consolidated ${cons._id} -> will ${apply ? 'update' : 'report'} ${candidates.length} originals`);

      if (apply) {
        // Perform per-document updates so we can audit old vs new values
        const fs = require('fs');
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        const csvPath = path.join(logsDir, `backfill-submitted-to-manager-${new Date().toISOString().slice(0,10)}.csv`);
        const csvHeader = 'proposalId,oldStatus,oldSubmittedAt,oldSubmittedBy,newStatus,newSubmittedAt,newSubmittedBy,sourceConsolidatedId,appliedAt\n';
        if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, csvHeader);

        for (const cand of candidates) {
          const oldStatus = cand.status || '';
          const oldSubmittedAt = cand.submittedToManagerAt ? cand.submittedToManagerAt.toISOString() : '';
          const oldSubmittedBy = cand.submittedToManagerBy ? (cand.submittedToManagerBy.userName || cand.submittedToManagerBy.name || '') : '';

          const update = {
            $set: {
              status: 'Office Submitted',
              submittedToManagerAt: submittedAt,
              submittedToManagerBy: submittedBy
            },
            $push: {
              workflowHistory: {
                action: 'CONSOLIDATE',
                comment: `Backfilled submittedToManager from consolidated ${cons._id}`,
                userId: submittedBy?.userId || null,
                userName: submittedBy?.userName || submittedBy?.name || null,
                timestamp: new Date(),
                previousStatus: oldStatus || 'Office Approved',
                newStatus: 'Office Submitted'
              }
            }
          };

          const res = await Proposal.updateOne({ _id: cand._id, $or: [ { submittedToManagerAt: { $exists: false } }, { status: { $ne: 'Office Submitted' } } ] }, update);
          if (res.modifiedCount && res.modifiedCount > 0) {
            totalUpdated += 1;
            const newSubmittedAt = submittedAt ? submittedAt.toISOString() : '';
            const newSubmittedBy = submittedBy ? (submittedBy.userName || submittedBy.name || '') : '';
            const row = `${cand._id},${oldStatus},${oldSubmittedAt},"${oldSubmittedBy}",Office Submitted,${newSubmittedAt},"${newSubmittedBy}",${cons._id},${new Date().toISOString()}\n`;
            fs.appendFileSync(csvPath, row);
          }
        }
      }
    }

    console.log(`Candidates found: ${totalCandidates}`);
    console.log(`Total updated: ${totalUpdated} (apply=${apply})`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
