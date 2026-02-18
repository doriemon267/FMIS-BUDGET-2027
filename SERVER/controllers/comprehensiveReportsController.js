const fs = require('fs');
const os = require('os');
const path = require('path');
const PersonnelServices = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Income = require('../models/Income');
const Region = require('../models/Region');
const Settings = require('../models/Settings');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
let MuhammaraRecipe;
try {
  // Lazy-load muhammara so the rest of the app still works even if it's not installed yet
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}
// Define the comprehensive budget structure
const COMPREHENSIVE_BUDGET_STRUCTURE = {
  "A": {
    name: "AGENCY INCOME",
    categories: {
      "1": {
        name: "Corporate Income",
        description: "Total agency income from various sources",
        structure: "A.1"
      }
    }
  },
  "B": {
    name: "EXPENDITURES",
    categories: {
      "1": {
        name: "Current Operating Expenditures",
        subcategories: {
          "1": {
            name: "Personnel Services",
            description: "Personnel-related expenditures",
            structure: "B.1.1"
          },
          "2": {
            name: "Maintenance and Other Operating Expenses",
            description: "MOOE expenditures",
            structure: "B.1.2"
          }
        }
      },
      "2": {
        name: "Capital Outlays",
        description: "Capital expenditures and investments",
        structure: "B.2"
      }
    }
  }
};
// Personnel Services hierarchical structure
const PERSONNEL_SERVICES_STRUCTURE = {
  "B.1.1": {
    name: "Personnel Services",
    categories: {
      "1": {
        name: "Salaries and Wages",
        items: {
          "a": { name: "Salaries - Regular (Authorized Positions)", field: "annualSalary" },
          "b": { name: "Casual Personnel", field: "casualPersonnel" }
        }
      },
      "2": {
        name: "Other Compensation",
        items: {
          "a": { name: "PERA", field: "PERA" },
          "b": { name: "Representation Allowance", field: "RATA" },
          "c": { name: "Transportation Allowance", field: "transportationAllowance" },
          "d": { name: "Honoraria", field: "honoraria" },
          "e": { name: "Uniform/Clothing Allowance", field: "uniformALLOWANCE" },
          "f": { name: "Children Allowances", field: "childrenAllowance" },
          "g": { name: "Medical Allowances", field: "medical" },
          "h": { name: "Meal Allowances", field: "meal" },
          "i": { name: "Per Diem & Allowance of Board of Directors", field: "perDiem" },
          "j": { name: "Subsistence Allowance", field: "subsistenceAllowance" },
          "k": { name: "Longevity Pay (Loyalty Award)", field: "loyaltyAward" },
          "l": { name: "Overtime Services", field: "overtimePay" },
          "m": { name: "Special Counsel Allowance", field: "specialCounsel" },
          "n": { name: "Productivity Enhancement Incentive", field: "productivityIncentive" },
          "o": { name: "Cash Gift", field: "cashGift" },
          "p": { name: "Mid-Year and Year-End Bonus", field: "midyearBonus,yearEndBonus" },
          "q": { name: "Performance Based Bonus", field: "performanceBonus" },
          "r": { name: "Hazard Pay", field: "hazardPay" },
          "s": { name: "Other Bonuses and Allowances", field: "otherBonuses" },
          "t": { name: "Anniversary Bonus", field: "anniversaryBonus" }
        }
      },
      "3": {
        name: "Other Benefits",
        items: {
          "a": { name: "Retirement Benefits", field: "retirementBenefits" },
          "b": { name: "Terminal Leave Benefits", field: "terminalLeave" }
        }
      },
      "4": {
        name: "Fixed Personnel Expenditures",
        items: {
          "a": { name: "GSIS Ret. & Life Insurance Premium", field: "gsisPremium" },
          "b": { name: "PAG-IBIG Contributions", field: "pagibigPremium" },
          "c": { name: "PHILHEALTH Contributions", field: "philhealthPremium" },
          "d": { name: "Employees Compensation Insurance Premium", field: "employeeCompensation" },
          "e": { name: "Provident Fund", field: "providentFund" }
        }
      },
      "5": {
        name: "REORG",
        items: {
          "a": { name: "Reorganization Costs", field: "reorgCosts" }
        }
      },
      "6": {
        name: "Leave Monetization/Earned Leaves",
        items: {
          "a": { name: "Earned Leaves", field: "earnedLeaves" }
        }
      }
    }
  }
};
const buildComprehensiveReportData = async ({ regions, fiscalYear, budgetType, preparerScope, groupBy, offices, responsibilityCenters }) => {
  // Build base query
  const query = {};
  if (regions) {
    const regionList = Array.isArray(regions) ? regions : [regions];
    query.region = { $in: regionList };
  }
  if (fiscalYear) query.fiscalYear = fiscalYear;
  if (budgetType) query.budgetType = budgetType;

  // View by Office (department) or Responsibility Center (division)
  if (groupBy === 'office' && offices && offices.length > 0) {
    const officeList = Array.isArray(offices) ? offices : [offices];
    query.department = { $in: officeList };
  }
  if (groupBy === 'responsibilityCenter' && responsibilityCenters && responsibilityCenters.length > 0) {
    const rcList = Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters];
    query.division = { $in: rcList };
  }

  // Preparer scope: restrict to Division or Department
  if (preparerScope) {
    const level = String(preparerScope.assignmentLevel || '').toUpperCase();
    if (level === 'DIVISION' && preparerScope.division) {
      query.division = preparerScope.division;
    } else if ((level === 'DEPARTMENT' || level === 'OFFICE') && preparerScope.department) {
      query.department = preparerScope.department;
    }
  }

  // MOOE & Capital Outlay: use same filters as Region view (region, fiscalYear, budgetType only)
  // so data always shows regardless of view by Office/RC (department/division often not set on MOOE/CO)
  const mooeQuery = {};
  const coQuery = {};
  if (regions) {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionExact = { region: { $in: regionList } };
    const regionRegex = regionList.map((r) => ({ region: new RegExp('^' + String(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }));
    mooeQuery.$or = [regionExact, ...regionRegex];
    coQuery.$or = [regionExact, ...regionRegex];
  }
  if (fiscalYear) {
    mooeQuery.fiscalYear = fiscalYear;
    const fyNum = Number(fiscalYear);
    const fyOr = [{ fiscalYear: fiscalYear }, ...(Number.isFinite(fyNum) ? [{ fiscal_year: fyNum }] : [])];
    coQuery.$and = [...(coQuery.$and || []), { $or: fyOr }];
  }
  if (budgetType) {
    mooeQuery.budgetType = budgetType;
    coQuery.budgetType = budgetType;
  }

  // Fetch data from all sources concurrently
  const [incomeData, psData, mooeData, coData] = await Promise.all([
    Income.find(query).lean(),
    PersonnelServices.find(query).lean(),
    MooeProposal.find(mooeQuery).lean(),
    CapitalOutlay.find(coQuery).populate('category').lean()
  ]);

  // Initialize comprehensive report structure
  const reportData = {
    summary: {
      reportTitle: "BUDGET SUMMARY REPORT",
      fiscalYear: fiscalYear || "All Years",
      budgetType: budgetType || "All Types",
      regions: regions ? (Array.isArray(regions) ? regions : [regions]) : ["All Regions"],
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      totalRegions: 0,
      totalEmployees: 0,
      grandTotal: 0,
      totalIncome: 0,
      totalSubsidy: 0
    },
    sections: []
  };

  const addSectionTotals = (section) => {
    reportData.summary.grandTotal += section.sectionTotal || 0;
    reportData.summary.totalIncome += Number(section.sectionTotalIncome) || 0;
    reportData.summary.totalSubsidy += Number(section.sectionTotalSubsidy) || 0;
  };

  // Process Corporate Income data
  if (Array.isArray(incomeData) && incomeData.length > 0) {
    const incomeSection = await processCorporateIncomeData(incomeData, query);
    reportData.sections.push(incomeSection);
    addSectionTotals(incomeSection);
  }
  // Process Personnel Services data
  if (Array.isArray(psData) && psData.length > 0) {
    const psSection = await processPersonnelServicesData(psData, query);
    reportData.sections.push(psSection);
    reportData.summary.totalEmployees = psSection.totalEmployees;
    addSectionTotals(psSection);
  }
  // Process MOOE data (always include section; show zero/empty when no data)
  const mooeSection = await processMOOEData(Array.isArray(mooeData) ? mooeData : [], query);
  reportData.sections.push(mooeSection);
  addSectionTotals(mooeSection);
  // Process Capital Outlay data (always include section; show zero/empty when no data)
  const coSection = await processCapitalOutlayData(Array.isArray(coData) ? coData : [], query);
  reportData.sections.push(coSection);
  addSectionTotals(coSection);
  // Get unique regions count
  const allRegions = new Set();
  [...incomeData, ...psData, ...mooeData, ...coData].forEach(item => {
    if (item.region) allRegions.add(item.region);
  });
  reportData.summary.totalRegions = allRegions.size;

  return reportData;
};

const getComprehensiveReportData = async (req, res) => {
  try {
    const { regions, region, fiscalYear, budgetType, groupBy, offices, responsibilityCenters } = req.query;
    const regionsParam = regions ?? region;
    const officesParam = offices ? (Array.isArray(offices) ? offices : [offices]) : [];
    const responsibilityCentersParam = responsibilityCenters ? (Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters]) : [];
    let preparerScope = null;
    const userRoles = req.user?.Roles || [];
    const isPreparer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_PREPARER') ||
      userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET PREPARER');
    if (isPreparer && req.user?.id) {
      const userIdString = String(req.user.id);
      const hua = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
        .populate('departmentId', 'Department departmentName DepartmentName')
        .lean();
      if (hua) {
        const assignedDepartment = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || '';
        const assignedDivision = hua.divisionName || '';
        preparerScope = {
          division: assignedDivision,
          department: assignedDepartment,
          assignmentLevel: hua.assignmentLevel || ''
        };
      }
    }
    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam
    });

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate comprehensive report',
      error: error.message
    });
  }
};
// Process Corporate Income data
const processCorporateIncomeData = async (incomeData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only
    const consolidatedCategories = {};
    incomeData.forEach((income) => {
      regionSet.add(income.region || 'Unspecified');
      totalEntries++;
      const category = income.category || 'Uncategorized';
      if (!consolidatedCategories[category]) {
        consolidatedCategories[category] = {
          name: category,
          total: 0,
          itemCount: 0,
          regions: new Set()
        };
      }
      const amount = Number(income.amount) || 0;
      consolidatedCategories[category].total += amount;
      consolidatedCategories[category].itemCount++;
      consolidatedCategories[category].regions.add(income.region || 'Unspecified');
      sectionTotal += amount;
    });
    // Add totalIncome/totalSubsidy for report columns (A.1 = all income)
    Object.values(consolidatedCategories).forEach(category => {
      category.regions = Array.from(category.regions);
      category.totalIncome = category.total;
      category.totalSubsidy = 0;
    });
    return {
      sectionCode: "A.1",
      sectionName: "CORPORATE INCOME",
      sectionDescription: "Total agency income from various sources and categories",
      sectionTotal,
      sectionTotalIncome: sectionTotal,
      sectionTotalSubsidy: 0,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
    incomeData.forEach((income) => {
      const region = income.region || 'Unspecified';
      regionSet.add(region);
      totalEntries++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEntries: 0,
          categories: {}
        };
      }
      grouped[region].totalEntries++;
      const category = income.category || 'Uncategorized';
      if (!grouped[region].categories[category]) {
        grouped[region].categories[category] = {
          name: category,
          items: [],
          total: 0
        };
      }
      const amount = Number(income.amount) || 0;
      grouped[region].categories[category].items.push({
        particulars: income.particulars,
        subcategory: income.subcategory,
        amount: amount,
        cost: income.cost || 0
      });
      grouped[region].categories[category].total += amount;
      sectionTotal += amount;
    });
    return {
      sectionCode: "A.1",
      sectionName: "CORPORATE INCOME",
      sectionDescription: "Total agency income from various sources and categories",
      sectionTotal,
      sectionTotalIncome: sectionTotal,
      sectionTotalSubsidy: 0,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process Personnel Services data
const processPersonnelServicesData = async (psData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEmployees = 0;
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // Consolidate by categories across all regions (NOT by region)
    const consolidatedCategories = {};
    let sectionTotalIncome = 0;
    let sectionTotalSubsidy = 0;
    psData.forEach((employee) => {
      regionSet.add(employee.region || 'Unspecified');
      totalEmployees++;
      const empTotal = Number(employee.Total) || 0;
      const chargedIncome = Number(employee.chargedToIncomeAmount) || 0;
      const subsidyPortion = Math.max(0, empTotal - chargedIncome);
      const ratioIncome = empTotal > 0 ? chargedIncome / empTotal : 0;
      const ratioSubsidy = empTotal > 0 ? subsidyPortion / empTotal : 1;
      // Process each category in the structure
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        if (!consolidatedCategories[categoryKey]) {
          consolidatedCategories[categoryKey] = {
            name: categoryData.name,
            items: {},
            total: 0,
            totalIncome: 0,
            totalSubsidy: 0
          };
        }
        const category = consolidatedCategories[categoryKey];
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!category.items[itemKey]) {
            category.items[itemKey] = {
              name: itemData.name,
              amount: 0,
              income: 0,
              subsidy: 0
            };
          }
          let amount = 0;
          if (itemData.field) {
            if (categoryKey === '1' && itemKey === 'a') {
              if (employee.statusOfAppointment === 'PERMANENT') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              if (employee.statusOfAppointment === 'CASUAL') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else {
              if (itemData.field.includes(',')) {
                const fields = itemData.field.split(',');
                amount = fields.reduce((sum, field) => sum + (Number(employee[field.trim()]) || 0), 0);
              } else {
                amount = Number(employee[itemData.field]) || 0;
              }
            }
          }
          category.items[itemKey].amount += amount;
          category.items[itemKey].income += amount * ratioIncome;
          category.items[itemKey].subsidy += amount * ratioSubsidy;
          category.total += amount;
        });
      });
      sectionTotal += empTotal;
      sectionTotalIncome += chargedIncome;
      sectionTotalSubsidy += subsidyPortion;
    });
    // Derive category totalIncome/totalSubsidy from items
    Object.values(consolidatedCategories).forEach(cat => {
      cat.totalIncome = Object.values(cat.items).reduce((s, item) => s + (Number(item.income) || 0), 0);
      cat.totalSubsidy = Object.values(cat.items).reduce((s, item) => s + (Number(item.subsidy) || 0), 0);
    });
    // Recompute section totals from categories so displayed total matches sum of rows (no inconsistency)
    sectionTotal = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.total) || 0), 0);
    sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.1.1",
      sectionName: "Personnel Services",
      sectionDescription: "Personnel-related expenditures including salaries, allowances, and benefits",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEmployees,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
    psData.forEach((employee) => {
      const region = employee.region || 'Unspecified';
      regionSet.add(region);
      totalEmployees++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEmployees: 0,
          categories: {}
        };
      }
      grouped[region].totalEmployees++;
      // Process each category in the structure
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        if (!grouped[region].categories[categoryKey]) {
          grouped[region].categories[categoryKey] = {
            name: categoryData.name,
            items: {},
            total: 0
          };
        }
        const category = grouped[region].categories[categoryKey];
        // Process each item in the category
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!category.items[itemKey]) {
            category.items[itemKey] = {
              name: itemData.name,
              amount: 0
            };
          }
          // Calculate amount based on field mapping
          let amount = 0;
          if (itemData.field) {
            // Special handling for Salaries and Wages based on statusOfAppointment
            if (categoryKey === '1' && itemKey === 'a') {
              // Salaries - Regular (Authorized Positions) = Permanent only
              if (employee.statusOfAppointment === 'PERMANENT') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              // Casual Personnel = Casual only
              if (employee.statusOfAppointment === 'CASUAL') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else {
              // Regular field mapping for other items
              if (itemData.field.includes(',')) {
                // Handle combined fields (like midyearBonus,yearEndBonus)
                const fields = itemData.field.split(',');
                amount = fields.reduce((sum, field) => sum + (Number(employee[field.trim()]) || 0), 0);
              } else {
                amount = Number(employee[itemData.field]) || 0;
              }
            }
          }
          category.items[itemKey].amount += amount;
          category.total += amount;
        });
      });
      // Calculate employee total
      const employeeTotal = Number(employee.Total) || 0;
      sectionTotal += employeeTotal;
    });
    return {
      sectionCode: "B.1.1",
      sectionName: "Personnel Services",
      sectionDescription: "Personnel-related expenditures including salaries, allowances, and benefits",
      sectionTotal,
      totalEmployees,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process MOOE data
const processMOOEData = async (mooeData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // When no data, always return consolidated shape so UI always shows MOOE section with table
  const hasData = Array.isArray(mooeData) && mooeData.length > 0;
  if (!hasData) {
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal: 0,
      sectionTotalIncome: 0,
      sectionTotalSubsidy: 0,
      totalEntries: 0,
      totalRegions: 0,
      consolidatedData: true,
      categories: {}
    };
  }
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only; exclude 0 value (only include amount > 0)
    const consolidatedCategories = {};
    mooeData.forEach((proposal) => {
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      let amount = income + subsidy;
      if (amount <= 0) amount = Number(proposal.amount) || 0;
      if (amount <= 0) return;
      regionSet.add(proposal.region || 'Unspecified');
      totalEntries++;
      const category = proposal.accountingTitle || 'Uncategorized';
      if (!consolidatedCategories[category]) {
        consolidatedCategories[category] = {
          name: category,
          total: 0,
          totalIncome: 0,
          totalSubsidy: 0,
          itemCount: 0,
          regions: new Set(),
          items: []
        };
      }
      consolidatedCategories[category].total += amount;
      consolidatedCategories[category].totalIncome += income;
      consolidatedCategories[category].totalSubsidy += subsidy;
      consolidatedCategories[category].itemCount++;
      consolidatedCategories[category].regions.add(proposal.region || 'Unspecified');
      consolidatedCategories[category].items.push({
        name: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        title: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        uacsCode: proposal.uacsCode,
        income,
        subsidy,
        amount
      });
      sectionTotal += amount;
    });
    // Remove categories with total 0
    Object.keys(consolidatedCategories).forEach(key => {
      if (consolidatedCategories[key].total === 0) delete consolidatedCategories[key];
    });
    // Convert Set to Array for JSON serialization
    Object.values(consolidatedCategories).forEach(cat => {
      cat.regions = Array.from(cat.regions);
    });
    const sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    const sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region); exclude 0 value
    const grouped = {};
    mooeData.forEach((proposal) => {
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      let amount = income + subsidy;
      if (amount <= 0) amount = Number(proposal.amount) || 0;
      if (amount <= 0) return;
      const region = proposal.region || 'Unspecified';
      regionSet.add(region);
      totalEntries++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEntries: 0,
          categories: {}
        };
      }
      grouped[region].totalEntries++;
      const category = proposal.accountingTitle || 'Uncategorized';
      if (!grouped[region].categories[category]) {
        grouped[region].categories[category] = {
          name: category,
          items: [],
          total: 0
        };
      }
      grouped[region].categories[category].items.push({
        title: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        uacsCode: proposal.uacsCode,
        income: income,
        subsidy: subsidy,
        amount: amount
      });
      grouped[region].categories[category].total += amount;
      sectionTotal += amount;
    });
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process Capital Outlay data
const processCapitalOutlayData = async (coData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // When no data, always return consolidated shape so UI always shows Capital Outlay section with table
  const hasData = Array.isArray(coData) && coData.length > 0;
  if (!hasData) {
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal: 0,
      sectionTotalIncome: 0,
      sectionTotalSubsidy: 0,
      totalEntries: 0,
      totalRegions: 0,
      consolidatedData: true,
      categories: {}
    };
  }
  // Fetch breakdown details (CapitalOutlayDetails) so report shows each row as created, not lumped
  const coIds = coData.map((p) => p._id).filter(Boolean);
  const detailsList = coIds.length > 0
    ? await CapitalOutlayDetails.find({ capital_outlay_id: { $in: coIds } }).sort({ createdAt: 1 }).lean()
    : [];
  const detailsByParent = new Map();
  detailsList.forEach((d) => {
    const id = (d.capital_outlay_id && d.capital_outlay_id.toString()) || d.capital_outlay_id;
    if (!id) return;
    if (!detailsByParent.has(id)) detailsByParent.set(id, []);
    detailsByParent.get(id).push(d);
  });

  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category; use breakdown rows (CapitalOutlayDetails) when present
    const consolidatedCategories = {};
    coData.forEach((proposal) => {
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      const detailRows = detailsByParent.get(proposal._id.toString()) || [];

      if (detailRows.length > 0) {
        detailRows.forEach((detail) => {
          const income = Number(detail.income_amount) || 0;
          const subsidy = Number(detail.subsidy_amount) || 0;
          const amount = income + subsidy;
          if (amount <= 0) return;
          regionSet.add(proposal.region || 'Unspecified');
          totalEntries++;
          if (!consolidatedCategories[categoryName]) {
            consolidatedCategories[categoryName] = {
              name: categoryName,
              total: 0,
              totalIncome: 0,
              totalSubsidy: 0,
              itemCount: 0,
              regions: new Set(),
              items: []
            };
          }
          consolidatedCategories[categoryName].total += amount;
          consolidatedCategories[categoryName].totalIncome += income;
          consolidatedCategories[categoryName].totalSubsidy += subsidy;
          consolidatedCategories[categoryName].itemCount++;
          consolidatedCategories[categoryName].regions.add(proposal.region || 'Unspecified');
          consolidatedCategories[categoryName].items.push({
            name: (detail.particulars || '').trim() || 'N/A',
            title: (detail.particulars || '').trim() || 'N/A',
            uacsCode: proposal.uacsCode,
            income,
            subsidy,
            amount
          });
          sectionTotal += amount;
        });
      } else {
        const income = Number(proposal.income) || 0;
        const subsidy = Number(proposal.subsidy) || 0;
        let amount = income + subsidy;
        if (amount <= 0) amount = Number(proposal.cost) || 0;
        if (amount <= 0) return;
        regionSet.add(proposal.region || 'Unspecified');
        totalEntries++;
        if (!consolidatedCategories[categoryName]) {
          consolidatedCategories[categoryName] = {
            name: categoryName,
            total: 0,
            totalIncome: 0,
            totalSubsidy: 0,
            itemCount: 0,
            regions: new Set(),
            items: []
          };
        }
        consolidatedCategories[categoryName].total += amount;
        consolidatedCategories[categoryName].totalIncome += income;
        consolidatedCategories[categoryName].totalSubsidy += subsidy;
        consolidatedCategories[categoryName].itemCount++;
        consolidatedCategories[categoryName].regions.add(proposal.region || 'Unspecified');
        consolidatedCategories[categoryName].items.push({
          name: proposal.particulars || proposal.sublineItem || proposal.accountingTitle || 'N/A',
          title: proposal.particulars || proposal.sublineItem || proposal.accountingTitle || 'N/A',
          uacsCode: proposal.uacsCode,
          income,
          subsidy,
          amount
        });
        sectionTotal += amount;
      }
    });
    // Remove categories with total 0
    Object.keys(consolidatedCategories).forEach(key => {
      if (consolidatedCategories[key].total === 0) delete consolidatedCategories[key];
    });
    Object.values(consolidatedCategories).forEach(cat => {
      cat.regions = Array.from(cat.regions);
    });
    const sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    const sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region; use breakdown rows (CapitalOutlayDetails) when present
    const grouped = {};
    coData.forEach((proposal) => {
      const region = proposal.region || 'Unspecified';
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      const detailRows = detailsByParent.get(proposal._id.toString()) || [];

      if (detailRows.length > 0) {
        detailRows.forEach((detail) => {
          const income = Number(detail.income_amount) || 0;
          const subsidy = Number(detail.subsidy_amount) || 0;
          const amount = income + subsidy;
          if (amount <= 0) return;
          regionSet.add(region);
          totalEntries++;
          if (!grouped[region]) {
            grouped[region] = { region, totalEntries: 0, categories: {} };
          }
          grouped[region].totalEntries++;
          if (!grouped[region].categories[categoryName]) {
            grouped[region].categories[categoryName] = { name: categoryName, items: [], total: 0 };
          }
          grouped[region].categories[categoryName].items.push({
            title: (detail.particulars || '').trim() || 'N/A',
            name: (detail.particulars || '').trim() || 'N/A',
            uacsCode: proposal.uacsCode,
            income,
            subsidy,
            amount
          });
          grouped[region].categories[categoryName].total += amount;
          sectionTotal += amount;
        });
      } else {
        const income = Number(proposal.income) || 0;
        const subsidy = Number(proposal.subsidy) || 0;
        let amount = income + subsidy;
        if (amount <= 0) amount = Number(proposal.cost) || 0;
        if (amount <= 0) return;
        regionSet.add(region);
        totalEntries++;
        if (!grouped[region]) {
          grouped[region] = { region, totalEntries: 0, categories: {} };
        }
        grouped[region].totalEntries++;
        if (!grouped[region].categories[categoryName]) {
          grouped[region].categories[categoryName] = { name: categoryName, items: [], total: 0 };
        }
        grouped[region].categories[categoryName].items.push({
          title: proposal.particulars || proposal.sublineItem || 'N/A',
          name: proposal.particulars || proposal.sublineItem || 'N/A',
          uacsCode: proposal.uacsCode,
          income,
          subsidy,
          amount
        });
        grouped[region].categories[categoryName].total += amount;
        sectionTotal += amount;
      }
    });
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};

