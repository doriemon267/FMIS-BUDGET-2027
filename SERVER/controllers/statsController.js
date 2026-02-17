const mongoose = require('mongoose');
const Proposal = require("../models/Proposal");
const PersonnelService = require('../models/PersonnelServices');
const MOOEProposal = require("../models/mooeProposals");
const CapitalOutlay = require("../models/CapitalOutlay");
const BudgetarySupport = require("../models/BudgetarySupport");
const Settings = require("../models/Settings");
const NewProposalWorkflow = require("../models/NewProposalWorkflow");
const { resolveRegionToObjectId } = require('../utils/regionUtils');

// Get overview statistics for the dashboard
exports.getOverviewStats = async (req, res) => {
  try {
    // Get active fiscal year
    const activeSettings = await Settings.findOne({ isActive: true });
    const fiscalYear = activeSettings?.fiscalYear || new Date().getFullYear().toString();
    
    // Start with fiscal year filter
    const baseFilter = { fiscalYear };
    
    // Apply hierarchical filters from middleware (division/department/region)
    // Merge them into baseFilter so division users are scoped to their division
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(baseFilter, req.hierarchicalFilters);
    }
    
    // Allow explicit region query param to further narrow within user's scope
    const regionParam = req.query.region;
    if (regionParam) {
      baseFilter.region = regionParam;
    }
    
    // Legacy models (PersonnelServices, MOOE, CapitalOutlay, BudgetarySupport) use region as string (name).
    // NewProposalWorkflow uses region as ObjectId only. Never pass a string to avoid "Cast to ObjectId" error.
    const regionObjectId = await resolveRegionToObjectId(baseFilter.region);
    const workflowFilter = { ...baseFilter };
    delete workflowFilter.region; // remove so we never pass string to NewProposalWorkflow
    if (regionObjectId) {
      workflowFilter.region = regionObjectId;
    }
    
    // Build status-specific filters for legacy models
    const pendingFilter = { ...baseFilter, status: { $nin: ["Approved", "Rejected"] } };
    const approvedFilter = { ...baseFilter, status: "Approved" };
    const rejectedFilter = { ...baseFilter, status: "Rejected" };
    
    // Build workflow status filters for NewProposalWorkflow
    // Pending = not FINALIZED and not in RETURNED states
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
    
    // Count documents per collection (Budgetary Support excluded from main totals)
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
      // NewProposalWorkflow counts
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
      // NewProposalWorkflow counts (use workflowFilter so region is ObjectId)
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
      // Breakdown by system type
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
