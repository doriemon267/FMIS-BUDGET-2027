const express = require('express');
const router = express.Router();
const BudgetCeiling = require('../models/BudgetCeiling');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
const mongoose = require('mongoose');
const {
  NEP_GENERATION_MODES,
  normalizeNepGenerationMode,
  buildNepGenerationAssignment,
  resolvePreparerAssignments,
  cloneProposalLineItems,
  cleanupGeneratedNepData
} = require('../services/nepProposalService');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const {
  getNepCeilingContext,
  serializeNepCeilingContext
} = require('../services/nepCeilingService');
/**
 * Budget Ceiling Management Routes
 * 
 * Used by BRD (Budget Officer, Budget Manager) to:
 * 1. View consolidated finalized Initial proposals
 * 2. Set budget ceilings per division/department
 * 3. Generate NEP proposals from Initial proposals
 */

// Middleware to check if user is BRD staff (Officer, Manager, or Super Admin)
const isBRDStaff = (req, res, next) => {
  const userRoles = (req.user?.Roles || []).map(String);
  const allowedRoles = [
    'BUDGET_OFFICER', 'BUDGET OFFICER',
    'BUDGET_MANAGER', 'BUDGET MANAGER',
    'SUPER_ADMIN', 'SUPER ADMIN'
  ];
  const isSuperAdmin = userRoles.some((r) => /SUPER\s*ADMIN/i.test(r.replace(/\s/g, ' ')));
  const hasAccess =
    isSuperAdmin || userRoles.some((role) => allowedRoles.includes(role));
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Budget Officer, Budget Manager, or Super Admin can manage ceilings.'
    });
  }
  next();
};

/**
 * GET /api/budget-ceiling/finalized-initial
 * Get all finalized Initial proposals for a region (for ceiling setting)
 */
