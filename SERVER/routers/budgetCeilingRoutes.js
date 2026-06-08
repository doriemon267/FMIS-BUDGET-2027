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

    // Group proposals by division
    const divisionMap = {};
    proposals.forEach(p => {
      const key = p.division || p.department || 'Unassigned';
      if (!divisionMap[key]) {
        divisionMap[key] = {
          division: p.division,
          department: p.department,
          proposals: [],
          totalAmount: 0,
          totalSubsidy: 0,
          totalIncome: 0
        };
      }
      divisionMap[key].proposals.push(p);
      divisionMap[key].totalAmount += p.amount || p.proposedBudget || 0;
      divisionMap[key].totalSubsidy += p.projectedSubsidy || 0;
      divisionMap[key].totalIncome += p.projectedCorporateIncome || 0;
    });

    // Create allocations from divisions
    const allocations = Object.values(divisionMap).map(div => ({
      division: div.division,
      department: div.department,
      initialProposalId: div.proposals[0]?._id, // Reference first proposal
      initialRequestAmount: div.totalAmount,
      initialSubsidy: div.totalSubsidy,
      initialIncome: div.totalIncome,
      // Default ceiling to initial request (BRD will adjust)
      ceilingAmount: div.totalAmount,
      ceilingSubsidy: div.totalSubsidy,
      ceilingIncome: div.totalIncome,
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
    const { division, ceilingAmount, ceilingSubsidy, ceilingIncome, priority, remarks } = req.body;
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
    const { divisionFilter } = req.body; // Optional: generate for specific division only
    const user = req.user;

    const ceiling = await BudgetCeiling.findById(id);
    if (!ceiling) {
      return res.status(404).json({
        success: false,
        message: 'Budget ceiling not found'
      });
    }

    if (ceiling.status === 'Draft') {
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

      // Find the original Initial proposal(s) for this division
      const initialProposals = await NewProposalWorkflow.find({
        modelType: 'Initial',
        status: { $in: ['FINALIZED', 'Finalized'] },
        fiscalYear: ceiling.fiscalYear,
        division: allocation.division
      }).lean();

      if (initialProposals.length === 0) {
        errors.push(`No finalized Initial proposal found for ${allocation.division}`);
        continue;
      }

      // Use the first proposal as template
      const template = initialProposals[0];

      // Create NEP proposal
      const nepProposal = new NewProposalWorkflow({
        title: `NEP - ${template.title || allocation.division}`,
        description: `NEP proposal for ${allocation.division}. Ceiling: ₱${allocation.ceilingAmount?.toLocaleString()}`,
        modelType: 'NEP',
        fiscalYear: ceiling.fiscalYear,
        status: 'DRAFT',
        amount: allocation.ceilingAmount,
        projectedSubsidy: allocation.ceilingSubsidy,
        projectedCorporateIncome: allocation.ceilingIncome,
        region: template.region,
        division: allocation.division,
        department: allocation.department,
        // Clone granular data from template
        mooeData: template.mooeData,
        capitalData: template.capitalData,
        personnelData: template.personnelData,
        incomeData: template.incomeData,
        createdBy: userId,
        createdByName: userName,
        currentAssigneeRole: 'BUDGET PREPARER',
        workflowHistory: [{
          action: 'NEP_CREATED_FROM_INITIAL',
          fromStatus: 'N/A',
          toStatus: 'DRAFT',
          performedBy: userId,
          performedByName: userName,
          performedAt: new Date(),
          comment: `NEP proposal created from Initial. Ceiling set by BRD: ₱${allocation.ceilingAmount?.toLocaleString()}`
        }]
      });

      await nepProposal.save();
      nepProposals.push(nepProposal);

      // Create a Proposal document for legacy compatibility
      const legacyProposal = new Proposal({
        title: nepProposal.title,
        description: nepProposal.description,
        fiscalYear: String(nepProposal.fiscalYear),
        budgetType: 'NEP',
        region: ceiling.region,
        department: nepProposal.department,
        division: nepProposal.division,
        processBy: userName,
        status: 'Draft',
        workflowLevel: 'BUDGET PREPARER',
        currentStep: 'PREPARER_DRAFT',
        workflowRef: nepProposal._id,
        proposalId: nepProposal._id,
        createdBy: userId,
        createdByName: userName
      });
      await legacyProposal.save();

      // Recalculate totals to sync legacy Proposal with cloned granular data
      try {
        const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
        await recalculateAndSaveProposalTotals({ proposalId: legacyProposal._id });
      } catch (calcErr) {
        console.error(`Warning: Failed to recalculate totals for NEP proposal ${nepProposal._id}:`, calcErr.message);
      }

      // Update allocation with NEP reference
      allocation.nepProposalId = nepProposal._id;
      allocation.nepProposalStatus = 'DRAFT';
      allocation.allocationStatus = 'NEP_Created';
    }

    // Lock the ceiling after generating NEP proposals
    if (nepProposals.length > 0) {
      ceiling.status = 'Locked';
      ceiling.lockedAt = new Date();
      ceiling.lockedBy = userId;
      ceiling.addChangeHistory('NEP_GENERATED', {
        changedBy: userId,
        changedByName: userName,
        remarks: `Generated ${nepProposals.length} NEP proposal(s)`
      });
    }

    await ceiling.save();

    res.json({
      success: true,
      message: `Generated ${nepProposals.length} NEP proposal(s)`,
      data: {
        ceiling,
        nepProposals,
        errors
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
          status: initial?.status || 'N/A'
        },
        ceiling: {
          amount: alloc.ceilingAmount,
          subsidy: alloc.ceilingSubsidy,
          income: alloc.ceilingIncome
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

