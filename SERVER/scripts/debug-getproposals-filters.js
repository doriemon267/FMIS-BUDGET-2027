const mongoose = require('mongoose');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL'); process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const makeRes = () => {
    return {
      status(code) { this._status = code; return this; },
      json(payload) { console.log('RESPONSE LENGTH:', Array.isArray(payload.proposals) ? payload.proposals.length : (payload.totalRecords||0)); this.payload = payload; }
    };
  };

  // Simulate the same hierarchicalFilters the UI uses (department scope)
  const req = {
    query: { _debugFilters: 'true', page: 0, limit: 10 },
    hierarchicalFilters: { department: 'CORPORATE PLANNING SERVICES' },
    hierarchicalAccessInfo: { scope: 'DEPARTMENT' },
    hierarchicalAccess: { scope: 'DEPARTMENT' },
    submissionWorkflowFilters: {},
    user: { id: '751754', Roles: ['BUDGET_OFFICER'] }
  };

  await proposalController.getProposals(req, makeRes());
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