router.get('/finalized-initial', isAuth, isBRDStaff, async (req, res) => {
  try {
    const { region, fiscalYear } = req.query;

    if (!region) {
      return res.status(400).json({
        success: false,
        message: 'Region parameter is required'
      });
    }

    // Build query for finalized Initial proposals
    const query = {
      modelType: 'Initial',
      status: { $in: ['FINALIZED', 'Finalized'] }
    };

    // Handle region - could be ObjectId or string
    if (mongoose.Types.ObjectId.isValid(region)) {
      query.region = new mongoose.Types.ObjectId(region);
    } else {
      // Try to find region by name
      const Region = require('../models/Region');
      const regionDoc = await Region.findOne({
        $or: [
          { regionName: region },
          { Region: region },
          { name: region }
        ]
      });
      if (regionDoc) {
        query.region = regionDoc._id;
      }
    }

    if (fiscalYear) {
      query.fiscalYear = parseInt(fiscalYear);
    }

    const proposals = await NewProposalWorkflow.find(query)
      .sort({ division: 1, department: 1 })
      .lean();

    // Group by division/department
    const grouped = {};
    proposals.forEach(p => {
      const key = p.division || p.department || 'Unassigned';
      if (!grouped[key]) {
        grouped[key] = {
          division: p.division,
          department: p.department,
          proposals: [],
          totalAmount: 0,
          totalSubsidy: 0,
          totalIncome: 0
        };
      }
      grouped[key].proposals.push(p);
      grouped[key].totalAmount += p.amount || p.proposedBudget || 0;
      grouped[key].totalSubsidy += p.projectedSubsidy || 0;
      grouped[key].totalIncome += p.projectedCorporateIncome || 0;
    });

    res.json({
      success: true,
      data: {
        proposals,
        grouped: Object.values(grouped),
        summary: {
          totalProposals: proposals.length,
          totalAmount: proposals.reduce((sum, p) => sum + (p.amount || p.proposedBudget || 0), 0),
          totalSubsidy: proposals.reduce((sum, p) => sum + (p.projectedSubsidy || 0), 0),
          totalIncome: proposals.reduce((sum, p) => sum + (p.projectedCorporateIncome || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching finalized Initial proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finalized proposals',
      error: error.message
    });
  }
});

/**
 * GET /api/budget-ceiling/proposal/:proposalId
 * Return only the allocation linked to a specific NEP proposal. This avoids
 * exposing the other divisions' ceilings to the proposal workbench.
 */
router.get('/proposal/:proposalId', isAuth, async (req, res) => {
  try {
    const context = await getNepCeilingContext({
      proposalId: req.params.proposalId,
      recalculate: true
    });

    if (!context) {
      return res.status(400).json({
        success: false,
        message: 'Ceiling context is only available for NEP proposals'
      });
    }

    const userId = String(req.user?.id || req.user?._id || req.user?.UserId || '');
    const rawRoles = Array.isArray(req.user?.Roles)
      ? req.user.Roles
      : [req.user?.Roles].filter(Boolean);

    // Normalize roles to handle variations (e.g. "Budget Preparer" -> "BUDGET_PREPARER")
    const normalizedRoles = rawRoles.map(role =>
      String(role).toUpperCase().trim().replace(/\s+/g, '_')
    );

    const isPrivilegedWorkflowUser = normalizedRoles.some(role => [
      'PREPARER',
      'BUDGET_PREPARER',
      'BUDGET_REVIEWER',
      'BUDGET_APPROVER',
      'BUDGET_PLANNING_ANALYST',
      'BUDGET_OFFICER',
      'BUDGET_MANAGER',
      'OVERALL_BUDGET_APPROVER',
      'SUPER_ADMIN'
    ].includes(role));
    const isAssignedPreparer = (context.proposal.assignedPreparerUserIds || [])
      .some(assignedId => String(assignedId) === userId);
    const isCreator = String(context.proposal.createdBy || '') === userId;

    if (!isPrivilegedWorkflowUser && !isAssignedPreparer && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this NEP ceiling allocation'
      });
    }

    return res.json({
      success: true,
      data: serializeNepCeilingContext(context)
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }
});

/**
 * GET /api/budget-ceiling/:fiscalYear/:region
 * Get budget ceiling for specific fiscal year and region
 */
router.get('/:fiscalYear/:region', isAuth, async (req, res) => {
  try {
    const { fiscalYear, region } = req.params;
    const { budgetPhase = 'NEP' } = req.query;

    const ceiling = await BudgetCeiling.findOne({
      fiscalYear: parseInt(fiscalYear),
      region: decodeURIComponent(region),
      budgetPhase
    }).lean();

    if (!ceiling) {
      return res.json({
        success: true,
        data: null,
        message: 'No ceiling found for this fiscal year and region'
      });
    }

    res.json({
      success: true,
      data: ceiling
    });
  } catch (error) {
    console.error('Error fetching budget ceiling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget ceiling',
      error: error.message
    });
  }
});

/**
 * POST /api/budget-ceiling/initialize
 * Initialize ceiling from finalized Initial proposals
 */
router.post('/initialize', isAuth, isBRDStaff, requireDynamicPermission('/nep-ceiling'), async (req, res) => {
  try {
    const { fiscalYear, region, budgetPhase = 'NEP', totalBudgetPool = 0 } = req.body;
    const user = req.user;

    if (!fiscalYear || !region) {
      return res.status(400).json({
        success: false,
        message: 'Fiscal year and region are required'
      });
    }

    // Check if ceiling already exists
    let ceiling = await BudgetCeiling.findOne({
      fiscalYear: parseInt(fiscalYear),
      region,
      budgetPhase
    });

    if (ceiling && ceiling.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Ceiling already exists and is not in Draft status'
      });
    }

    // Get finalized Initial proposals for this region
    const query = {
      modelType: 'Initial',
      status: { $in: ['FINALIZED', 'Finalized'] },
      fiscalYear: parseInt(fiscalYear)
    };

    // Handle region lookup
    if (mongoose.Types.ObjectId.isValid(region)) {
      query.region = new mongoose.Types.ObjectId(region);
    } else {
      const Region = require('../models/Region');
      const regionDoc = await Region.findOne({
        $or: [
          { regionName: region },
          { Region: region },
          { name: region }
        ]
      });
      if (regionDoc) {
        query.region = regionDoc._id;
      }
    }

    const proposals = await NewProposalWorkflow.find(query).lean();

    if (proposals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No finalized Initial proposals found for this region and fiscal year'
      });
    }

    const proposalIds = proposals.map(p => p._id);
    const legacyInitialProposals = await Proposal.find({
      $or: [
        { workflowRef: { $in: proposalIds } },
        { proposalId: { $in: proposalIds } }
      ]
    }).select('_id workflowRef proposalId').lean();
    const sourceLineProposalIds = [
      ...proposalIds,
      ...legacyInitialProposals.map(proposal => proposal._id)
    ];
    const sourceWorkflowIdByAnyId = new Map(
      proposalIds.map(proposalId => [String(proposalId), String(proposalId)])
    );
    legacyInitialProposals.forEach(legacyProposal => {
      const workflowId = legacyProposal.workflowRef || legacyProposal.proposalId;
      if (workflowId) {
        sourceWorkflowIdByAnyId.set(String(legacyProposal._id), String(workflowId));
      }
    });
    
    // Fetch breakdown data using both proposalId (legacy) and workflowRef (new)
    const [personnelData, mooeData, capitalData] = await Promise.all([
      PersonnelService.find({ $or: [{ proposalId: { $in: sourceLineProposalIds } }, { workflowRef: { $in: proposalIds } }] }).lean(),
      MooeProposal.find({ $or: [{ proposalId: { $in: sourceLineProposalIds } }, { workflowRef: { $in: proposalIds } }] }).lean(),
      CapitalOutlay.find({ $or: [{ proposalId: { $in: sourceLineProposalIds } }, { workflowRef: { $in: proposalIds } }] }).lean()
    ]);

    // Group proposals by division
    const divisionMap = {};
    proposals.forEach(p => {
      const key = p.division || p.department || 'Unassigned';
      if (!divisionMap[key]) {
        let defaultDivision = p.division;
        if (key === 'Unassigned') {
          const rName = typeof regionDoc !== 'undefined' && regionDoc ? regionDoc.regionName : region;
          defaultDivision = `${rName} (Consolidated)`;
        }
        divisionMap[key] = {
          division: defaultDivision,
          department: p.department,
          proposals: [],
          totalAmount: 0,
          totalSubsidy: 0,
          totalIncome: 0,
          totalPS: 0,
          totalMOOE: 0,
          totalCO: 0
        };
      }
      divisionMap[key].proposals.push(p);
      divisionMap[key].totalAmount += p.amount || p.proposedBudget || 0;
      divisionMap[key].totalSubsidy += p.projectedSubsidy || 0;
      divisionMap[key].totalIncome += p.projectedCorporateIncome || 0;

    });

    // Aggregate expense class breakdowns from linked collections
    const linkedPersonnelWorkflowIds = new Set();
    const linkedMooeWorkflowIds = new Set();
    const linkedCapitalWorkflowIds = new Set();
    const resolveSourceProposal = item => {
      const rawId = item.workflowRef || item.proposalId;
      if (!rawId) return null;
      const workflowId = sourceWorkflowIdByAnyId.get(String(rawId)) || String(rawId);
      return proposals.find(proposal => String(proposal._id) === workflowId) || null;
    };

    personnelData.forEach(item => {
      const p = resolveSourceProposal(item);
      if (p) {
        const key = p.division || p.department || 'Unassigned';
        divisionMap[key].totalPS += Number(item.Total ?? item.total) || 0;
        linkedPersonnelWorkflowIds.add(String(p._id));
      }
    });

    mooeData.forEach(item => {
      const p = resolveSourceProposal(item);
      if (p) {
        const key = p.division || p.department || 'Unassigned';
        divisionMap[key].totalMOOE += Number(item.amount) || 0;
        linkedMooeWorkflowIds.add(String(p._id));
      }
    });

    capitalData.forEach(item => {
      const p = resolveSourceProposal(item);
      if (p) {
        const key = p.division || p.department || 'Unassigned';
        divisionMap[key].totalCO += Number(item.cost ?? item.total) || 0;
        linkedCapitalWorkflowIds.add(String(p._id));
      }
    });

    // Consolidated/legacy workflows can store line items only in embedded
    // arrays. Use those as a fallback per proposal and expense class so linked
    // records are never counted twice.
    proposals.forEach(proposal => {
      const workflowId = String(proposal._id);
      const key = proposal.division || proposal.department || 'Unassigned';
      if (!linkedPersonnelWorkflowIds.has(workflowId) && Array.isArray(proposal.personnelData)) {
        divisionMap[key].totalPS += proposal.personnelData.reduce(
          (sum, item) => sum + (Number(item.Total ?? item.total) || 0),
          0
        );
      }
      if (!linkedMooeWorkflowIds.has(workflowId) && Array.isArray(proposal.mooeData)) {
        divisionMap[key].totalMOOE += proposal.mooeData.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0
        );
      }
      if (!linkedCapitalWorkflowIds.has(workflowId) && Array.isArray(proposal.capitalData)) {
        divisionMap[key].totalCO += proposal.capitalData.reduce(
          (sum, item) => sum + (Number(item.cost ?? item.total) || 0),
          0
        );
      }
    });

    // Create allocations from divisions
    const allocations = Object.values(divisionMap).map(div => ({
      division: div.division,
      department: div.department,
      initialProposalId: div.proposals[0]?._id, // Reference first proposal
      initialProposalIds: div.proposals.map(proposal => proposal._id),
      initialRequestAmount: div.totalAmount,
      initialSubsidy: div.totalSubsidy,
      initialIncome: div.totalIncome,
      initialBreakdown: {
        personnelServices: div.totalPS,
        mooe: div.totalMOOE,
        capitalOutlay: div.totalCO
      },
      // Default ceiling to initial request (BRD will adjust)
      ceilingAmount: div.totalAmount,
      ceilingSubsidy: div.totalSubsidy,
      ceilingIncome: div.totalIncome,
      ceilingBreakdown: {
        personnelServices: div.totalPS,
        mooe: div.totalMOOE,
        capitalOutlay: div.totalCO
      },
      allocationStatus: 'Pending'
    }));

    const userId = user.id || user._id || user.Id;
    const userName = user.Name || user.name || `${user.FirstName || ''} ${user.LastName || ''}`.trim();

    if (ceiling) {
      // Update existing draft ceiling
      ceiling.allocations = allocations;
      ceiling.totalBudgetPool = totalBudgetPool || ceiling.totalBudgetPool;
      ceiling.lastModifiedBy = userId;
      ceiling.lastModifiedByName = userName;
      ceiling.addChangeHistory('CEILING_UPDATED', {
        changedBy: userId,
        changedByName: userName,
        remarks: 'Re-initialized from finalized proposals'
      });
    } else {
      // Create new ceiling
      ceiling = new BudgetCeiling({
        fiscalYear: parseInt(fiscalYear),
        region,
        budgetPhase,
        totalBudgetPool,
        allocations,
        createdBy: userId,
        createdByName: userName,
        changeHistory: [{
          action: 'CREATED',
          changedBy: userId,
          changedByName: userName,
          remarks: 'Initialized from finalized Initial proposals'
        }]
      });
    }

    await ceiling.save();

    res.json({
      success: true,
      message: 'Budget ceiling initialized successfully',
      data: ceiling
    });
  } catch (error) {
    console.error('Error initializing budget ceiling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize budget ceiling',
      error: error.message
    });
  }
});

