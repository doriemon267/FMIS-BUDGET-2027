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
    
    // Get region from query parameter
    const region = req.query.region;
    
    // console.log(`DASHBOARD STATS - Using fiscal year: ${fiscalYear} from activeSettings: ${activeSettings?.fiscalYear}, Region: ${region || 'All'}`);

    // Base filter - always filter by fiscal year
    const baseFilter = { fiscalYear };
    
    // Add region filter if provided
    if (region) {
      baseFilter.region = region;
    }
    
    // console.log("Using filter:", baseFilter);

    // Count proposals by status - EXCLUDE Budgetary Support
    const [personnelCount, mooeCount, capitalCount, budgetarySupportCount] = await Promise.all([
      PersonnelServices.countDocuments(baseFilter),
      MOOEProposal.countDocuments(baseFilter),
      CapitalOutlay.countDocuments(baseFilter),
      BudgetarySupport.countDocuments(baseFilter) // Still count but don't include in totals
    ]);
    
    // console.log("DASHBOARD STATS - Counts by type:", {
    //   personnelCount,
    //   mooeCount,
    //   capitalCount,
    //   budgetarySupportCount,
    //   totalCalculated: personnelCount + mooeCount + capitalCount, // Exclude budgetary support
    //   fiscalYear: fiscalYear,
    //   breakdown: `Personnel: ${personnelCount} + MOOE: ${mooeCount} + Capital: ${capitalCount} = ${personnelCount + mooeCount + capitalCount} (Budgetary: ${budgetarySupportCount} not included in total)`
    // });

    // Count proposals by status
    const pendingFilter = { ...baseFilter, status: { $nin: ["Approved", "Rejected"] } };
    
    const pendingPersonnel = await PersonnelServices.countDocuments(pendingFilter);
    const pendingMOOE = await MOOEProposal.countDocuments(pendingFilter);
    const pendingCapital = await CapitalOutlay.countDocuments(pendingFilter);
    const pendingBudgetarySupport = await BudgetarySupport.countDocuments(pendingFilter);

    // console.log("Pending counts:", { pendingPersonnel, pendingMOOE, pendingCapital, pendingBudgetarySupport });

    const approvedFilter = { ...baseFilter, status: "Approved" };
    
    const approvedPersonnel = await PersonnelServices.countDocuments(approvedFilter);
    const approvedMOOE = await MOOEProposal.countDocuments(approvedFilter);
    const approvedCapital = await CapitalOutlay.countDocuments(approvedFilter);
    const approvedBudgetarySupport = await BudgetarySupport.countDocuments(approvedFilter);

    // console.log("Approved counts:", { approvedPersonnel, approvedMOOE, approvedCapital, approvedBudgetarySupport });

    const rejectedFilter = { ...baseFilter, status: "Rejected" };
    
    const rejectedPersonnel = await PersonnelServices.countDocuments(rejectedFilter);
    const rejectedMOOE = await MOOEProposal.countDocuments(rejectedFilter);
    const rejectedCapital = await CapitalOutlay.countDocuments(rejectedFilter);
    const rejectedBudgetarySupport = await BudgetarySupport.countDocuments(rejectedFilter);

    // console.log("Rejected counts:", { rejectedPersonnel, rejectedMOOE, rejectedCapital, rejectedBudgetarySupport });

    // Calculate totals - EXCLUDE Budgetary Support
    const totalProposals = personnelCount + mooeCount + capitalCount; // Exclude budgetary support
    const pendingProposals = pendingPersonnel + pendingMOOE + pendingCapital; // Exclude budgetary support
    const approvedProposals = approvedPersonnel + approvedMOOE + approvedCapital; // Exclude budgetary support
    const rejectedProposals = rejectedPersonnel + rejectedMOOE + rejectedCapital; // Exclude budgetary support

    // console.log("DASHBOARD STATS - Final totals:", {
    //   totalProposals,
    //   pendingProposals,
    //   approvedProposals,
    //   rejectedProposals,
    //   budgetarySupportTotal: budgetarySupportCount, // Separate count for reference
    //   note: "Budgetary Support is now excluded from totals"
    // });

    res.status(200).json({
      totalProposals,
      pendingProposals,
      approvedProposals,
      rejectedProposals,
      // Include budgetary support counts separately
      budgetarySupport: {
        total: budgetarySupportCount,
        pending: pendingBudgetarySupport,
        approved: approvedBudgetarySupport,
        rejected: rejectedBudgetarySupport
      },
      fiscalYear,
      region: region || 'All',
      filter: baseFilter
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

