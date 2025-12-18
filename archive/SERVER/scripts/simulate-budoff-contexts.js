const mongoose = require('mongoose');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) { console.error('Set MONGODB_BUDGET_URL'); process.exit(1); }
  await mongoose.connect(mongoUrl);

  const makeRes = (label) => ({
    status(code) { this._status = code; return this; },
    json(payload) {
      const proposals = Array.isArray(payload.proposals) ? payload.proposals : (Array.isArray(payload) ? payload : []);
      console.log(`--- ${label} -> totalRecords: ${payload.totalRecords || proposals.length} (returned ${proposals.length})`);
      if (proposals.length) {
        const p = proposals[0];
        console.log(' Sample:', JSON.stringify({ _id: String(p._id), status: p.status, proposedBudget: p.proposedBudget, totalIncome: p.totalIncome, totalExpenses: p.totalExpenses, department: p.department, division: p.division, processBy: p.processBy }));
      }
      this.payload = payload;
    }
  });

  const user = { id: '751754', Roles: ['BUDGET_OFFICER'] };

  const contexts = [
    { label: 'NO_FILTERS', req: { query: { page: 0, limit: 20 }, hierarchicalAccessInfo: { scope: 'FULL' }, hierarchicalAccess: { scope: 'FULL' }, submissionWorkflowFilters: {}, user } },
    { label: 'DEPARTMENT_FILTER', req: { query: { _debugFilters: 'true', page: 0, limit: 20 }, hierarchicalFilters: { department: 'CORPORATE PLANNING SERVICES' }, hierarchicalAccessInfo: { scope: 'DEPARTMENT' }, hierarchicalAccess: { scope: 'DEPARTMENT' }, submissionWorkflowFilters: {}, user } },
    { label: 'OFFICE_FILTER', req: { query: { _debugFilters: 'true', page: 0, limit: 20 }, hierarchicalFilters: { office: 'CORPORATE PLANNING SERVICES' }, hierarchicalAccessInfo: { scope: 'OFFICE' }, hierarchicalAccess: { scope: 'OFFICE' }, submissionWorkflowFilters: {}, user } },
    { label: 'RESPONSIBILITY_CENTER_FILTER', req: { query: { _debugFilters: 'true', page: 0, limit: 20 }, hierarchicalFilters: { office: 'CORPORATE PLANNING SERVICES' }, hierarchicalAccessInfo: { scope: 'RESPONSIBILITY_CENTER' }, hierarchicalAccess: { scope: 'RESPONSIBILITY_CENTER' }, submissionWorkflowFilters: {}, user } },
    { label: 'DIVISION_FILTER', req: { query: { _debugFilters: 'true', page: 0, limit: 20 }, hierarchicalFilters: { division: 'MANAGEMENT INFORMATION DIVISION' }, hierarchicalAccessInfo: { scope: 'DIVISION' }, hierarchicalAccess: { scope: 'DIVISION' }, submissionWorkflowFilters: {}, user: { id: '68da2c3bdbec701300816331', Roles: ['BUDGET_ANALYST'] } } }
  ];

  for (const c of contexts) {
    try {
      await proposalController.getProposals(c.req, makeRes(c.label));
    } catch (e) {
      console.error(`Error for ${c.label}:`, e.message || e);
    }
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