/**
 * PUT /api/budget-ceiling/:id/allocation
 * Update a specific allocation's ceiling
 */
router.put('/:id/allocation', isAuth, isBRDStaff, requireDynamicPermission('/nep-ceiling'), async (req, res) => {
  try {
    const { id } = req.params;
    const { division, ceilingAmount, ceilingBreakdown, ceilingSubsidy, ceilingIncome, priority, remarks } = req.body;
    const user = req.user;

    const ceiling = await BudgetCeiling.findById(id);
    if (!ceiling) {
      return res.status(404).json({
        success: false,
        message: 'Budget ceiling not found'
      });
    }

    if (ceiling.status === 'Locked') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a locked ceiling'
      });
    }

    // Find and update the allocation
    const allocation = ceiling.allocations.find(a => a.division === division);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found for this division'
      });
    }

    const previousAmount = allocation.ceilingAmount;
    
    // Update allocation
    if (ceilingAmount !== undefined) allocation.ceilingAmount = ceilingAmount;
    if (ceilingBreakdown !== undefined) {
      allocation.ceilingBreakdown = {
        personnelServices: Number(ceilingBreakdown.personnelServices) || 0,
        mooe: Number(ceilingBreakdown.mooe) || 0,
        capitalOutlay: Number(ceilingBreakdown.capitalOutlay) || 0
      };
    }
    if (ceilingSubsidy !== undefined) allocation.ceilingSubsidy = ceilingSubsidy;
    if (ceilingIncome !== undefined) allocation.ceilingIncome = ceilingIncome;
    if (priority) allocation.priority = priority;
    if (remarks !== undefined) allocation.remarks = remarks;

    const userId = user.id || user._id || user.Id;
    const userName = user.Name || user.name || `${user.FirstName || ''} ${user.LastName || ''}`.trim();

    ceiling.lastModifiedBy = userId;
    ceiling.lastModifiedByName = userName;
    ceiling.addChangeHistory('CEILING_SET', {
      division,
      previousAmount,
      newAmount: ceilingAmount,
      changedBy: userId,
      changedByName: userName,
      remarks
    });

    await ceiling.save();

    res.json({
      success: true,
      message: 'Ceiling allocation updated successfully',
      data: ceiling
    });
  } catch (error) {
    console.error('Error updating ceiling allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ceiling allocation',
      error: error.message
    });
  }
});

