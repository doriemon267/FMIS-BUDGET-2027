const mongoose = require('mongoose');
const Proposal = require("../models/Proposal");
const PersonnelService = require('../models/PersonnelServices');
const MOOEProposal = require("../models/mooeProposals");
const CapitalOutlay = require("../models/CapitalOutlay");
const BudgetarySupport = require("../models/BudgetarySupport");
const Settings = require("../models/Settings");
const NewProposalWorkflow = require("../models/NewProposalWorkflow");
const { resolveRegionToObjectId, sanitizeWorkflowQuery } = require('../utils/regionUtils');

// Get overview statistics for the dashboard
exports.getOverviewStats = async (req, res) => {
  try {
    // Get active fiscal year
    const activeSettings = await Settings.findOne({ isActive: true });
    const fiscalYear = activeSettings?.fiscalYear || new Date().getFullYear().toString();
    
    // Start with fiscal year filter
    const baseFilter = { fiscalYear };
    
    // Apply hierarchical filters from middleware (division/department/region)
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(baseFilter, req.hierarchicalFilters);
    }
    
    // Allow explicit region query param to further narrow within user's scope
    const regionParam = req.query.region;
    if (regionParam && String(regionParam).trim() && String(regionParam).toLowerCase() !== 'all regions') {
      baseFilter.region = regionParam;
    }
    
    // Apply budget role visibility filter if exists
    if (req.budgetRoleVisibilityFilter && Object.keys(req.budgetRoleVisibilityFilter).length > 0) {
      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push(req.budgetRoleVisibilityFilter);
    }

    // Build a dedicated filter for NewProposalWorkflow queries.
    // The baseFilter.region may be a plain string (e.g. "REGION IV-A") from hierarchicalFilters.
    // NewProposalWorkflow.region is typed ObjectId — we must resolve strings before querying.
    const workflowBaseFilter = { ...baseFilter };

    // Step 1: Explicitly resolve the top-level region string to ObjectId.
    if (typeof workflowBaseFilter.region === 'string' && workflowBaseFilter.region.length > 0) {
      if (/^[0-9a-fA-F]{24}$/.test(workflowBaseFilter.region)) {
        workflowBaseFilter.region = new mongoose.Types.ObjectId(workflowBaseFilter.region);
      } else {
        const resolvedId = await resolveRegionToObjectId(workflowBaseFilter.region);
        if (resolvedId) {
          workflowBaseFilter.region = resolvedId;
        } else {
          // Region not found — remove it to avoid CastError (shows all rather than none)
          delete workflowBaseFilter.region;
        }
      }
    }

    // Step 2: Deep-sanitize the entire filter (resolves any region strings inside
    //         nested $and/$or from budgetRoleVisibilityFilter).
    const workflowFilter = await sanitizeWorkflowQuery(workflowBaseFilter);
    
    // Build status-specific filters for legacy models
    const pendingFilter = { ...baseFilter, status: { $nin: ["Approved", "Rejected"] } };
    const approvedFilter = { ...baseFilter, status: "Approved" };
    const rejectedFilter = { ...baseFilter, status: "Rejected" };
    
    // Build workflow status filters for NewProposalWorkflow (spread from sanitized workflowFilter)
    const workflowPendingFilter = {
      ...workflowFilter,
      status: {
        $nin: ["FINALIZED", "RETURNED_TO_PREPARER", "RETURNED_TO_REVIEWER", "RETURNED_TO_APPROVER", "RETURNED_TO_PLANNING_ANALYST", "RETURNED_TO_OFFICER"]
      }
    };
    const workflowFinalizedFilter = { ...workflowFilter, status: "FINALIZED" };
    const workflowReturnedFilter = {
      ...workflowFilter,
      status: { $in: ["RETURNED_TO_PREPARER", "RETURNED_TO_REVIEWER", "RETURNED_TO_APPROVER", "RETURNED_TO_PLANNING_ANALYST", "RETURNED_TO_OFFICER"] }
    };
    
    // Count documents per collection
    const [
      personnelCount,
      mooeCount,
      capitalCount,
      budgetarySupportCount,
      pendingPersonnel,
      pendingMOOE,
      pendingCapital,
      pendingBudgetarySupport,
      approvedPersonnel,
      approvedMOOE,
      approvedCapital,
      approvedBudgetarySupport,
      rejectedPersonnel,
      rejectedMOOE,
      rejectedCapital,
      rejectedBudgetarySupport,
      newWorkflowTotal,
      newWorkflowPending,
      newWorkflowFinalized,
      newWorkflowReturned
    ] = await Promise.all([
      PersonnelService.countDocuments(baseFilter),
      MOOEProposal.countDocuments(baseFilter),
      CapitalOutlay.countDocuments(baseFilter),
      BudgetarySupport.countDocuments(baseFilter),
      PersonnelService.countDocuments(pendingFilter),
      MOOEProposal.countDocuments(pendingFilter),
      CapitalOutlay.countDocuments(pendingFilter),
      BudgetarySupport.countDocuments(pendingFilter),
      PersonnelService.countDocuments(approvedFilter),
      MOOEProposal.countDocuments(approvedFilter),
      CapitalOutlay.countDocuments(approvedFilter),
      BudgetarySupport.countDocuments(approvedFilter),
      PersonnelService.countDocuments(rejectedFilter),
      MOOEProposal.countDocuments(rejectedFilter),
      CapitalOutlay.countDocuments(rejectedFilter),
      BudgetarySupport.countDocuments(rejectedFilter),
      NewProposalWorkflow.countDocuments(workflowFilter),
      NewProposalWorkflow.countDocuments(workflowPendingFilter),
      NewProposalWorkflow.countDocuments(workflowFinalizedFilter),
      NewProposalWorkflow.countDocuments(workflowReturnedFilter)
    ]);
    
    // Combine legacy and new workflow totals
    const totalProposals = personnelCount + mooeCount + capitalCount + newWorkflowTotal;
    const pendingProposals = pendingPersonnel + pendingMOOE + pendingCapital + newWorkflowPending;
    const approvedProposals = approvedPersonnel + approvedMOOE + approvedCapital + newWorkflowFinalized;
    const rejectedProposals = rejectedPersonnel + rejectedMOOE + rejectedCapital + newWorkflowReturned;
    
    res.status(200).json({
      totalProposals,
      pendingProposals,
      approvedProposals,
      rejectedProposals,
      budgetarySupport: {
        total: budgetarySupportCount,
        pending: pendingBudgetarySupport,
        approved: approvedBudgetarySupport,
        rejected: rejectedBudgetarySupport,
      },
      breakdown: {
        legacy: {
          total: personnelCount + mooeCount + capitalCount,
          pending: pendingPersonnel + pendingMOOE + pendingCapital,
          approved: approvedPersonnel + approvedMOOE + approvedCapital,
          rejected: rejectedPersonnel + rejectedMOOE + rejectedCapital,
        },
        newWorkflow: {
          total: newWorkflowTotal,
          pending: newWorkflowPending,
          finalized: newWorkflowFinalized,
          returned: newWorkflowReturned,
        },
      },
      fiscalYear,
      region: baseFilter.region || 'All',
      filter: baseFilter,
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.cleanupCorruptedRegions = async (req, res) => {
  try {
    const NewProposalWorkflow = require('../models/NewProposalWorkflow');
    const { resolveRegionToObjectId } = require('../utils/regionUtils');
    
    const docs = await NewProposalWorkflow.find({ region: { $type: "string" } });
    let fixed = 0;
    
    for (const doc of docs) {
      if (typeof doc.region === 'string') {
        const resolvedId = await resolveRegionToObjectId(doc.region);
        if (resolvedId) {
          await NewProposalWorkflow.updateOne({ _id: doc._id }, { $set: { region: resolvedId } });
          fixed++;
        }
      }
    }
    
    res.json({ success: true, fixed, total: docs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
