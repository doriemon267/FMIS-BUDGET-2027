const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL'); process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  // get distinct departments (no limit)
  const departments = await Proposal.distinct('department');
  const sample = departments.filter(Boolean);
  console.log('Departments to validate:', sample.length);

  const makeReq = (dept) => ({ query: { page: 0, limit: 10 }, hierarchicalFilters: { department: dept }, hierarchicalAccessInfo: { scope: 'DEPARTMENT' }, hierarchicalAccess: { scope: 'DEPARTMENT' }, submissionWorkflowFilters: {} });
  const makeRes = () => {
    return {
      status() { return this; },
      json(obj) { this.payload = obj; }
    };
  };

  const results = [];
  for (const dept of sample) {
    const req = makeReq(dept);
    const res = makeRes();
    try {
      await proposalController.getProposals(req, res);
      const proposals = res.payload && res.payload.proposals ? res.payload.proposals : [];
      const parents = proposals.filter(p => p.isConsolidated);
      const parentsWithTotals = parents.filter(p => (p.proposedBudget || p.totalExpenses || p.totalIncome) && ((p.proposedBudget||0) > 0 || (p.totalExpenses||0)>0 || (p.totalIncome||0)>0));
      results.push({ department: dept, totalProposals: proposals.length, consolidatedParents: parents.length, parentsWithTotals: parentsWithTotals.length });
    } catch (e) {
      results.push({ department: dept, error: e.message });
    }
  }

  console.log('Validation summary:');
  results.forEach(r => console.log(JSON.stringify(r)));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