/**
 * PUT /api/budget-ceiling/:id/budget-pool
 * Update the total budget pool
 */
router.put('/:id/budget-pool', isAuth, isBRDStaff, requireDynamicPermission('/nep-ceiling'), async (req, res) => {
  try {
    const { id } = req.params;
    const { totalBudgetPool } = req.body;
    const user = req.user;

    const ceiling = await BudgetCeiling.findById(id);
    if (!ceiling) {
      return res.status(404).json({
        success: false,
        message: 'Budget ceiling not found'
      });
    }

    if (ceiling.status === 'Locked') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a locked ceiling'
      });
    }

    const userId = user.id || user._id || user.Id;
    const userName = user.Name || user.name || `${user.FirstName || ''} ${user.LastName || ''}`.trim();

    ceiling.totalBudgetPool = totalBudgetPool;
    ceiling.lastModifiedBy = userId;
    ceiling.lastModifiedByName = userName;

    await ceiling.save();

    res.json({
      success: true,
      message: 'Budget pool updated successfully',
      data: ceiling
    });
  } catch (error) {
    console.error('Error updating budget pool:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget pool',
      error: error.message
    });
  }
});

/**
 * POST /api/budget-ceiling/:id/publish
 * Publish the ceiling (make visible to divisions)
 */
router.post('/:id/publish', isAuth, isBRDStaff, requireDynamicPermission('/nep-ceiling'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const ceiling = await BudgetCeiling.findById(id);
    if (!ceiling) {
      return res.status(404).json({
        success: false,
        message: 'Budget ceiling not found'
      });
    }

    if (ceiling.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft ceilings can be published'
      });
    }

    const userId = user.id || user._id || user.Id;
    const userName = user.Name || user.name || `${user.FirstName || ''} ${user.LastName || ''}`.trim();

    ceiling.status = 'Published';
    ceiling.publishedAt = new Date();
    ceiling.publishedBy = userId;
    ceiling.publishedByName = userName;
    
    // Update all allocations to Published
    ceiling.allocations.forEach(a => {
      a.allocationStatus = 'Published';
    });

    ceiling.addChangeHistory('PUBLISHED', {
      changedBy: userId,
      changedByName: userName,
      remarks: 'Ceiling published and visible to divisions'
    });

    await ceiling.save();

    res.json({
      success: true,
      message: 'Budget ceiling published successfully',
      data: ceiling
    });
  } catch (error) {
    console.error('Error publishing ceiling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish ceiling',
      error: error.message
    });
  }
});

