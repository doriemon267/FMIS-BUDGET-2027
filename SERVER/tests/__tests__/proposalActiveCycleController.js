jest.mock('../../models/NewProposalWorkflow', () => ({
  findById: jest.fn(),
}));

jest.mock('../../utils/proposalActiveCycle', () => ({
  assertProposalInActiveCycleForProgression: jest.fn(),
}));

const NewProposalWorkflow = require('../../models/NewProposalWorkflow');
const {
  assertProposalInActiveCycleForProgression,
} = require('../../utils/proposalActiveCycle');
const { performAction } = require('../../controllers/newProposalWorkflowController');

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('performAction active-cycle controller boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NewProposalWorkflow.findById.mockResolvedValue({
      _id: 'proposal-1',
      title: 'Inactive-cycle proposal',
      modelType: 'NEP',
      fiscalYear: '2027',
      status: 'DRAFT',
    });
  });

  test.each([
    ['submit-to-reviewer', 'BUDGET_PREPARER'],
    ['submit-to-approver', 'BUDGET_REVIEWER'],
    ['submit-to-analyst', 'BUDGET_APPROVER'],
    ['forward-to-officer', 'BUDGET_PLANNING_ANALYST'],
    ['forward-to-manager', 'BUDGET_OFFICER'],
    ['finalize', 'SUPER_ADMIN'],
  ])(
    'returns 409 before workflow processing for direct %s requests by %s',
    async (action, role) => {
      const cycleError = Object.assign(
        new Error('Proposal does not match the active budget cycle.'),
        { statusCode: 409, code: 'INACTIVE_BUDGET_CYCLE' }
      );
      assertProposalInActiveCycleForProgression.mockRejectedValue(cycleError);
      const req = {
        params: { id: 'proposal-1' },
        body: { action, comment: '' },
        user: { id: `${role}-user`, Roles: [role], role },
      };
      const res = createResponse();

      await performAction(req, res);

      expect(assertProposalInActiveCycleForProgression).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'proposal-1' }),
        action
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INACTIVE_BUDGET_CYCLE',
        })
      );
    }
  );
});
