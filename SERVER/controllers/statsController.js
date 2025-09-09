const Proposal = require("../models/Proposal");
const PersonnelServices = require("../models/personnelServices");
const MOOEProposal = require("../models/mooeProposals");
const CapitalOutlay = require("../models/CapitalOutlay");
const BudgetarySupport = require("../models/BudgetarySupport");
const Settings = require("../models/Settings");

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
    const region = req.query.region;
    if (region) baseFilter.region = region;

    // Build status-specific filters once
    const pendingFilter = { ...baseFilter, status: { $nin: ["Approved", "Rejected"] } };
    const approvedFilter = { ...baseFilter, status: "Approved" };
    const rejectedFilter = { ...baseFilter, status: "Rejected" };

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
      rejectedBudgetarySupport
    ] = await Promise.all([
      PersonnelServices.countDocuments(baseFilter),
      MOOEProposal.countDocuments(baseFilter),
      CapitalOutlay.countDocuments(baseFilter),
      BudgetarySupport.countDocuments(baseFilter),

      PersonnelServices.countDocuments(pendingFilter),
      MOOEProposal.countDocuments(pendingFilter),
      CapitalOutlay.countDocuments(pendingFilter),
      BudgetarySupport.countDocuments(pendingFilter),

      PersonnelServices.countDocuments(approvedFilter),
      MOOEProposal.countDocuments(approvedFilter),
      CapitalOutlay.countDocuments(approvedFilter),
      BudgetarySupport.countDocuments(approvedFilter),

      PersonnelServices.countDocuments(rejectedFilter),
      MOOEProposal.countDocuments(rejectedFilter),
      CapitalOutlay.countDocuments(rejectedFilter),
      BudgetarySupport.countDocuments(rejectedFilter)
    ]);

    const totalProposals = personnelCount + mooeCount + capitalCount;
    const pendingProposals = pendingPersonnel + pendingMOOE + pendingCapital;
    const approvedProposals = approvedPersonnel + approvedMOOE + approvedCapital;
    const rejectedProposals = rejectedPersonnel + rejectedMOOE + rejectedCapital;

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
      fiscalYear,
      region: baseFilter.region || 'All',
      filter: baseFilter,
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