/**
 * POST /api/budget-ceiling/:id/generate-nep
 * Generate NEP proposals from finalized Initial proposals with ceiling
 */
router.post('/:id/generate-nep', isAuth, isBRDStaff, requireDynamicPermission('/nep-ceiling'), async (req, res) => {
  try {
    const { id } = req.params;
    const { divisionFilter, generationMode: requestedGenerationMode } = req.body || {};
    const generationMode = normalizeNepGenerationMode(requestedGenerationMode);
    const user = req.user;

    const ceiling = await BudgetCeiling.findById(id);
    if (!ceiling) {
      return res.status(404).json({
        success: false,
        message: 'Budget ceiling not found'
      });
    }

    if (!['Published', 'Locked'].includes(ceiling.status)) {
      return res.status(400).json({
        success: false,
        message: 'Ceiling must be published before generating NEP proposals'
      });
    }

    const userId = user.id || user._id || user.Id;
    const userName = user.Name || user.name || `${user.FirstName || ''} ${user.LastName || ''}`.trim();

    const nepProposals = [];
    const errors = [];

    for (const allocation of ceiling.allocations) {
      // Skip if division filter is set and doesn't match
      if (divisionFilter && allocation.division !== divisionFilter) continue;
      
      // Skip if NEP already created
      if (allocation.nepProposalId) {
        errors.push(`NEP already exists for ${allocation.division}`);
        continue;
      }

      const sourceProposalIds = [
        ...(allocation.initialProposalIds || []),
        allocation.initialProposalId
      ].filter(Boolean);

      const initialProposals = sourceProposalIds.length
        ? await NewProposalWorkflow.find({
          _id: { $in: sourceProposalIds },
          modelType: 'Initial',
          status: { $in: ['FINALIZED', 'Finalized'] },
          fiscalYear: ceiling.fiscalYear
        }).lean()
        : [];

      if (initialProposals.length === 0) {
        errors.push(`No finalized Initial proposal found for ${allocation.division}`);
        continue;
      }

      // Use the first proposal for shared header/org metadata, while every
      // source proposal contributes its independently cloned line items.
      const template = initialProposals[0];
      let nepProposal = null;
      let legacyProposal = null;

      try {
        const alreadyGenerated = await NewProposalWorkflow.findOne({
          budgetCeilingId: ceiling._id,
          budgetCeilingAllocationId: allocation._id
        });
        if (alreadyGenerated) {
          allocation.nepProposalId = alreadyGenerated._id;
          allocation.nepProposalStatus = alreadyGenerated.status;
          allocation.nepAdjustmentMode = alreadyGenerated.nepAdjustmentMode || NEP_GENERATION_MODES.PREPARER;
          allocation.allocationStatus = 'NEP_Created';
          errors.push(`Recovered existing NEP reference for ${allocation.division}`);
          continue;
        }

        const preparers = generationMode === NEP_GENERATION_MODES.PREPARER
          ? await resolvePreparerAssignments({
            initialProposals,
            allocation,
            ceilingRegion: ceiling.region
          })
          : [];
        const assignment = buildNepGenerationAssignment({
          generationMode,
          preparers,
          brdUser: { userId: String(userId), userName: userName || String(userId) }
        });
        const assignmentDescription = generationMode === NEP_GENERATION_MODES.BRD
          ? 'routed directly to the Budget Planning Analyst for BRD adjustment'
          : `assigned to ${assignment.assignedPreparerNames.join(', ')}`;

        nepProposal = new NewProposalWorkflow({
          title: `NEP - ${template.title || allocation.division}`,
          description: `NEP proposal for ${allocation.division}. Ceiling: ₱${allocation.ceilingAmount?.toLocaleString()}`,
          modelType: 'NEP',
          fiscalYear: ceiling.fiscalYear,
          status: assignment.workflowStatus,
          amount: allocation.ceilingAmount,
          projectedSubsidy: allocation.ceilingSubsidy,
          projectedCorporateIncome: allocation.ceilingIncome,
          region: template.region,
          division: allocation.division,
          department: allocation.department,
          assignmentLevel: template.assignmentLevel,
          office: template.office,
          isCentralOffice: template.isCentralOffice,
          createdBy: userId,
          createdByName: userName,
          assignedPreparerUserIds: assignment.assignedPreparerUserIds,
          assignedPreparerNames: assignment.assignedPreparerNames,
          sourceInitialProposalIds: initialProposals.map(proposal => proposal._id),
          budgetCeilingId: ceiling._id,
          budgetCeilingAllocationId: allocation._id,
          nepAdjustmentMode: assignment.generationMode,
          currentAssigneeRole: assignment.currentAssigneeRole,
          workflowHistory: [{
            action: generationMode === NEP_GENERATION_MODES.BRD
              ? 'NEP_CREATED_FOR_BRD_ADJUSTMENT'
              : 'NEP_CREATED_FROM_INITIAL',
            fromStatus: 'N/A',
            toStatus: assignment.workflowStatus,
            performedBy: userId,
            performedByName: userName,
            performedAt: new Date(),
            comment: `NEP proposal generated by BRD and ${assignmentDescription}. Ceiling: ₱${allocation.ceilingAmount?.toLocaleString()}`
          }]
        });
        await nepProposal.save();

        legacyProposal = new Proposal({
          title: nepProposal.title,
          description: nepProposal.description,
          fiscalYear: String(nepProposal.fiscalYear),
          budgetType: 'NEP',
          nepAdjustmentMode: assignment.generationMode,
          region: ceiling.region,
          department: nepProposal.department,
          division: nepProposal.division,
          processBy: assignment.editor.userName,
          status: assignment.legacyStatus,
          workflowLevel: assignment.legacyWorkflowLevel,
          currentStep: assignment.legacyCurrentStep,
          currentAssigneeRole: assignment.legacyCurrentAssigneeRole,
          pendingWithRoles: [assignment.legacyCurrentAssigneeRole],
          workflowRef: nepProposal._id,
          proposalId: nepProposal._id,
          createdBy: assignment.editor.userId,
          createdByName: assignment.editor.userName,
          createdByUserId: assignment.editor.userId
        });
        await legacyProposal.save();

        const Region = require('../models/Region');
        const regionDoc = mongoose.Types.ObjectId.isValid(String(template.region || ''))
          ? await Region.findById(template.region).lean()
          : await Region.findOne({
            $or: [
              { Region: ceiling.region },
              { regionName: ceiling.region },
              { RegionName: ceiling.region },
              { name: ceiling.region }
            ]
          }).lean();
        const regionName = regionDoc?.Region || regionDoc?.regionName || regionDoc?.RegionName || ceiling.region;

        const cloneCounts = await cloneProposalLineItems({
          initialProposals,
          targetWorkflowId: nepProposal._id,
          targetLegacyProposalId: legacyProposal._id,
          fiscalYear: ceiling.fiscalYear,
          regionName,
          department: allocation.department,
          division: allocation.division,
          preparer: assignment.editor,
          workflowAssignment: assignment
        });

        const clonedLineCount = cloneCounts.income + cloneCounts.personnel +
          cloneCounts.mooe + cloneCounts.capitalOutlay;
        if (clonedLineCount === 0) {
          throw new Error('The finalized Initial proposal has no line items to clone');
        }

        await recalculateAndSaveProposalTotals({ workflowRef: nepProposal._id });
        nepProposal = await NewProposalWorkflow.findById(nepProposal._id);

        allocation.nepProposalId = nepProposal._id;
        allocation.nepLegacyProposalId = legacyProposal._id;
        allocation.nepProposalStatus = assignment.workflowStatus;
        allocation.allocationStatus = 'NEP_Created';
        allocation.nepAdjustmentMode = assignment.generationMode;
        allocation.assignedPreparerUserIds = assignment.assignedPreparerUserIds;
        allocation.assignedPreparerNames = assignment.assignedPreparerNames;
        nepProposals.push(nepProposal);
      } catch (allocationError) {
        if (nepProposal?._id) {
          await cleanupGeneratedNepData({
            workflowId: nepProposal._id,
            legacyProposalId: legacyProposal?._id
          }).catch(cleanupError => {
            console.error('Failed to clean up partial NEP line-item clone:', cleanupError.message);
          });
          if (legacyProposal?._id) await Proposal.findByIdAndDelete(legacyProposal._id);
          await NewProposalWorkflow.findByIdAndDelete(nepProposal._id);
        }
        errors.push(`${allocation.division}: ${allocationError.message}`);
      }
    }

    // Lock the ceiling after generating NEP proposals
    const hasGeneratedNep = ceiling.allocations.some(allocation => allocation.nepProposalId);
    if (hasGeneratedNep) {
      ceiling.status = 'Locked';
      ceiling.lockedAt = ceiling.lockedAt || new Date();
      ceiling.lockedBy = ceiling.lockedBy || userId;
      if (nepProposals.length > 0) {
        ceiling.addChangeHistory('NEP_GENERATED', {
          changedBy: userId,
          changedByName: userName,
          remarks: `Generated ${nepProposals.length} NEP proposal(s) using ${generationMode === NEP_GENERATION_MODES.BRD ? 'BRD Direct Adjustment' : 'Budget Preparer'} workflow`
        });
      }
    }

    await ceiling.save();

    res.json({
      success: true,
      message: `Generated ${nepProposals.length} NEP proposal(s)`,
      data: {
        ceiling,
        nepProposals,
        errors,
        generationMode
      }
    });
  } catch (error) {
    console.error('Error generating NEP proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate NEP proposals',
      error: error.message
    });
  }
});