const getComprehensiveReportPdf = async (req, res) => {
  try {
    if (!MuhammaraRecipe) {
      return res.status(500).json({
        success: false,
        message: 'PDF generation library (muhammara) is not installed on the server.'
      });
    }

    const { regions, region, fiscalYear, budgetType, groupBy, offices, responsibilityCenters } = req.query;
    const regionsParam = regions ?? region;
    const officesParam = offices ? (Array.isArray(offices) ? offices : [offices]) : [];
    const responsibilityCentersParam = responsibilityCenters ? (Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters]) : [];
    let preparerScope = null;
    const userRoles = req.user?.Roles || [];
    const isPreparer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_PREPARER') ||
      userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET PREPARER');
    if (isPreparer && req.user?.id) {
      const userIdString = String(req.user.id);
      const hua = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
        .populate('departmentId', 'Department departmentName DepartmentName')
        .lean();
      if (hua) {
        preparerScope = {
          division: hua.divisionName || '',
          department: hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || '',
          assignmentLevel: hua.assignmentLevel || ''
        };
      }
    }
    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam
    });

    if (!reportData || !reportData.summary) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate comprehensive report PDF',
        error: 'Report data or summary is missing',
      });
    }

    // Create temp file path for PDF output
    const tmpFilePath = path.join(
      os.tmpdir(),
      `comprehensive_report_${Date.now()}.pdf`
    );

    // Create PDF using Muhammara Recipe — A4 landscape, form holder, black text, optional logo
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Budget Summary Report',
      subject: 'Budget Summary Report',
    });

    // A4 landscape: 842 x 595 points
    const PAGE_WIDTH = 842;
    const PAGE_HEIGHT = 595;
    const MARGIN = 36;
    const MARGIN_TOP = 44;
    const MARGIN_BOTTOM = 44;
    const LINE_HEIGHT = 14;
    const CONTENT_LEFT = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - 100;
    const TABLE_AMOUNT_X = PAGE_WIDTH - 160;

    let currentY = MARGIN_TOP;

    const startNewPage = () => {
      pdfDoc.endPage();
      pdfDoc.createPage('A4', 90);
      currentY = MARGIN_TOP;
      drawFormHolder();
    };

    const textOpt = (opts = {}) => ({ color: '#000000', ...opts });

    const drawFormHolder = () => {
      pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, {
        stroke: '#000000',
        lineWidth: 1.5
      });
    };

    // First page — A4 landscape (createPage('A4', 90) swaps to 842x595)
    pdfDoc.createPage('A4', 90);
    drawFormHolder();

    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
    const regionsStr = reportData.summary.regions != null
      ? (Array.isArray(reportData.summary.regions) ? reportData.summary.regions.join(', ') : String(reportData.summary.regions))
      : '';

    let logoPath = path.join(__dirname, '../assets/logo.png');
    if (!fs.existsSync(logoPath)) {
      const clientLogo = path.join(__dirname, '../../CLIENT/public/logo.png');
      if (fs.existsSync(clientLogo)) logoPath = clientLogo;
    }
    const hasLogo = fs.existsSync(logoPath);

    if (hasLogo) {
      try {
        pdfDoc.image(logoPath, CONTENT_LEFT, currentY, { width: 44, height: 44 });
      } catch (e) {
        console.warn('PDF logo load failed:', e.message);
      }
    }

    const titleText = safeStr(reportData.summary.reportTitle) || 'BUDGET SUMMARY REPORT';
    const titleX = hasLogo ? CONTENT_LEFT + 60 : CONTENT_LEFT;
    pdfDoc.text(titleText, titleX, currentY, textOpt({ fontSize: 16, bold: true }));
    currentY += LINE_HEIGHT * 1.8;

    pdfDoc
      .text(`Fiscal Year: ${safeStr(reportData.summary.fiscalYear)}`, CONTENT_LEFT, currentY, textOpt({ fontSize: 11 }))
      .text(`Budget Type: ${safeStr(reportData.summary.budgetType)}`, 320, currentY, textOpt({ fontSize: 11 }));
    currentY += LINE_HEIGHT;
    pdfDoc.text(`Regions: ${regionsStr}`, CONTENT_LEFT, currentY, textOpt({ fontSize: 11 }));
    currentY += LINE_HEIGHT;
    pdfDoc.text(`Generated: ${safeStr(reportData.summary.generatedDate)}`, CONTENT_LEFT, currentY, textOpt({ fontSize: 10, color: '#333333' }));
    currentY += LINE_HEIGHT * 1.5;

    const boxLeft = CONTENT_LEFT;
    const boxWidth = CONTENT_WIDTH - (boxLeft - CONTENT_LEFT);
    pdfDoc
      .rectangle(boxLeft, currentY - 8, boxWidth, 72, {
        stroke: '#000000',
        lineWidth: 1
      })
      .text(`Total Regions: ${Number(reportData.summary.totalRegions) || 0}`, boxLeft + 12, currentY, textOpt({ fontSize: 11 }))
      .text(
        `Total Employees: ${Number(reportData.summary.totalEmployees) || 0}`,
        boxLeft + 320,
        currentY,
        textOpt({ fontSize: 11 })
      );
    currentY += LINE_HEIGHT;
    const grandTotalNum = Number(reportData.summary.grandTotal) || 0;
    pdfDoc.text(
      `Grand Total: ${grandTotalNum.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`,
      boxLeft + 12,
      currentY,
      textOpt({ fontSize: 12, bold: true })
    );
    currentY += LINE_HEIGHT * 2.2;

    pdfDoc.text('Section Summary', CONTENT_LEFT, currentY, textOpt({ fontSize: 13, bold: true }));
    currentY += LINE_HEIGHT * 1.2;

    pdfDoc
      .text('Code', CONTENT_LEFT, currentY, textOpt({ bold: true, fontSize: 10 }))
      .text('Section', CONTENT_LEFT + 70, currentY, textOpt({ bold: true, fontSize: 10 }))
      .text('Amount (PHP)', TABLE_AMOUNT_X, currentY, textOpt({ bold: true, fontSize: 10 }));
    currentY += LINE_HEIGHT;

    pdfDoc.rectangle(CONTENT_LEFT, currentY - 4, TABLE_AMOUNT_X - CONTENT_LEFT + 100, 0.5, {
      stroke: '#000000',
      lineWidth: 0.5
    });
    currentY += LINE_HEIGHT / 2;

    reportData.sections.forEach((section) => {
      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
        startNewPage();
      }
      const sectionTotalNum = Number(section.sectionTotal) || 0;
      pdfDoc
        .text(String(section.sectionCode || ''), CONTENT_LEFT, currentY, textOpt({ fontSize: 10 }))
        .text(String(section.sectionName || ''), CONTENT_LEFT + 70, currentY, textOpt({ fontSize: 10 }))
        .text(
          sectionTotalNum.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }),
          TABLE_AMOUNT_X,
          currentY,
          textOpt({ fontSize: 10 })
        );
      currentY += LINE_HEIGHT;
    });

    reportData.sections.forEach((section) => {
      if (!section.categories) return;

      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM * 2) {
        startNewPage();
      } else {
        currentY += LINE_HEIGHT * 1.2;
      }

      pdfDoc.text(
        `${section.sectionCode || ''} - ${section.sectionName || ''}`,
        CONTENT_LEFT,
        currentY,
        textOpt({ fontSize: 12, bold: true })
      );
      currentY += LINE_HEIGHT;

      if (section.sectionDescription) {
        pdfDoc.text(section.sectionDescription, CONTENT_LEFT, currentY, textOpt({ fontSize: 10 }));
        currentY += LINE_HEIGHT * 1.1;
      }

      pdfDoc
        .text('Category', CONTENT_LEFT, currentY, textOpt({ bold: true, fontSize: 10 }))
        .text('Description', CONTENT_LEFT + 200, currentY, textOpt({ bold: true, fontSize: 10 }))
        .text('Amount (PHP)', TABLE_AMOUNT_X, currentY, textOpt({ bold: true, fontSize: 10 }));
      currentY += LINE_HEIGHT;

      pdfDoc.rectangle(CONTENT_LEFT, currentY - 4, TABLE_AMOUNT_X - CONTENT_LEFT + 100, 0.5, {
        stroke: '#000000',
        lineWidth: 0.5
      });
      currentY += LINE_HEIGHT / 2;

      Object.values(section.categories || {}).forEach((category) => {
        if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
          startNewPage();
        }
        const amountNum = Number(
          category.total ?? category.totalSubsidy ?? category.totalIncome
        ) || 0;
        pdfDoc
          .text(String(category.name || ''), CONTENT_LEFT, currentY, textOpt({ fontSize: 9 }))
          .text(String(category.description || ''), CONTENT_LEFT + 200, currentY, textOpt({ fontSize: 9 }))
          .text(
            amountNum.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }),
            TABLE_AMOUNT_X,
            currentY,
            textOpt({ fontSize: 9 })
          );
        currentY += LINE_HEIGHT;
      });
    });

    // Close last page and finalize PDF, then stream file to response
    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        console.error('Error finalizing PDF:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate comprehensive report PDF',
          error: err.message || String(err),
        });
      }
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=Comprehensive_Report_${String(fiscalYear || 'AllYears')}_${String(budgetType || 'AllTypes')}.pdf`
      );

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('Error streaming comprehensive report PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to stream comprehensive report PDF',
            error: streamErr.message,
          });
        }
      });

      res.on('finish', () => {
        fs.unlink(tmpFilePath, () => {});
      });

      readStream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating comprehensive report PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate comprehensive report PDF',
        error: error.message || String(error),
      });
    }
  }
};
// Get available regions from all data sources
const getAvailableRegionsComprehensive = async (req, res) => {
  try {
    const [incomeRegions, psRegions, mooeRegions, coRegions] = await Promise.all([
      Income.distinct('region'),
      PersonnelServices.distinct('region'),
      MooeProposal.distinct('region'),
      CapitalOutlay.distinct('region')
    ]);
    const allRegions = new Set([...incomeRegions, ...psRegions, ...mooeRegions, ...coRegions]);
    const regions = Array.from(allRegions).filter(region => region && region.trim() !== '');
    res.status(200).json({
      success: true,
      regions: regions.sort()
    });
  } catch (error) {
    console.error('Error fetching available regions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available regions',
      error: error.message
    });
  }
};
// Get available fiscal years from all data sources
const getAvailableFiscalYears = async (req, res) => {
  try {
    const [settingsFiscalYears, incomeFiscalYears, psFiscalYears, mooeFiscalYears, coFiscalYears] = await Promise.all([
      Settings.distinct('fiscalYear'),
      Income.distinct('fiscalYear'),
      PersonnelServices.distinct('fiscalYear'),
      MooeProposal.distinct('fiscalYear'),
      CapitalOutlay.distinct('fiscalYear')
    ]);
    const allFiscalYears = new Set([...settingsFiscalYears, ...incomeFiscalYears, ...psFiscalYears, ...mooeFiscalYears, ...coFiscalYears]);
    const fiscalYears = Array.from(allFiscalYears).filter(year => year && year.trim() !== '').sort((a, b) => b.localeCompare(a));
    res.status(200).json({
      success: true,
      fiscalYears: fiscalYears
    });
  } catch (error) {
    console.error('Error fetching available fiscal years:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available fiscal years',
      error: error.message
    });
  }
};
// Get available budget types from all data sources
const getAvailableBudgetTypes = async (req, res) => {
  try {
    const [settingsBudgetTypes, incomeBudgetTypes, psBudgetTypes, mooeBudgetTypes, coBudgetTypes] = await Promise.all([
      Settings.distinct('budgetType'),
      Income.distinct('budgetType'),
      PersonnelServices.distinct('budgetType'),
      MooeProposal.distinct('budgetType'),
      CapitalOutlay.distinct('budgetType')
    ]);
    const allBudgetTypes = new Set([...settingsBudgetTypes, ...incomeBudgetTypes, ...psBudgetTypes, ...mooeBudgetTypes, ...coBudgetTypes]);
    const budgetTypes = Array.from(allBudgetTypes).filter(type => type && type.trim() !== '').sort();
    res.status(200).json({
      success: true,
      budgetTypes: budgetTypes
    });
  } catch (error) {
    console.error('Error fetching available budget types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available budget types',
      error: error.message
    });
  }
};
// Get active settings
const getActiveSettings = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    res.status(200).json({
      success: true,
      settings: activeSettings
    });
  } catch (error) {
    console.error('Error fetching active settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active settings',
      error: error.message
    });
  }
};

const getAvailableOfficesComprehensive = async (req, res) => {
  try {
    const { region, fiscalYear } = req.query;
    const baseQuery = {};
    if (region && region !== 'all') baseQuery.region = region;
    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;
    const [incomeDepts, psDepts, mooeDepts, coDepts] = await Promise.all([
      Income.distinct('department', baseQuery),
      PersonnelServices.distinct('department', baseQuery),
      MooeProposal.distinct('department', baseQuery),
      CapitalOutlay.distinct('department', baseQuery)
    ]);
    const all = new Set([...incomeDepts, ...psDepts, ...mooeDepts, ...coDepts]);
    const offices = Array.from(all).filter(Boolean).map(String).filter(s => s.trim() !== '').sort();
    res.status(200).json({ success: true, offices });
  } catch (error) {
    console.error('Error fetching available offices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available offices', error: error.message });
  }
};

const getAvailableResponsibilityCentersComprehensive = async (req, res) => {
  try {
    const { region, fiscalYear } = req.query;
    const baseQuery = {};
    if (region && region !== 'all') baseQuery.region = region;
    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;
    const [incomeDiv, psDiv, mooeDiv, coDiv] = await Promise.all([
      Income.distinct('division', baseQuery),
      PersonnelServices.distinct('division', baseQuery),
      MooeProposal.distinct('division', baseQuery),
      CapitalOutlay.distinct('division', baseQuery)
    ]);
    const all = new Set([...incomeDiv, ...psDiv, ...mooeDiv, ...coDiv]);
    const responsibilityCenters = Array.from(all).filter(Boolean).map(String).filter(s => s.trim() !== '').sort();
    res.status(200).json({ success: true, responsibilityCenters });
  } catch (error) {
    console.error('Error fetching available responsibility centers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch responsibility centers', error: error.message });
  }
};

module.exports = {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableOfficesComprehensive,
  getAvailableResponsibilityCentersComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings,
  getComprehensiveReportPdf
};