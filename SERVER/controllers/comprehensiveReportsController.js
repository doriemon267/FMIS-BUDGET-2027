const fs = require('fs');
const os = require('os');
const path = require('path');
const PersonnelServices = require('../models/PersonnelServices');
const COSPersonnel = require('../models/COSPersonnel');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Income = require('../models/Income');
const Region = require('../models/Region');
const Settings = require('../models/Settings');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
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
          "h": { name: "Additional Medical Allowance", field: "additionalMedical" },
          "i": { name: "Meal Allowances", field: "meal" },
          "j": { name: "Per Diem & Allowance of Board of Directors", field: "perDiem" },
          "k": { name: "Subsistence Allowance", field: "subsistenceAllowance" },
          "l": { name: "Longevity Pay (Loyalty Award)", field: "loyaltyAward" },
          "m": { name: "Overtime Services", field: "overtimePay" },
          "n": { name: "Special Counsel Allowance", field: "specialCounsel" },
          "o": { name: "Productivity Enhancement Incentive", field: "productivityIncentive" },
          "p": { name: "Cash Gift", field: "cashGift" },
          "q": { name: "Mid-Year and Year-End Bonus", field: "midyearBonus,yearEndBonus" },
          "r": { name: "Performance Based Bonus", field: "performanceBonus" },
          "s": { name: "Hazard Pay", field: "hazardPay" },
          "t": { name: "Other Bonuses and Allowances", field: "otherBonuses" },
          "u": { name: "Anniversary Bonus", field: "anniversaryBonus" }
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
/**
 * Add approver scope filter: restrict to proposals with status FORWARDED_TO_APPROVER or RETURNED_TO_APPROVER.
 * When approverProposalFilter is provided and has IDs, only data linked to those proposals is included.
 * When approverProposalFilter is provided but has empty IDs, return early with empty report.
 */
const getRoleBasedProposalFilterFromRequest = async (req, regionsParam, fiscalYear, budgetType) => {
  const userRoles = req.user?.Roles || [];
  const isApprover = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_APPROVER') ||
    userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET APPROVER');
  const isReviewer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_REVIEWER') ||
    userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET REVIEWER');
  if ((!isApprover && !isReviewer) || !fiscalYear || !budgetType) return null;

  const statuses = isApprover
    ? ['FORWARDED_TO_APPROVER', 'RETURNED_TO_APPROVER']
    : ['FORWARDED_TO_REVIEWER', 'RETURNED_TO_REVIEWER'];

  const modelTypeMap = { NEP: 'NEP', GAA: 'GAA' };
  const modelType = modelTypeMap[String(budgetType).toUpperCase()] || 'Initial';
  const fyNum = Number(fiscalYear) || parseInt(fiscalYear, 10);

  const npwQuery = {
    status: { $in: statuses },
    fiscalYear: Number.isFinite(fyNum) ? fyNum : parseInt(String(fiscalYear), 10),
    modelType
  };

  if (regionsParam && regionsParam !== 'all') {
    const regionList = Array.isArray(regionsParam) ? regionsParam : [regionsParam];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    const regionIds = regionDocs.map((r) => r._id);
    if (regionIds.length > 0) npwQuery.region = { $in: regionIds };
  }

  const npwDocs = await NewProposalWorkflow.find(npwQuery).select('_id').lean();
  const workflowIds = npwDocs.map((d) => d._id);
  const proposalDocs = await Proposal.find({ proposalId: { $in: workflowIds } }).select('_id').lean();
  const proposalIds = proposalDocs.map((d) => d._id);
  return { workflowIds, proposalIds };
};

const applyApproverProposalFilter = (baseQuery, approverProposalFilter) => {
  if (!approverProposalFilter || (!approverProposalFilter.workflowIds?.length && !approverProposalFilter.proposalIds?.length)) {
    return null; // No filter to apply
  }
  const orConditions = [];
  if (approverProposalFilter.workflowIds?.length) {
    orConditions.push({ workflowRef: { $in: approverProposalFilter.workflowIds } });
  }
  if (approverProposalFilter.proposalIds?.length) {
    orConditions.push({ proposalId: { $in: approverProposalFilter.proposalIds } });
  }
  return orConditions.length ? { $and: [{ ...baseQuery }, { $or: orConditions }] } : baseQuery;
};