/**
 * GET /api/budget-ceiling/comparison/:fiscalYear/:region
 * Get Initial vs NEP comparison data
 */
router.get('/comparison/:fiscalYear/:region', isAuth, async (req, res) => {
  try {
    const { fiscalYear, region } = req.params;

    // Get ceiling data
    const ceiling = await BudgetCeiling.findOne({
      fiscalYear: parseInt(fiscalYear),
      region: decodeURIComponent(region),
      budgetPhase: 'NEP'
    }).lean();

    // Get all Initial proposals
    const initialProposals = await NewProposalWorkflow.find({
      modelType: 'Initial',
      fiscalYear: parseInt(fiscalYear),
      status: { $in: ['FINALIZED', 'Finalized'] }
    }).lean();

    // Get all NEP proposals
    const nepProposals = await NewProposalWorkflow.find({
      modelType: 'NEP',
      fiscalYear: parseInt(fiscalYear)
    }).lean();

    // Build comparison data
    const comparison = (ceiling?.allocations || []).map(alloc => {
      const initial = initialProposals.find(p => p.division === alloc.division);
      const nep = nepProposals.find(p => p.division === alloc.division);
      
      return {
        division: alloc.division,
        department: alloc.department,
        initial: {
          amount: alloc.initialRequestAmount,
          subsidy: alloc.initialSubsidy,
          income: alloc.initialIncome,
          breakdown: alloc.initialBreakdown,
          status: initial?.status || 'N/A'
        },
        ceiling: {
          amount: alloc.ceilingAmount,
          subsidy: alloc.ceilingSubsidy,
          income: alloc.ceilingIncome,
          breakdown: alloc.ceilingBreakdown
        },
        nep: nep ? {
          id: nep._id,
          amount: nep.amount || nep.proposedBudget,
          subsidy: nep.projectedSubsidy,
          income: nep.projectedCorporateIncome,
          status: nep.status
        } : null,
        variance: {
          initialVsCeiling: alloc.ceilingAmount - alloc.initialRequestAmount,
          ceilingVsNep: nep ? (nep.amount || nep.proposedBudget) - alloc.ceilingAmount : null
        }
      };
    });

    res.json({
      success: true,
      data: {
        ceiling,
        comparison,
        summary: {
          totalInitial: comparison.reduce((sum, c) => sum + c.initial.amount, 0),
          totalCeiling: comparison.reduce((sum, c) => sum + c.ceiling.amount, 0),
          totalNep: comparison.reduce((sum, c) => sum + (c.nep?.amount || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison data',
      error: error.message
    });
  }
});

module.exports = router;
