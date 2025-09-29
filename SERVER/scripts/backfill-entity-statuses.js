const mongoose = require('mongoose');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const apply = !!argv.apply;
const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));
    const PersonnelServices = require(path.join(__dirname, '..', 'models', 'PersonnelServices'));
    const MooeProposal = require(path.join(__dirname, '..', 'models', 'mooeProposals'));
    const CapitalOutlay = require(path.join(__dirname, '..', 'models', 'CapitalOutlay'));
    const Income = require(path.join(__dirname, '..', 'models', 'Income'));

    // Find consolidated proposals that should have caused entity updates
    const consolidated = await Proposal.find({ isConsolidated: true }).lean();
    console.log(`Inspecting ${consolidated.length} consolidated proposals for entity backfill`);

    let totalCandidates = 0;
    let totalUpdated = 0;

    for (const cons of consolidated) {
      const dept = cons.department;
      const div = cons.division;
      const fy = cons.fiscalYear;
      const bt = cons.budgetType;

      const entityQuery = { department: dept, division: div, fiscalYear: fy, budgetType: bt, status: 'Office Approved' };

      const counts = await Promise.all([
        PersonnelServices.countDocuments(entityQuery),
        MooeProposal.countDocuments(entityQuery),
        CapitalOutlay.countDocuments(entityQuery),
        Income.countDocuments(entityQuery)
      ]);

      const [psCount, mooeCount, coCount, incCount] = counts;
      const consTotal = psCount + mooeCount + coCount + incCount;
      if (consTotal === 0) continue;

      totalCandidates += consTotal;
      console.log(`Consolidated ${cons._id}: candidates ps=${psCount} mooe=${mooeCount} co=${coCount} inc=${incCount}`);

      if (apply) {
        const res = await Promise.all([
          PersonnelServices.updateMany(entityQuery, { $set: { status: 'Office Submitted', submittedToManagerAt: cons.submittedToManagerAt || cons.submittedDate || cons.consolidatedByOfficer?.date, submittedToManagerBy: cons.submittedToManagerBy || cons.consolidatedByOfficer } }),
          MooeProposal.updateMany(entityQuery, { $set: { status: 'Office Submitted', submittedToManagerAt: cons.submittedToManagerAt || cons.submittedDate || cons.consolidatedByOfficer?.date, submittedToManagerBy: cons.submittedToManagerBy || cons.consolidatedByOfficer } }),
          CapitalOutlay.updateMany(entityQuery, { $set: { status: 'Office Submitted', submittedToManagerAt: cons.submittedToManagerAt || cons.submittedDate || cons.consolidatedByOfficer?.date, submittedToManagerBy: cons.submittedToManagerBy || cons.consolidatedByOfficer } }),
          Income.updateMany(entityQuery, { $set: { status: 'Office Submitted', submittedToManagerAt: cons.submittedToManagerAt || cons.submittedDate || cons.consolidatedByOfficer?.date, submittedToManagerBy: cons.submittedToManagerBy || cons.consolidatedByOfficer } })
        ]);
        totalUpdated += (res[0].modifiedCount || 0) + (res[1].modifiedCount || 0) + (res[2].modifiedCount || 0) + (res[3].modifiedCount || 0);
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
