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
        const updateResult = await Proposal.updateMany(
          { _id: { $in: candidates.map(c => c._id) } },
          {
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
                previousStatus: 'Office Approved',
                newStatus: 'Office Submitted'
              }
            }
          }
        );

        totalUpdated += updateResult.modifiedCount || 0;
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
