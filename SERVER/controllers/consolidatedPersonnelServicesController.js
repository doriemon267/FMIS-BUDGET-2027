const PersonnelServices = require('../models/PersonnelServices');
// Define the hierarchical structure mapping
const PERSONNEL_SERVICES_STRUCTURE = {
  "B.1.1": {
    name: "Personnel Services",
    categories: {
      "1": {
        name: "Salaries and Wages",
        items: {
          "a": { name: "Salaries - Regular (Authorized Positions)", field: "annualSalary" },
          "b": { name: "Casual Personnel", field: "casualPersonnel" } // Will be calculated
        }
      },
      "2": {
        name: "Other Compensation",
        items: {
          "a": { name: "PERA", field: "PERA" },
          "b": { name: "Representation Allowance", field: "RATA" },
          "c": { name: "Transportation Allowance", field: "transportationAllowance" }, // Not in model
          "d": { name: "Honoraria", field: "honoraria" },
          "e": { name: "Uniform/Clothing Allowance", field: "uniformALLOWANCE" },
          "f": { name: "Children Allowances", field: "childrenAllowance" },
          "g": { name: "Medical Allowances", field: "medical" },
          "h": { name: "Additional Medical Allowance", field: "additionalMedical" },
          "i": { name: "Meal Allowances", field: "meal" },
          "j": { name: "Per Diem & Allowance of Board of Directors", field: "perDiem" }, // Not in model
          "k": { name: "Subsistence Allowance", field: "subsistenceAllowance" },
          "l": { name: "Longevity Pay (Loyalty Award)", field: "loyaltyAward" },
          "m": { name: "Overtime Services", field: "overtimePay" },
          "n": { name: "Special Counsel Allowance", field: "specialCounsel" }, // Not in model
          "o": { name: "Productivity Enhancement Incentive", field: "productivityIncentive" },
          "p": { name: "Cash Gift", field: "cashGift" },
          "q": { name: "Mid-Year and Year-End Bonus", field: "midyearBonus,yearEndBonus" }, // Combined
          "r": { name: "Performance Based Bonus", field: "performanceBonus" }, // Not in model
          "s": { name: "Hazard Pay", field: "hazardPay" },
          "t": { name: "Other Bonuses and Allowances", field: "otherBonuses" }, // Not in model
          "u": { name: "Anniversary Bonus", field: "anniversaryBonus" } // Not in model
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
          "e": { name: "Provident Fund", field: "providentFund" } // Not in model
        }
      },
      "5": {
        name: "REORG",
        items: {
          "a": { name: "Reorganization Costs", field: "reorgCosts" } // Not in model
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
const getConsolidatedPersonnelServicesData = async (req, res) => {
  try {
    const { regions, region, fiscalYear, budgetType, department, division } = req.query;
    // Build query
    const query = {};
    if (regions) {
      const regionList = Array.isArray(regions) ? regions : [regions];
      query.region = { $in: regionList };
    } else if (region) {
      query.region = region;
    }
    // Apply hierarchical filters if present
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (department) query.department = department;
    if (division) query.division = division;
    // Fetch all PersonnelServices data
    const psData = await PersonnelServices.find(query).lean();
    if (!Array.isArray(psData) || psData.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        summary: {
          totalRegions: 0,
          totalEmployees: 0,
          grandTotal: 0
        }
      });
    }
    // Group by region
    const grouped = {};
    const regionSet = new Set();
    let grandTotal = 0;
    let totalEmployees = 0;
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
      const employeeTotal = Math.round((Number(employee.Total) || 0) * 100) / 100;
      grandTotal += employeeTotal;
    });
    // Transform to array format
    let result;
    // Check if we should aggregate all regions into one
    if (!regions || (regions && regions.length === 0)) {
      // All regions case - aggregate everything into one consolidated structure
      const consolidatedCategories = {};
      let consolidatedEmployees = 0;
      Object.values(grouped).forEach(regionData => {
        consolidatedEmployees += regionData.totalEmployees;
        Object.entries(regionData.categories).forEach(([categoryKey, categoryData]) => {
          if (!consolidatedCategories[categoryKey]) {
            consolidatedCategories[categoryKey] = {
              key: categoryKey,
              name: categoryData.name,
              total: 0,
              items: {}
            };
          }
          consolidatedCategories[categoryKey].total += categoryData.total;
          Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
            if (!consolidatedCategories[categoryKey].items[itemKey]) {
              consolidatedCategories[categoryKey].items[itemKey] = {
                key: `${categoryKey}.${itemKey}`,
                name: itemData.name,
                amount: 0
              };
            }
            consolidatedCategories[categoryKey].items[itemKey].amount += itemData.amount;
          });
        });
      });
      result = [{
        id: 'ps-all-regions',
        region: 'ALL REGIONS',
        totalEmployees: consolidatedEmployees,
        categories: Object.entries(consolidatedCategories).map(([categoryKey, categoryData]) => ({
          id: `all-regions-${categoryKey}`,
          key: categoryKey,
          name: categoryData.name,
          total: categoryData.total,
          items: Object.entries(categoryData.items).map(([itemKey, itemData]) => ({
            id: `all-regions-${categoryKey}-${itemKey}`,
            key: itemData.key,
            name: itemData.name,
            amount: itemData.amount
          }))
        }))
      }];
    } else {
      // Individual regions case
      result = Object.values(grouped).map(regionData => ({
        id: `ps-${regionData.region}`,
        region: regionData.region,
        totalEmployees: regionData.totalEmployees,
        categories: Object.entries(regionData.categories).map(([categoryKey, categoryData]) => ({
          id: `${regionData.region}-${categoryKey}`,
          key: categoryKey,
          name: categoryData.name,
          total: categoryData.total,
          items: Object.entries(categoryData.items).map(([itemKey, itemData]) => ({
            id: `${regionData.region}-${categoryKey}-${itemKey}`,
            key: `${categoryKey}.${itemKey}`,
            name: itemData.name,
            amount: itemData.amount
          }))
        }))
      })).sort((a, b) => a.region.localeCompare(b.region));
    }
    res.status(200).json({
      success: true,
      data: result,
      summary: {
        totalRegions: regionSet.size,
        totalEmployees,
        grandTotal: Math.round(grandTotal * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching consolidated Personnel Services data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consolidated Personnel Services data',
      error: error.message
    });
  }
};
// Get available regions with Personnel Services data
const getAvailableRegions = async (req, res) => {
  try {
    // Build query to filter regions based on hierarchical access
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }
    const regions = await PersonnelServices.distinct('region', query);
    res.status(200).json({
      success: true,
      regions: regions.filter(region => region && region.trim() !== '')
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
// Debug endpoint to check statusOfAppointment values
const getStatusOfAppointmentValues = async (req, res) => {
  try {
    // Build query to filter data based on hierarchical access
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }
    const statuses = await PersonnelServices.distinct('statusOfAppointment', query);
    const sample = await PersonnelServices.findOne(query).select('statusOfAppointment annualSalary employeeFullName');
    res.status(200).json({
      success: true,
      distinctStatuses: statuses,
      sample: sample
    });
  } catch (error) {
    console.error('Error fetching status values:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status values',
      error: error.message
    });
  }
};
module.exports = {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues
};