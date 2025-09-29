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
      const zeroRows = proposals.filter(p => {
        const pb = p.proposedBudget || 0;
        const ti = p.totalIncome || 0;
        const te = p.totalExpenses || 0;
        return (pb === 0 && ti === 0 && te === 0);
      });
      console.log('Rows with zero financial fields in response:', zeroRows.length);
      zeroRows.slice(0, 50).forEach(p => {
        console.log(JSON.stringify({ _id: String(p._id || p.id || 'n/a'), modelType: p.modelType || 'n/a', proposedBudget: p.proposedBudget, totalIncome: p.totalIncome, totalExpenses: p.totalExpenses, Total: p.Total, title: p.title, cobExpenditures: p.cobExpenditures, department: p.department, division: p.division }));
      });
      this.payload = payload;
    }
  });

  const req = {
    query: { page: 0, limit: 50 },
    hierarchicalAccessInfo: { scope: 'DEPARTMENT' },
    hierarchicalAccess: { scope: 'DEPARTMENT' },
    submissionWorkflowFilters: {},
    user: { id: '751754', Roles: ['BUDGET_OFFICER'] }
  };

  await proposalController.getProposals(req, makeRes());
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
