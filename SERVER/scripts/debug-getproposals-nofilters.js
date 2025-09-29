const mongoose = require('mongoose');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL'); process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const makeRes = () => ({
    status(code) { this._status = code; return this; },
    json(payload) { console.log('RESPONSE totalRecords:', payload.totalRecords || (payload.proposals && payload.proposals.length)); this.payload = payload; }
  });

  const req = {
    query: { _debugFilters: 'true', page: 0, limit: 20 },
    hierarchicalAccessInfo: { scope: 'DEPARTMENT' },
    hierarchicalAccess: { scope: 'DEPARTMENT' },
    submissionWorkflowFilters: {},
    user: { id: '751754', Roles: ['BUDGET_OFFICER'] }
  };

  await proposalController.getProposals(req, makeRes());
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
