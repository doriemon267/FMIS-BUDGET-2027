const mongoose = require('mongoose');
const proposalController = require('../controllers/proposalController');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  // Mock response object
  const makeRes = () => {
    return {
      status(code) { this._status = code; return this; },
      json(payload) { console.log('RESPONSE JSON:', JSON.stringify(payload, null, 2)); return this; },
      send(payload) { console.log('RESPONSE SEND:', payload); return this; }
    };
  };

  // Analyst (no special edit perms)
  const reqAnalyst = { user: { id: 'u-analyst', role: 'BUDGET_ANALYST' }, query: {} };
  console.log('\n--- Analyst view ---');
  await proposalController.getAllProposals(reqAnalyst, makeRes());

  // Officer (Budget Officer)
  const reqOfficer = { user: { id: 'u-officer', role: 'BUDGET_COORDINATOR' }, query: {} };
  console.log('\n--- Officer view ---');
  await proposalController.getAllProposals(reqOfficer, makeRes());

  // Manager (Budget Manager) - simulate role
  const reqManager = { user: { id: 'u-manager', role: 'BUDGET_MANAGER' }, query: {} };
  console.log('\n--- Manager view ---');
  await proposalController.getAllProposals(reqManager, makeRes());

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
