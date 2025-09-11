const CapitalOutlay = require("../models/CapitalOutlay");
const MOOEProposal = require("../models/mooeProposals");
const PersonnelServices = require("../models/personnelServices");

// Kumuha ng combined proposal summary
// Kumuha ng combined proposal summary
exports.getProposalSummary = async (req, res) => {
  try {
    // Build query with hierarchical filters
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }

    const capitalOutlays = await CapitalOutlay.find(query).lean();
    const mooeProposals = await MOOEProposal.find(query).lean();
    const personnelServices = await PersonnelServices.find(query).lean();

    // I-format ang data para magkaroon ng property na 'type'
    const capitalOutlaysFormatted = capitalOutlays.map(item => ({
      type: "Capital Outlay",
      particulars: item.particulars,
      amount: item.cost,
      department: item.department,
      region: item.region,
      fiscal_year: item.fiscal_year,
      status: item.status,
      processBy: item.processBy,
      processDate: item.processDate,
    }));

    const mooeProposalsFormatted = mooeProposals.map(item => ({
      type: "MOOE Proposal",
      uacsCode: item.uacsCode,
      amount: item.amount,
      department: item.department,
      region: item.region,
      fiscal_year: item.fiscal_year,
      status: item.status,
      processBy: item.processBy,
      processDate: item.processDate,
    }));

    const personnelServicesFormatted = personnelServices.map(item => ({
      type: "Personnel Services",
      employeeFullName: item.employeeFullName,
      positionTitle: item.positionTitle,
      department: item.department,
      region: item.region,
      fiscal_year: item.fiscal_year,
      status: item.status,
      processBy: item.processBy,
      processDate: item.processDate,
      amount: item.Total,
    }));

    const allProposals = [
      ...capitalOutlaysFormatted,
      ...mooeProposalsFormatted,
      ...personnelServicesFormatted,
    ];

    // I-sort batay sa processDate (pinakabago muna)
    allProposals.sort((a, b) => new Date(b.processDate) - new Date(a.processDate));

    res.json({
      proposalsummary: allProposals,
      totalRecords: allProposals.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Kumuha ng aggregates para sa Personnel Services per employment status (PERMANENT vs CASUAL)
exports.getPersonnelAggregates = async (req, res) => {
  try {
    const personnelAggregates = await PersonnelServices.aggregate([
      {
        $group: {
          _id: "$statusOfAppointment", // Group by appointment status (e.g., "PERMANENT" or "CASUAL")
          totalMonthlySalary: { $sum: "$monthlySalary" },
          totalHazardPay: { $sum: "$hazardPay" },
          totalSubsistenceAllowance: { $sum: "$subsistenceAllowance" },
          totalHonoraria: { $sum: "$honoraria" },
          totalAnnualSalary: { $sum: "$annualSalary" },
          totalRATA: { $sum: "$RATA" },
          totalPERA: { $sum: "$PERA" },
          totalUniformAllowance: { $sum: "$uniformALLOWANCE" },
          totalProductivityIncentive: { $sum: "$productivityIncentive" },
          totalCashGift: { $sum: "$cashGift" },
          totalMidyearBonus: { $sum: "$midyearBonus" },
          totalYearEndBonus: { $sum: "$yearEndBonus" },
          totalGsisPremium: { $sum: "$gsisPremium" },
          totalPhilhealthPremium: { $sum: "$philhealthPremium" },
          totalPagibigPremium: { $sum: "$pagibigPremium" },
          totalEmployeeCompensation: { $sum: "$employeeCompensation" }
          // Add additional fields as needed based on your model
        }
      }
    ]);

    res.json(personnelAggregates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
// Kumuha ng analytics data (bilang at total amount)
exports.getAnalytics = async (req, res) => {
  try {
    // Build query with hierarchical filters
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }

    const capitalCount = await CapitalOutlay.countDocuments(query);
    const mooeCount = await MOOEProposal.countDocuments(query);
    const personnelCount = await PersonnelServices.countDocuments(query);

    const capitalAgg = await CapitalOutlay.aggregate([
      { $match: query },
      { $group: { _id: null, totalCost: { $sum: "$cost" } } }
    ]);
    const mooeAgg = await MOOEProposal.aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
    ]);
    const personnelAgg = await PersonnelServices.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]);

    res.json({
      counts: {
        capitalOutlay: capitalCount,
        mooeProposal: mooeCount,
        personnelServices: personnelCount,
      },
      totals: {
        capitalOutlay: capitalAgg[0] ? capitalAgg[0].totalCost : 0,
        mooeProposal: mooeAgg[0] ? mooeAgg[0].totalAmount : 0,
        personnelServices: personnelAgg[0] ? personnelAgg[0].total : 0,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
