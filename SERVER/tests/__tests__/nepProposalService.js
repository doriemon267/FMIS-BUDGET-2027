jest.mock('../../models/Income', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/PersonnelServices', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/MooeProposal', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/CapitalOutlay', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/CapitalOutlayDetails', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));
jest.mock('../../models/Proposal', () => ({ find: jest.fn() }));
jest.mock('../../models/HierarchicalUserAssignment', () => ({ find: jest.fn() }));

const Income = require('../../models/Income');
const PersonnelServices = require('../../models/PersonnelServices');
const MooeProposal = require('../../models/MooeProposal');
const CapitalOutlay = require('../../models/CapitalOutlay');
const CapitalOutlayDetails = require('../../models/CapitalOutlayDetails');
const Proposal = require('../../models/Proposal');
const HierarchicalUserAssignment = require('../../models/HierarchicalUserAssignment');
const {
  cleanupGeneratedNepData,
  normalizeNepGenerationMode,
  buildNepGenerationAssignment,
  resolvePreparerAssignments,
  cloneProposalLineItems
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

  test('treats a consolidated region label as a group, not a real division', async () => {
    const assignmentQuery = {
      populate: jest.fn(),
      lean: jest.fn().mockResolvedValue([
        {
          userId: 'prep-1',
          userName: 'Regional Preparer',
          userRole: 'BUDGET_PREPARER',
          workflowRoles: ['BUDGET_PREPARER'],
          divisionName: 'DIVISION 1',
          departmentId: { Department: 'IRRIGATION MANAGEMENT OFFICE' },
          regionId: { Region: 'REGION IV-A' }
        }
      ])
    };
    assignmentQuery.populate.mockReturnValue(assignmentQuery);
    HierarchicalUserAssignment.find.mockReturnValue(assignmentQuery);

    const preparers = await resolvePreparerAssignments({
      initialProposals: [{ createdBy: 'approver-1', createdByName: 'Approver' }],
      allocation: {
        division: 'REGION IV-A (Consolidated)',
        department: 'IRRIGATION MANAGEMENT OFFICE'
      },
      ceilingRegion: 'REGION IV-A'
    });

    expect(preparers).toEqual([
      { userId: 'prep-1', userName: 'Regional Preparer' }
    ]);
  });
});

describe('generated NEP line-item cloning', () => {
  test('captures the Personnel Services baseline and initial funding split', async () => {
    const emptyFind = () => ({ lean: jest.fn().mockResolvedValue([]) });
    Proposal.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
    });
    Income.find.mockReturnValue(emptyFind());
    PersonnelServices.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'personnel-source-1',
          annualSalary: 120000,
          PERA: 24000,
          chargedToIncomeAmount: 30000
        }
      ])
    });
    MooeProposal.find.mockReturnValue(emptyFind());
    CapitalOutlay.find.mockReturnValue(emptyFind());
    Income.insertMany.mockResolvedValue([]);
    PersonnelServices.insertMany.mockImplementation(async docs => docs);
    MooeProposal.insertMany.mockResolvedValue([]);
    CapitalOutlay.insertMany.mockResolvedValue([]);

    await cloneProposalLineItems({
      initialProposals: [{ _id: 'workflow-initial-1' }],
      targetWorkflowId: 'workflow-nep-1',
      targetLegacyProposalId: 'legacy-nep-1',
      fiscalYear: 2027,
      regionName: 'REGION IV-A',
      department: 'IRRIGATION MANAGEMENT OFFICE',
      division: 'REGION IV-A (Consolidated)',
      preparer: { userId: 'prep-1', userName: 'Regional Preparer' },
      workflowAssignment: {}
    });

    const cloned = PersonnelServices.insertMany.mock.calls[0][0][0];
    expect(cloned.nepInitialValues).toMatchObject({ annualSalary: 120000, PERA: 24000 });
    expect(cloned.nepInitialAllocations).toMatchObject({
      annualSalary: { income: 30000, subsidy: 90000 },
      PERA: { income: 0, subsidy: 24000 }
    });
    expect(cloned.nepAllocations).toEqual(cloned.nepInitialAllocations);
  });

  test('merges duplicate Capital Outlay parent accounts before insert', async () => {
    const emptyFind = () => ({ lean: jest.fn().mockResolvedValue([]) });
    Proposal.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
    });
    Income.find.mockReturnValue(emptyFind());
    PersonnelServices.find.mockReturnValue(emptyFind());
    MooeProposal.find.mockReturnValue(emptyFind());
    Income.insertMany.mockResolvedValue([]);
    PersonnelServices.insertMany.mockResolvedValue([]);
    MooeProposal.insertMany.mockResolvedValue([]);

    const duplicateRows = [
      {
        _id: 'capital-source-1',
        uacsCode: '1-04-06-010',
        sublineItem: 'Semi-Expendable Machinery and Equipment',
        category: 'category-1',
        cost: 100,
        income: 40,
        subsidy: 60
      },
      {
        _id: 'capital-source-2',
        uacsCode: '1-04-06-010',
        sublineItem: 'Semi-Expendable Machinery and Equipment',
        category: 'category-1',
        cost: 250,
        income: 50,
        subsidy: 200
      }
    ];
    CapitalOutlay.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(duplicateRows) });
    CapitalOutlay.insertMany.mockImplementation(async docs =>
      docs.map((doc, index) => ({ ...doc, _id: `capital-target-${index + 1}` }))
    );
    CapitalOutlayDetails.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const counts = await cloneProposalLineItems({
      initialProposals: [{ _id: 'workflow-initial-1' }],
      targetWorkflowId: 'workflow-nep-1',
      targetLegacyProposalId: 'legacy-nep-1',
      fiscalYear: 2027,
      regionName: 'REGION IV-A',
      department: 'IRRIGATION MANAGEMENT OFFICE',
      division: 'REGION IV-A (Consolidated)',
      preparer: { userId: 'prep-1', userName: 'Regional Preparer' },
      workflowAssignment: {}
    });

    expect(CapitalOutlay.insertMany).toHaveBeenCalledTimes(1);
    expect(CapitalOutlay.insertMany.mock.calls[0][0]).toHaveLength(1);
    expect(CapitalOutlay.insertMany.mock.calls[0][0][0]).toMatchObject({
      cost: 350,
      income: 90,
      subsidy: 260
    });
    expect(counts.CapitalOutlay).toBe(1);
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
