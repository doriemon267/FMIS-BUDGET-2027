(async () => {
  try {
    process.env.MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget';
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL, { useNewUrlParser: true });
    const proposalController = require('../controllers/proposalController');

    const makeRes = () => {
      const res = {};
      res.status = (code) => { res._status = code; return res; };
      res.json = (obj) => { console.log('=== RESPONSE ==='); console.log(JSON.stringify(obj, null, 2)); };
      return res;
    };

    const req = {
      query: { page: 0, limit: 10 },
      hierarchicalAccessInfo: { scope: 'DEPARTMENT' },
      hierarchicalAccess: { scope: 'DEPARTMENT' },
      submissionWorkflowFilters: {},
      hierarchicalFilters: { department: 'CORPORATE PLANNING SERVICES' }
    };

    const res = makeRes();
    console.log('Calling getProposals (before includeFinalized)');
    await proposalController.getProposals(req, res);

    req.query.includeFinalized = 'true';
    console.log('\nCalling getProposals (with includeFinalized=true)');
    await proposalController.getProposals(req, res);

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();