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

    const consolidated = await Proposal.find({ isConsolidated: true, $or: [ { consolidatedProposals: { $exists: false } }, { consolidatedProposals: { $size: 0 } } ] }).lean();
    console.log(`Found ${consolidated.length} consolidated proposals with empty consolidatedProposals`);

    let totalToPopulate = 0;
    let totalPopulated = 0;

    for (const cons of consolidated) {
      const dept = cons.department;
      const div = cons.division;
      const fy = cons.fiscalYear;
      const bt = cons.budgetType;

      // Find entity docs that match org/fy/budgetType and were likely included
      const ps = await PersonnelServices.find({ department: dept, division: div, fiscalYear: fy, budgetType: bt }).limit(100).lean();
      const mooe = await MooeProposal.find({ department: dept, division: div, fiscalYear: fy, budgetType: bt }).limit(100).lean();
      const co = await CapitalOutlay.find({ department: dept, division: div, fiscalYear: fy, budgetType: bt }).limit(100).lean();
      const inc = await Income.find({ department: dept, division: div, fiscalYear: fy, budgetType: bt }).limit(100).lean();

      const candidates = [];
      ps.forEach(d => candidates.push({ proposalId: d._id, title: d.particulars || d.title || `${d.department} - ${d.division}`, department: d.department, division: d.division, model: 'PersonnelServices' }));
      mooe.forEach(d => candidates.push({ proposalId: d._id, title: d.accountingTitle || d.uacsCode || `${d.department} - ${d.division}`, department: d.department, division: d.division, model: 'MooeProposal' }));
      co.forEach(d => candidates.push({ proposalId: d._id, title: d.particulars || `${d.department} - ${d.division}`, department: d.department, division: d.division, model: 'CapitalOutlay' }));
      inc.forEach(d => candidates.push({ proposalId: d._id, title: d.particulars || `${d.department} - ${d.division}`, department: d.department, division: d.division, model: 'Income' }));

      if (candidates.length === 0) continue;

      console.log(`Consolidated ${cons._id} candidates found: personnel=${ps.length} mooe=${mooe.length} cap=${co.length} inc=${inc.length}`);
      totalToPopulate += candidates.length;

      if (apply) {
        // Save minimal metadata into consolidatedProposals array
        const toSave = candidates.map(c => ({ proposalId: c.proposalId, title: c.title, department: c.department, division: c.division }));
        const res = await Proposal.updateOne({ _id: cons._id }, { $set: { consolidatedProposals: toSave } });
        if (res.modifiedCount && res.modifiedCount > 0) {
          totalPopulated += toSave.length;
          console.log(` - Populated ${toSave.length} entries for consolidated ${cons._id}`);
        } else {
          console.log(` - No documents modified for ${cons._id} (may already have data)`);
        }
      }
    }

    console.log(`Total candidate entries across consolidated proposals: ${totalToPopulate}`);
    console.log(`Total entries written: ${totalPopulated} (apply=${apply})`);
    process.exit(0);
  } catch (err) {
    console.error('Error populating consolidatedProposals:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
