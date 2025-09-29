const mongoose = require('mongoose');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) { console.error('Set MONGODB_BUDGET_URL'); process.exit(1); }
  await mongoose.connect(mongoUrl);

  const makeRes = () => ({
    status(code) { this._status = code; return this; },
    json(payload) {
      const proposals = Array.isArray(payload.proposals) ? payload.proposals : (Array.isArray(payload) ? payload : []);
      console.log('RESPONSE totalRecords:', payload.totalRecords || proposals.length);
      console.log('Sample proposals:');
      proposals.slice(0, 10).forEach(p => {
        console.log(JSON.stringify({ _id: String(p._id), status: p.status, proposedBudget: p.proposedBudget, totalIncome: p.totalIncome, totalExpenses: p.totalExpenses, modelType: p.modelType, consolidatedCount: Array.isArray(p.consolidatedProposals)?p.consolidatedProposals.length:0, department: p.department, division: p.division, processBy: p.processBy }));
      });
      this.payload = payload;
    }
  });

  const req = {
    query: { page: 0, limit: 20 },
    hierarchicalAccessInfo: { scope: 'DEPARTMENT' },
    hierarchicalAccess: { scope: 'DEPARTMENT' },
    submissionWorkflowFilters: {},
    user: { id: '751754', Roles: ['BUDGET_OFFICER'] }
  };

  await proposalController.getProposals(req, makeRes());
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
