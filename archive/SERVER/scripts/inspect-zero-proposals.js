const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL'); process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  // Find proposals that would render as zero in the UI
  const cursor = Proposal.find({}, {
    _id: 1,
    title: 1,
    status: 1,
    proposedBudget: 1,
    totalIncome: 1,
    totalExpenses: 1,
    consolidatedProposals: 1,
    workflowLevel: 1,
    originalLevel: 1,
    department: 1,
    division: 1,
    processBy: 1,
    updatedAt: 1
  }).sort({ updatedAt: -1 }).cursor();

  const results = [];
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const pb = doc.proposedBudget || 0;
    const ti = doc.totalIncome || 0;
    const te = doc.totalExpenses || 0;
    if ((pb === 0 && ti === 0 && te === 0) || pb === undefined) {
      results.push({
        _id: String(doc._id),
        title: doc.title,
        status: doc.status,
        proposedBudget: pb,
        totalIncome: ti,
        totalExpenses: te,
        consolidatedCount: Array.isArray(doc.consolidatedProposals) ? doc.consolidatedProposals.length : 0,
        workflowLevel: doc.workflowLevel,
        originalLevel: doc.originalLevel,
        department: doc.department,
        division: doc.division,
        processBy: doc.processBy,
        updatedAt: doc.updatedAt
      });
    }
  }

  console.log('Found proposals with zero/missing totals:', results.length);
  results.slice(0, 50).forEach(r => console.log(JSON.stringify(r)));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
