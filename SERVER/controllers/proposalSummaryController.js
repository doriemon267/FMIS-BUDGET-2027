const CapitalOutlay = require("../models/CapitalOutlay");
const MOOEProposal = require("../models/mooeProposals");
const PersonnelService = require('../models/PersonnelServices');
// Kumuha ng combined proposal summary
// Kumuha ng combined proposal summary
exports.getProposalSummary = async (req, res) => {
  try {
    // Build query using submission workflow filters when available
    let baseQuery = {};
    if (req.submissionWorkflowFilters && Object.keys(req.submissionWorkflowFilters).length) {
      baseQuery = { ...req.submissionWorkflowFilters };
    } else if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length) {
      baseQuery = { ...req.hierarchicalFilters };
    }
    const capitalOutlays = await CapitalOutlay.find(baseQuery).lean();
    const mooeProposals = await MOOEProposal.find(baseQuery).lean();
    const personnelServices = await PersonnelServices.find(baseQuery).lean();
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

// Get Personnel Services SUBTOTAL with breakdown
exports.getPersonnelServicesTotalWithBreakdown = async (req, res) => {
  try {
    // Build query using submission workflow filters when available
    let baseQuery = {};
    if (req.submissionWorkflowFilters && Object.keys(req.submissionWorkflowFilters).length) {
      baseQuery = { ...req.submissionWorkflowFilters };
    } else if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length) {
      baseQuery = { ...req.hierarchicalFilters };
    }

    // Get overall total
    const overallTotal = await PersonnelServices.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalSubtotal: { $sum: "$Total" },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    // Get breakdown by Department
    const breakdownByDepartment = await PersonnelServices.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$department",
          subtotalAmount: { $sum: "$Total" },
          count: { $sum: 1 }
        }
      },
      { $sort: { subtotalAmount: -1 } }
    ]);

    // Get breakdown by Region
    const breakdownByRegion = await PersonnelServices.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$region",
          subtotalAmount: { $sum: "$Total" },
          count: { $sum: 1 }
        }
      },
      { $sort: { subtotalAmount: -1 } }
    ]);

    // Get breakdown by Status
    const breakdownByStatus = await PersonnelServices.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$status",
          subtotalAmount: { $sum: "$Total" },
          count: { $sum: 1 }
        }
      },
      { $sort: { subtotalAmount: -1 } }
    ]);

    // Get top 10 employees by Total
    const topEmployees = await PersonnelServices.find(baseQuery)
      .select('employeeFullName department region Total status')
      .sort({ Total: -1 })
      .limit(10)
      .lean();

    const response = {
      summary: {
        totalSubtotal: overallTotal[0] ? overallTotal[0].totalSubtotal : 0,
        totalRecords: overallTotal[0] ? overallTotal[0].totalCount : 0,
        averageSubtotal: overallTotal[0] ? (overallTotal[0].totalSubtotal / overallTotal[0].totalCount) : 0
      },
      breakdown: {
        byDepartment: breakdownByDepartment.map(item => ({
          department: item._id || 'Unknown',
          total: item.subtotalAmount,
          count: item.count,
          average: Math.round(item.subtotalAmount / item.count)
        })),
        byRegion: breakdownByRegion.map(item => ({
          region: item._id || 'Unknown',
          total: item.subtotalAmount,
          count: item.count,
          average: Math.round(item.subtotalAmount / item.count)
        })),
        byStatus: breakdownByStatus.map(item => ({
          status: item._id || 'Unknown',
          total: item.subtotalAmount,
          count: item.count,
          average: Math.round(item.subtotalAmount / item.count)
        }))
      },
      topEmployees: topEmployees.map(emp => ({
        name: emp.employeeFullName,
        department: emp.department,
        region: emp.region,
        subtotal: emp.Total,
        status: emp.status
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting Personnel Services total:', error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
