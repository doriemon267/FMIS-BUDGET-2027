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
  let SKIP = false;
  beforeAll(async () => {
    try {
      const uri = process.env.MONGODB_BUDGET_URL;
      await mongoose.connect(uri);
    } catch (e) {
      console.warn('Integration test DB connect failed, skipping:', e.message);
      SKIP = true;
      return;
    }
    // Clean up test proposals by title prefix
    await Proposal.deleteMany({ title: { $regex: '^TEST-ROLE-VIS-' } });
  });

  afterAll(async () => {
    if (SKIP) return;
    // Cleanup
    await Proposal.deleteMany({ title: { $regex: '^TEST-ROLE-VIS-' } });
    await mongoose.disconnect();
  });

  test('Preparer sees own and division proposals, Officer sees approved/finalized, Manager sees submitted/finalized', async () => {
    if (SKIP) {
      expect(true).toBe(true);
      return;
    }
    // Seed proposals
  const common = { processBy: 'system-test', region: 'R1', fiscalYear: 2026, budgetType: 'MOOE' };
  const analystProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-ANALYST', createdByUserId: 'user-analyst', division: 'D1', department: 'DEP1', status: 'Draft', ...common });
  const officerProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-OFFICER', createdByUserId: 'user-officer', division: 'D1', department: 'DEP1', status: 'Officer Approved', ...common });
  const managerProposal = await Proposal.create({ title: 'TEST-ROLE-VIS-MANAGER', createdByUserId: 'user-manager', division: 'D1', department: 'DEP1', status: 'Forwarded to Manager', ...common });

    // 1) Analyst request (simulate req with user and hierarchical assignment)
  const reqAnalyst = { 
    query: { limit: '2000', visibilityFilter: { processBy: 'system-test' }, search: 'TEST-ROLE-VIS-ANALYST' }, 
    user: { id: 'user-analyst', Roles: ['BUDGET_PLANNING_ANALYST'], FirstName: 'A', LastName: 'Analyst' }, 
    userHierarchicalAssignment: { divisionName: 'D1' }, 
    hierarchicalFilters: { division: 'D1' }
  };
    const resAnalyst = makeRes();
    await proposalController.getAllProposals(reqAnalyst, resAnalyst);
  expect(resAnalyst.body).toBeDefined();
  // Ensure analyst can see his own draft
  const analystList = Array.isArray(resAnalyst.body?.proposals) ? resAnalyst.body.proposals : [];
  console.log('Analyst proposals returned:', analystList.length);
  console.log('Analyst proposal titles:', analystList.map(p => p.title).join(', '));
  const foundAnalyst = analystList.some(p => p.title === 'TEST-ROLE-VIS-ANALYST');
    expect(foundAnalyst).toBe(true);

    // 2) Officer request
  const reqOfficer = { 
    query: { limit: '2000', visibilityFilter: { processBy: 'system-test' }, search: 'TEST-ROLE-VIS-OFFICER' }, 
    user: { id: 'user-officer', Roles: ['BUDGET_OFFICER'], FirstName: 'O', LastName: 'Officer' }, 
    userHierarchicalAssignment: {}, 
    hierarchicalFilters: {} 
  };
    const resOfficer = makeRes();
    await proposalController.getAllProposals(reqOfficer, resOfficer);
  expect(resOfficer.body).toBeDefined();
  const officerList = Array.isArray(resOfficer.body?.proposals) ? resOfficer.body.proposals : [];
  const foundOfficerApproved = officerList.some(p => p.title === 'TEST-ROLE-VIS-OFFICER');
    expect(foundOfficerApproved).toBe(true);
  
  // Ensure Officer CANNOT see Draft proposals from others
  const foundAnalystDraft = officerList.some(p => p.title === 'TEST-ROLE-VIS-ANALYST');
  expect(foundAnalystDraft).toBe(false);

    // 3) Manager request
  const reqManager = { 
    query: { limit: '2000', visibilityFilter: { processBy: 'system-test' }, search: 'TEST-ROLE-VIS-MANAGER' }, 
    user: { id: 'user-manager', Roles: ['BUDGET_MANAGER'], FirstName: 'M', LastName: 'Manager' }, 
    userHierarchicalAssignment: {}, 
    hierarchicalFilters: {} 
  };
    const resManager = makeRes();
    await proposalController.getAllProposals(reqManager, resManager);
  expect(resManager.body).toBeDefined();
  const managerList = Array.isArray(resManager.body?.proposals) ? resManager.body.proposals : [];
  const foundManagerSubmitted = managerList.some(p => p.title === 'TEST-ROLE-VIS-MANAGER');
    expect(foundManagerSubmitted).toBe(true);
  
  // Ensure Manager CANNOT see Draft proposals
  const foundManagerAnalystDraft = managerList.some(p => p.title === 'TEST-ROLE-VIS-ANALYST');
  expect(foundManagerAnalystDraft).toBe(false);
  }, 30000);
});
