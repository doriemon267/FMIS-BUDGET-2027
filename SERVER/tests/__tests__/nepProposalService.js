jest.mock('../../models/Income', () => ({ deleteMany: jest.fn() }));
jest.mock('../../models/PersonnelServices', () => ({ deleteMany: jest.fn() }));
jest.mock('../../models/mooeProposals', () => ({ deleteMany: jest.fn() }));
jest.mock('../../models/CapitalOutlay', () => ({
  find: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/CapitalOutlayDetails', () => ({ deleteMany: jest.fn() }));
jest.mock('../../models/Proposal', () => ({}));
jest.mock('../../models/HierarchicalUserAssignment', () => ({}));

const Income = require('../../models/Income');
const PersonnelServices = require('../../models/PersonnelServices');
const MooeProposal = require('../../models/mooeProposals');
const CapitalOutlay = require('../../models/CapitalOutlay');
const CapitalOutlayDetails = require('../../models/CapitalOutlayDetails');
const { cleanupGeneratedNepData } = require('../../services/nepProposalService');

describe('generated NEP clone cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CapitalOutlay.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
  });

  test('uses only defined proposal identifiers in cleanup filters', async () => {
    await cleanupGeneratedNepData({ workflowId: 'workflow-1' });

    expect(CapitalOutlay.find).toHaveBeenCalledWith({ workflowRef: 'workflow-1' });
    expect(Income.deleteMany).toHaveBeenCalledWith({ workflowRef: 'workflow-1' });
    expect(PersonnelServices.deleteMany).toHaveBeenCalledWith({ workflowRef: 'workflow-1' });
    expect(MooeProposal.deleteMany).toHaveBeenCalledWith({ workflowRef: 'workflow-1' });
    expect(CapitalOutlay.deleteMany).toHaveBeenCalledWith({ workflowRef: 'workflow-1' });
    expect(CapitalOutlayDetails.deleteMany).not.toHaveBeenCalled();
  });

  test('does not issue a delete when both identifiers are missing', async () => {
    await cleanupGeneratedNepData({});

    expect(CapitalOutlay.find).not.toHaveBeenCalled();
    expect(Income.deleteMany).not.toHaveBeenCalled();
    expect(CapitalOutlay.deleteMany).not.toHaveBeenCalled();
  });
});
