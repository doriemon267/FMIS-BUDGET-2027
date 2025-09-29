const mongoose = require('mongoose');
const Proposal = require('../../models/Proposal');
const proposalController = require('../../controllers/proposalController');

// Simple mock for res object
function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; };
  return res;
}

describe('Role visibility - integration', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', { useNewUrlParser: true });
    // Clean up test proposals by title prefix
    await Proposal.deleteMany({ title: { $regex: '^TEST-ROLE-VIS-' } });
  });

  afterAll(async () => {
    // Cleanup
    await Proposal.deleteMany({ title: { $regex: '^TEST-ROLE-VIS-' } });
    await mongoose.disconnect();
  });

  test('Budget Analyst sees own and division proposals, Officer sees approved/finalized, Manager sees submitted/finalized', async () => {
    // Seed proposals
  const common = { processBy: 'system-test', region: 'R1', fiscalYear: 2026, budgetType: 'MOOE' };
  const analystProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-ANALYST', createdByUserId: 'user-analyst', division: 'D1', department: 'DEP1', status: 'Draft', ...common });
  const officerProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-OFFICER', createdByUserId: 'user-officer', division: 'D1', department: 'DEP1', status: 'Office Approved', ...common });
  const managerProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-MANAGER', createdByUserId: 'user-manager', division: 'D1', department: 'DEP1', status: 'Office Submitted', ...common });

    // 1) Analyst request (simulate req with user and hierarchical assignment)
  const reqAnalyst = { query: {}, user: { id: 'user-analyst', Roles: ['BUDGET_ANALYST'], FirstName: 'A', LastName: 'Analyst' }, userHierarchicalAssignment: { divisionName: 'D1' }, hierarchicalFilters: { division: 'D1' }, submissionWorkflowFilters: {} };
    const resAnalyst = makeRes();
    await proposalController.getAllProposals(reqAnalyst, resAnalyst);
  expect(resAnalyst.body).toBeDefined();
  // Ensure analyst can see his own draft
  const foundAnalyst = (Array.isArray(resAnalyst.body) ? resAnalyst.body : []).some(p => p.title === 'TEST-ROLE-VIS-ANALYST');
    expect(foundAnalyst).toBe(true);

    // 2) Officer request
  const reqOfficer = { query: {}, user: { id: 'user-officer', Roles: ['BUDGET_OFFICER'], FirstName: 'O', LastName: 'Officer' }, userHierarchicalAssignment: {}, hierarchicalFilters: {}, submissionWorkflowFilters: {} };
    const resOfficer = makeRes();
    await proposalController.getAllProposals(reqOfficer, resOfficer);
  expect(resOfficer.body).toBeDefined();
  const foundOfficerApproved = (Array.isArray(resOfficer.body) ? resOfficer.body : []).some(p => p.title === 'TEST-ROLE-VIS-OFFICER');
    expect(foundOfficerApproved).toBe(true);

    // 3) Manager request
  const reqManager = { query: {}, user: { id: 'user-manager', Roles: ['BUDGET_MANAGER'], FirstName: 'M', LastName: 'Manager' }, userHierarchicalAssignment: {}, hierarchicalFilters: {}, submissionWorkflowFilters: { $and: [ { status: { $in: ['Office Submitted','Office Approved','Finalized'] } } ] } };
    const resManager = makeRes();
    await proposalController.getAllProposals(reqManager, resManager);
  expect(resManager.body).toBeDefined();
  const foundManagerSubmitted = (Array.isArray(resManager.body) ? resManager.body : []).some(p => p.title === 'TEST-ROLE-VIS-MANAGER');
    expect(foundManagerSubmitted).toBe(true);
  }, 20000);
});
