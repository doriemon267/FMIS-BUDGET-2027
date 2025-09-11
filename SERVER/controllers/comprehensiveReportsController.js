const PersonnelServices = require('../models/personnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const Region = require('../models/Region');
const Settings = require('../models/Settings');
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
            name: "Personal Services",
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
    name: "PERSONAL SERVICES",
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
const getComprehensiveReportData = async (req, res) => {
  try {
    const { regions, fiscalYear, budgetType } = req.query;
    // Build base query
    const query = {};
    if (regions) {
      const regionList = Array.isArray(regions) ? regions : [regions];
      query.region = { $in: regionList };
    }
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Fetch data from all sources concurrently
    const [incomeData, psData, mooeData, coData] = await Promise.all([
      Income.find(query).lean(),
      PersonnelServices.find(query).lean(),
      MooeProposal.find(query).lean(),
      CapitalOutlay.find(query).populate('category').lean()
    ]);
    // Initialize comprehensive report structure
    const reportData = {
      summary: {
        reportTitle: "COMPREHENSIVE BUDGET REPORT",
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
        grandTotal: 0
      },
      sections: []
    };
    // Process Corporate Income data
    if (Array.isArray(incomeData) && incomeData.length > 0) {
      const incomeSection = await processCorporateIncomeData(incomeData, query);
      reportData.sections.push(incomeSection);
      reportData.summary.grandTotal += incomeSection.sectionTotal;
    }
    // Process Personnel Services data
    if (Array.isArray(psData) && psData.length > 0) {
      const psSection = await processPersonnelServicesData(psData, query);
      reportData.sections.push(psSection);
      reportData.summary.totalEmployees = psSection.totalEmployees;
      reportData.summary.grandTotal += psSection.sectionTotal;
    }
    // Process MOOE data
    if (Array.isArray(mooeData) && mooeData.length > 0) {
      const mooeSection = await processMOOEData(mooeData, query);
      reportData.sections.push(mooeSection);
      reportData.summary.grandTotal += mooeSection.sectionTotal;
    }
    // Process Capital Outlay data
    if (Array.isArray(coData) && coData.length > 0) {
      const coSection = await processCapitalOutlayData(coData, query);
      reportData.sections.push(coSection);
      reportData.summary.grandTotal += coSection.sectionTotal;
    }
    // Get unique regions count
    const allRegions = new Set();
    [...incomeData, ...psData, ...mooeData, ...coData].forEach(item => {
      if (item.region) allRegions.add(item.region);
    });
    reportData.summary.totalRegions = allRegions.size;
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
    // Convert Set to Array for JSON serialization
    Object.values(consolidatedCategories).forEach(category => {
      category.regions = Array.from(category.regions);
    });
    // Return consolidated structure - no individual items, just totals
    return {
      sectionCode: "A.1",
      sectionName: "CORPORATE INCOME",
      sectionDescription: "Total agency income from various sources and categories",
      sectionTotal,
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
    psData.forEach((employee) => {
      regionSet.add(employee.region || 'Unspecified');
      totalEmployees++;
      // Process each category in the structure
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        if (!consolidatedCategories[categoryKey]) {
          consolidatedCategories[categoryKey] = {
            name: categoryData.name,
            items: {},
            total: 0
          };
        }
        const category = consolidatedCategories[categoryKey];
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
    // Return consolidated structure - no region grouping
    return {
      sectionCode: "B.1.1",
      sectionName: "PERSONAL SERVICES",
      sectionDescription: "Personnel-related expenditures including salaries, allowances, and benefits",
      sectionTotal,
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
      sectionName: "PERSONAL SERVICES",
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
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only
    const consolidatedCategories = {};
    mooeData.forEach((proposal) => {
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
          regions: new Set()
        };
      }
      // Calculate amount = income + subsidy
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      const amount = income + subsidy;
      consolidatedCategories[category].total += amount;
      consolidatedCategories[category].totalIncome += income;
      consolidatedCategories[category].totalSubsidy += subsidy;
      consolidatedCategories[category].itemCount++;
      consolidatedCategories[category].regions.add(proposal.region || 'Unspecified');
      sectionTotal += amount;
    });
    // Convert Set to Array for JSON serialization
    Object.values(consolidatedCategories).forEach(category => {
      category.regions = Array.from(category.regions);
    });
    // Return consolidated structure - no individual items, just totals
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
    mooeData.forEach((proposal) => {
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
      // Calculate amount = income + subsidy
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      const amount = income + subsidy;
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
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only
    const consolidatedCategories = {};
    coData.forEach((proposal) => {
      regionSet.add(proposal.region || 'Unspecified');
      totalEntries++;
      // Get category name from populated category or use accountingTitle
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      if (!consolidatedCategories[categoryName]) {
        consolidatedCategories[categoryName] = {
          name: categoryName,
          total: 0,
          totalIncome: 0,
          totalSubsidy: 0,
          itemCount: 0,
          regions: new Set()
        };
      }
      // Calculate amount = income + subsidy
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      const amount = income + subsidy;
      consolidatedCategories[categoryName].total += amount;
      consolidatedCategories[categoryName].totalIncome += income;
      consolidatedCategories[categoryName].totalSubsidy += subsidy;
      consolidatedCategories[categoryName].itemCount++;
      consolidatedCategories[categoryName].regions.add(proposal.region || 'Unspecified');
      sectionTotal += amount;
    });
    // Convert Set to Array for JSON serialization
    Object.values(consolidatedCategories).forEach(category => {
      category.regions = Array.from(category.regions);
    });
    // Return consolidated structure - no individual items, just totals
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
    coData.forEach((proposal) => {
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
      // Get category name from populated category or use accountingTitle
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      if (!grouped[region].categories[categoryName]) {
        grouped[region].categories[categoryName] = {
          name: categoryName,
          items: [],
          total: 0
        };
      }
      // Calculate amount = income + subsidy
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      const amount = income + subsidy;
      grouped[region].categories[categoryName].items.push({
        title: proposal.particulars || proposal.sublineItem || 'N/A',
        uacsCode: proposal.uacsCode,
        income: income,
        subsidy: subsidy,
        amount: amount
      });
      grouped[region].categories[categoryName].total += amount;
      sectionTotal += amount;
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
module.exports = {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings
};