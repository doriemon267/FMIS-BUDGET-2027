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
const {
  cleanupGeneratedNepData,
  normalizeNepGenerationMode,
  buildNepGenerationAssignment
} = require('../../services/nepProposalService');

describe('NEP generation workflow assignment', () => {
  test('routes BRD direct adjustment to the Budget Planning Analyst without preparer ownership', () => {
    const assignment = buildNepGenerationAssignment({
      generationMode: 'BRD',
      brdUser: { userId: 'brd-1', userName: 'BRD Officer' }
    });

    expect(assignment).toMatchObject({
      generationMode: 'BRD',
      workflowStatus: 'FORWARDED_TO_BRD_ANALYST',
      currentAssigneeRole: 'BUDGET PLANNING ANALYST',
      legacyStatus: 'Forwarded to Budget Planning Analyst',
      legacyWorkflowLevel: 'BUDGET_PLANNING_ANALYST',
      assignedPreparerUserIds: [],
      assignedPreparerNames: []
    });
    expect(assignment.editor).toEqual({ userId: 'brd-1', userName: 'BRD Officer' });
  });

  test('keeps Budget Preparer generation as the default workflow', () => {
    const preparers = [
      { userId: 'prep-1', userName: 'Primary Preparer' },
      { userId: 'prep-2', userName: 'Backup Preparer' }
    ];
    const assignment = buildNepGenerationAssignment({
      generationMode: normalizeNepGenerationMode('unsupported-value'),
      preparers
    });

    expect(assignment).toMatchObject({
      generationMode: 'PREPARER',
      workflowStatus: 'DRAFT',
      currentAssigneeRole: 'BUDGET PREPARER',
      legacyStatus: 'Draft',
      assignedPreparerUserIds: ['prep-1', 'prep-2'],
      assignedPreparerNames: ['Primary Preparer', 'Backup Preparer']
    });
    expect(assignment.editor).toEqual(preparers[0]);
  });
});

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
