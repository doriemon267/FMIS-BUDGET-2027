const proposalController = require('../controllers/proposalController');

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; };
  return res;
}

/**
 * Unit test to validate getAllUserProposals always returns a scope string
 * even when req.budgetRoleVisibilityFilter is used.
 */
describe('getAllUserProposals response contains scope', () => {
  test('sets scope from ROLE_FILTER when role filter present', async () => {
    const req = {
      query: { processBy: 'unit-test', region: 'CO' },
      budgetRoleVisibilityFilter: { status: { $in: ['Officer Approved', 'Finalized'] } },
      hierarchicalAccessInfo: undefined,
    };
    const res = makeRes();

    // Mock model calls to avoid DB usage
    const originalFind = {};
    const models = ['PersonnelServices','mooeProposals','CapitalOutlay','Income','DraftProposal','BudgetarySupport'];
    models.forEach(name => {
      try {
        const m = require(`../models/${name}`);
        originalFind[name] = m.find;
        m.find = () => ({ sort: () => ({}) });
      } catch (e) {}
    });

    await proposalController.getAllUserProposals(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(typeof res.body.scope).toBe('string');
    expect(res.body.scope.length).toBeGreaterThan(0);

    // Restore
    models.forEach(name => {
      try {
        const m = require(`../models/${name}`);
        if (originalFind[name]) m.find = originalFind[name];
      } catch (e) {}
    });
  });
});