const buildComprehensiveReportData = async ({ regions, fiscalYear, budgetType, preparerScope, groupBy, offices, responsibilityCenters, approverProposalFilter }) => {
  // Budget Approver: when no proposals passed to them, return empty report (page accessible, data empty)
  const isEmptyApproverScope = approverProposalFilter && !approverProposalFilter.workflowIds?.length && !approverProposalFilter.proposalIds?.length;
  if (isEmptyApproverScope) {
    return {
      summary: {
        reportTitle: 'BUDGET SUMMARY REPORT',
        fiscalYear: fiscalYear || 'All Years',
        budgetType: budgetType || 'All Types',
        regions: regions ? (Array.isArray(regions) ? regions : [regions]) : ['All Regions'],
        generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        totalRegions: 0,
        totalEmployees: 0,
        grandTotal: 0,
        totalIncome: 0,
        totalSubsidy: 0,
        department: preparerScope?.department || '',
        division: preparerScope?.division || '',
        approverNoProposals: true // Budget Approver: no proposals passed to them yet
      },
      sections: []
    };
  }

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

  const incomeQuery = applyApproverProposalFilter(query, approverProposalFilter) || query;
  const psQuery = applyApproverProposalFilter(query, approverProposalFilter) || query;
  const mooeQueryFinal = applyApproverProposalFilter(mooeQuery, approverProposalFilter) || mooeQuery;
  const coQueryFinal = applyApproverProposalFilter(coQuery, approverProposalFilter) || coQuery;

  // Fetch data from all sources concurrently
  const [incomeData, psData, mooeData, coData] = await Promise.all([
    Income.find(incomeQuery).lean(),
    PersonnelServices.find(psQuery).lean(),
    MooeProposal.find(mooeQueryFinal).lean(),
    CapitalOutlay.find(coQueryFinal).populate('category').lean()
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
      totalSubsidy: 0,
      department: preparerScope?.department || '',
      division: preparerScope?.division || ''
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
    let approverProposalFilter = null;
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

    approverProposalFilter = await getRoleBasedProposalFilterFromRequest(req, regionsParam, fiscalYear, budgetType);

    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam,
      approverProposalFilter
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
    const approverProposalFilter = await getRoleBasedProposalFilterFromRequest(req, regionsParam, fiscalYear, budgetType);
    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam,
      approverProposalFilter
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

    // Create PDF using Muhammara Recipe — A4 portrait (Annex A format)
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Corporate Operating Budget',
      subject: 'Corporate Operating Budget - Annex A',
    });

    // A4 portrait: 595 x 842 points
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const MARGIN = 40;
    const MARGIN_TOP = 50;
    const MARGIN_BOTTOM = 60;
    const LINE_HEIGHT = 12;
    const CONTENT_LEFT = MARGIN + 10;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN - 10;
    const CENTER_X = PAGE_WIDTH / 2;
    const AMOUNT_COL_X = CONTENT_RIGHT - 80;

    let currentY = MARGIN_TOP;
    let currentPage = 1;

    const startNewPage = () => {
      pdfDoc.endPage();
      pdfDoc.createPage('A4');
      currentY = MARGIN_TOP;
      currentPage++;
      drawBorder();
    };

    const textOpt = (opts = {}) => ({ color: '#000000', ...opts });

    const drawBorder = () => {
      pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, {
        stroke: '#4d4c4c',
        lineWidth: 1.5
      });
    };

    // First page — A4 portrait with Annex A format
    pdfDoc.createPage('A4');
    drawBorder();

    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
    const regionsStr = reportData.summary.regions != null
      ? (Array.isArray(reportData.summary.regions) ? reportData.summary.regions.join(', ') : String(reportData.summary.regions))
      : '';

    // Draw logos (left: Seal.png and logo.png side by side, right: Bagong_Pilipinas.png)
    let sealPath = path.join(__dirname, '../assets/Seal.png');
    if (!fs.existsSync(sealPath)) {
      const clientSeal = path.join(__dirname, '../../CLIENT/public/Seal.png');
      if (fs.existsSync(clientSeal)) sealPath = clientSeal;
    }
    
    let nialogoPath = path.join(__dirname, '../assets/logo.png');
    if (!fs.existsSync(nialogoPath)) {
      const clientNiaLogo = path.join(__dirname, '../../CLIENT/public/logo.png');
      if (fs.existsSync(clientNiaLogo)) nialogoPath = clientNiaLogo;
    }
    
    let bagongPilipinasPath = path.join(__dirname, '../assets/Bagong_Pilipinas.png');
    if (!fs.existsSync(bagongPilipinasPath)) {
      const clientBagong = path.join(__dirname, '../../CLIENT/public/Bagong_Pilipinas.png');
      if (fs.existsSync(clientBagong)) bagongPilipinasPath = clientBagong;
    }
    
    const hasSeal = fs.existsSync(sealPath);
    const hasNiaLogo = fs.existsSync(nialogoPath);
    const hasBagong = fs.existsSync(bagongPilipinasPath);

    // Header section with logos
    const logoY = currentY + 5;
    const logoWidth = 40;
    const logoHeight = 40;
    
    if (hasSeal || hasNiaLogo || hasBagong) {
      try {
        // Left side: Seal.png and logo.png side by side
        if (hasSeal) {
          pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoWidth, height: logoHeight });
        }
        if (hasNiaLogo) {
          pdfDoc.image(nialogoPath, CONTENT_LEFT + logoWidth + 5, logoY, { width: logoWidth, height: logoHeight });
        }
        // Right side: Bagong_Pilipinas.png
        if (hasBagong) {
          pdfDoc.image(bagongPilipinasPath, CONTENT_RIGHT - logoWidth, logoY, { width: logoWidth, height: logoHeight });
        }
      } catch (e) {
        console.warn('PDF logo load failed:', e.message);
      }
    }

    // Header text (centered) - positioned next to logos
    const headerTextY = currentY + 8;
    pdfDoc
      .text('Republic of the Philippines', CENTER_X, headerTextY, textOpt({ fontSize: 8, align: 'center' }));
    
    let headerLineY = headerTextY + LINE_HEIGHT * 0.8;
    pdfDoc
      .text('OFFICE OF THE PRESIDENT', CENTER_X, headerLineY, textOpt({ fontSize: 8, bold: true, align: 'center' }));
    
    headerLineY += LINE_HEIGHT * 0.8;
    pdfDoc
      .text('NATIONAL IRRIGATION ADMINISTRATION', CENTER_X, headerLineY, textOpt({ fontSize: 8, bold: true, align: 'center', color: '#292e2a' }));
    
    // Determine what to display: Department/Division if available, otherwise Region
    const departmentName = safeStr(reportData.summary.department || '');
    const divisionName = safeStr(reportData.summary.division || '');
    const regionsArray = Array.isArray(reportData.summary.regions) ? reportData.summary.regions : [reportData.summary.regions];
    
    let departmentDivisionText = '';
    
    // Prefer Department/Division if they exist, otherwise show Region
    if (departmentName && divisionName) {
      // Both department and division available
      departmentDivisionText = `${departmentName} / ${divisionName}`;
    } else if (departmentName) {
      // Only department available
      departmentDivisionText = departmentName;
    } else if (divisionName) {
      // Only division available
      departmentDivisionText = divisionName;
    } else {
      // No department/division - show region instead
      if (regionsArray.length > 0 && regionsArray[0]) {
        departmentDivisionText = String(regionsArray[0]);
      } else {
        departmentDivisionText = 'OFFICE / DIVISION';
      }
    }
    
    headerLineY += LINE_HEIGHT * 0.8;
    pdfDoc
      .text(departmentDivisionText, CENTER_X, headerLineY, textOpt({ fontSize: 8, align: 'center' }));
    
    // ANNEX A (below Bagong_Pilipinas logo)
    pdfDoc.text('ANNEX A', CONTENT_RIGHT - 50, logoY + logoHeight + 5, textOpt({ fontSize: 10, bold: true }));
    
    currentY = logoY + logoHeight + 30;

    // Title and Fiscal Year
    pdfDoc.text('CORPORATE OPERATING BUDGET', CENTER_X, currentY, textOpt({ fontSize: 13, bold: true, align: 'center' }));
    currentY += LINE_HEIGHT * 1.2;
    pdfDoc.text(`FISCAL YEAR ${safeStr(reportData.summary.fiscalYear)}`, CENTER_X, currentY, textOpt({ fontSize: 11, bold: true, align: 'center' }));
    currentY += LINE_HEIGHT * 1.5;

    // Personnel statistics section - Get actual counts from PersonnelServices
    const totalEmployees = Number(reportData.summary.totalEmployees) || 0;
    
    // Build base query filter
    const baseFilter = {};
    if (regionsParam && regionsParam !== 'all') baseFilter.region = regionsParam;
    if (fiscalYear) baseFilter.fiscalYear = fiscalYear;
    if (budgetType) baseFilter.budgetType = budgetType;

    // Get actual employee counts from database using statusOfAppointment field
    // Non-Casual employees (PERMANENT, etc.)
    const filledPositionCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      statusOfAppointment: { $regex: '^PERMANENT$', $options: 'i' }
    });
    
    // Casual employees - search for "CASUAL" (case-insensitive)
    const casualCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      statusOfAppointment: { $regex: '^CASUAL$', $options: 'i' }
    });
    
    // COS (Contract of Service) employees - query from COSPersonnel table
    const cosCount = await COSPersonnel.countDocuments({ 
      ...baseFilter
    });

    // VACANT positions - search in employeeFullName field for "VACANT"
    const vacantCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      employeeFullName: { $regex: 'VACANT', $options: 'i' }
    });

    const filledPositions = filledPositionCount > 0 ? filledPositionCount : 0;
    const toBeFilledPositions = vacantCount > 0 ? vacantCount : 0;
    const casualEmployees = casualCount > 0 ? casualCount : 0;
    const cosPersonnel = cosCount > 0 ? cosCount : 0;

    pdfDoc
      .text(`No. of  Monthly Personnel Per Approved Staffing Pattern`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 7 }))
      .text(`${totalEmployees}`, CONTENT_RIGHT - 30, currentY, textOpt({ fontSize: 7, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Monthly Positions Filled Up`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 7 }))
      .text(`${filledPositions}`, CONTENT_RIGHT - 30, currentY, textOpt({ fontSize: 7, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Monthly Positions To Be Filled Up`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 7 }))
      .text(`${toBeFilledPositions}`, CONTENT_RIGHT - 30, currentY, textOpt({ fontSize: 7, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Appointive Casual Employees`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 7 }))
      .text(`${casualEmployees}`, CONTENT_RIGHT - 30, currentY, textOpt({ fontSize: 7, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  COS (Contract of Service) Personnel`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 7 }))
      .text(`${cosPersonnel}`, CONTENT_RIGHT - 30, currentY, textOpt({ fontSize: 7, align: 'right' }));
    currentY += LINE_HEIGHT * 1.2;

    // USES OF FUNDS section header
    pdfDoc.text('USES OF FUNDS', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 10, bold: true, underline: true }));
    currentY += LINE_HEIGHT * 1;

    // Render sections with hierarchical numbering
    let sectionNumber = 1;
    let grandTotalAmount = 0;

    reportData.sections.forEach((section) => {
      if (!section.categories) return;

      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM * 3) {
        startNewPage();
      }

      const sectionTotal = Number(section.sectionTotal) || 0;
      grandTotalAmount += sectionTotal;

      // Main section header (1, 2, 3)
      pdfDoc
        .text(`${sectionNumber}`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9, bold: true }))
        .text(
          `${section.sectionName || ''}`.toUpperCase(),
          CONTENT_LEFT + 25, 
          currentY,
          textOpt({ fontSize: 9, bold: true })
        )
        .text(
          sectionTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
          AMOUNT_COL_X,
          currentY,
          textOpt({ fontSize: 9, bold: true, align: 'right' })
        );
      currentY += LINE_HEIGHT;

      // Section description if available
      if (section.sectionDescription) {
        pdfDoc.text(section.sectionDescription, CONTENT_LEFT + 25, currentY, textOpt({ fontSize: 7, color: '#555555' }));
        currentY += LINE_HEIGHT * 0.75;
      }

      // Render categories with letter numbering (a, b, c, etc.)
      const categories = Object.values(section.categories || {});
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      
      categories.forEach((category, idx) => {
        if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
          startNewPage();
        }

        const categoryAmount = Number(
          category.total ?? category.totalSubsidy ?? category.totalIncome
        ) || 0;

        // Category line with letter (a., b., c., etc.)
        if (idx < letters.length) {
          pdfDoc
            .text(`${letters[idx]}.`, CONTENT_LEFT + 30, currentY, textOpt({ fontSize: 8 }))
            .text(
              String(category.name || ''),
              CONTENT_LEFT + 45,
              currentY,
              textOpt({ fontSize: 8 })
            );
          
          // Show amount if no sub-items or show total with sub-items
          if (!category.items || (Array.isArray(category.items) && category.items.length === 0) || 
              (typeof category.items === 'object' && Object.keys(category.items).length === 0)) {
            pdfDoc.text(
              categoryAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
              AMOUNT_COL_X,
              currentY,
              textOpt({ fontSize: 8, align: 'right' })
            );
          }
          currentY += LINE_HEIGHT * 0.8;

          // Render sub-items if available
          if (category.items) {
            const itemsArray = Array.isArray(category.items) ? category.items : Object.values(category.items);
            itemsArray.forEach((item, itemIdx) => {
              if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
                startNewPage();
              }

              const itemAmount = Number(item?.amount ?? item?.subsidy ?? item?.income) || 0;
              if (itemAmount > 0 || item?.name) {
                pdfDoc
                  .text(
                    `${itemIdx + 1}.`,
                    CONTENT_LEFT + 55,
                    currentY,
                    textOpt({ fontSize: 7 })
                  )
                  .text(
                    String(item?.name || ''),
                    CONTENT_LEFT + 65,
                    currentY,
                    textOpt({ fontSize: 7 })
                  )
                  .text(
                    itemAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
                    AMOUNT_COL_X,
                    currentY,
                    textOpt({ fontSize: 7, align: 'right' })
                  );
                currentY += LINE_HEIGHT * 0.7;
              }
            });
          }
        }
      });

      // Section total line
      pdfDoc
        .text(`TOTAL ${section.sectionName?.toUpperCase() || 'SECTION'}:`, CONTENT_LEFT + 30, currentY, textOpt({ fontSize: 9, bold: true }))
        .text(
          sectionTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
          AMOUNT_COL_X,
          currentY,
          textOpt({ fontSize: 9, bold: true, align: 'right' })
        );
      currentY += LINE_HEIGHT * 1.2;

      sectionNumber++;
    });

    // Grand total at bottom with line above
    if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM - 30) {
      startNewPage();
    }
    pdfDoc.rectangle(CONTENT_LEFT + 10, currentY - 3, CONTENT_RIGHT - CONTENT_LEFT - 20, 0.5, {
      stroke: '#000000',
      lineWidth: 0.5
    });
    currentY += LINE_HEIGHT * 0.8;
    
    pdfDoc
      .text('TOTAL USES OF FUNDS FOR OPERATION', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 10, bold: true }))
      .text(
        grandTotalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
        AMOUNT_COL_X,
        currentY,
        textOpt({ fontSize: 10, bold: true, align: 'right' })
      );
    currentY += LINE_HEIGHT * 1.5;

    // Page footer with page number
    pdfDoc.text(`Annex A (Summary)`, CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
    pdfDoc.text(`Page ${currentPage}`, CONTENT_RIGHT - 60, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));

    // Second page - Signature blocks
    startNewPage();
    currentY = MARGIN_TOP + 20;

    // NET INCOME FROM OPERATION
    pdfDoc
      .text('NET INCOME FROM OPERATION', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 10, bold: true }))
      .text(
        grandTotalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
        AMOUNT_COL_X,
        currentY,
        textOpt({ fontSize: 10, bold: true, align: 'right' })
      );
    
    pdfDoc.rectangle(CONTENT_LEFT + 10, currentY + 10, CONTENT_RIGHT - CONTENT_LEFT - 20, 0.5, {
      stroke: '#000000',
      lineWidth: 0.5
    });
    currentY += LINE_HEIGHT * 4;

    // Signature blocks
    const sigY = currentY + 50;
    
    // Prepared by
    pdfDoc.text('Prepared by:', CONTENT_LEFT + 20, currentY, textOpt({ fontSize: 9 }));
    pdfDoc.text('_____________________________', CONTENT_LEFT + 20, sigY, textOpt({ fontSize: 9 }));
    pdfDoc.text('Budget Officer', CONTENT_LEFT + 20, sigY + LINE_HEIGHT, textOpt({ fontSize: 8, bold: true }));
    
    currentY += LINE_HEIGHT * 8;

    // Reviewed by
    pdfDoc.text('Reviewed by:', CONTENT_LEFT + 20, currentY, textOpt({ fontSize: 9 }));
    pdfDoc.text('_____________________________', CONTENT_LEFT + 20, currentY + 50, textOpt({ fontSize: 9 }));
    pdfDoc.text('Manager, Management Information Division', CONTENT_LEFT + 20, currentY + 62, textOpt({ fontSize: 8, bold: true }));
    pdfDoc.text('BSC', CONTENT_LEFT + 20, currentY + 72, textOpt({ fontSize: 7 }));
    pdfDoc.text('BSC', CONTENT_LEFT + 20, currentY + 80, textOpt({ fontSize: 7 }));
    
    currentY += LINE_HEIGHT * 12;

    // Noted by
    pdfDoc.text('Noted by:', CONTENT_LEFT + 20, currentY, textOpt({ fontSize: 9 }));
    pdfDoc.text('_____________________________', CONTENT_LEFT + 20, currentY + 50, textOpt({ fontSize: 9 }));
    pdfDoc.text('Manager, Corporate Planning Services', CONTENT_LEFT + 20, currentY + 62, textOpt({ fontSize: 8, bold: true }));
    
    // Page footer
    pdfDoc.text(`Annex A (Summary)`, CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
    pdfDoc.text(`Page ${currentPage}`, CONTENT_RIGHT - 60, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));

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