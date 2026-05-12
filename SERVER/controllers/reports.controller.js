const Settings = require("../models/Settings");
const PersonnelService = require('../models/PersonnelServices');
const MOOEProposal = require("../models/mooeProposals");
const CapitalOutlay = require("../models/CapitalOutlay");
const Category = require("../models/Category");
const Income = require("../models/Income");
const Region = require("../models/Region");
const IncomeCategory = require("../models/IncomeCategory");
const IncomeSubCategory = require("../models/IncomeSubcategory");
const IAsOMCost = require("../models/IAsOMCost");
const getConsolidatedSummary = async (req, res) => {
  try {
    let fiscalYear;
    // Determine fiscal year
    if (req.query.fiscalYear) {
      fiscalYear = parseInt(req.query.fiscalYear, 10);
    } else {
      const activeSetting = await Settings.findOne({ isActive: true });
      if (!activeSetting)
        return res.status(404).json({ error: "No active settings found." });
      fiscalYear = activeSetting.fiscalYear;
    }
    // Build filter from query params
    const { region, department } = req.query;
    const filter = { fiscalYear };
    if (region && region.trim()) filter.region = region.trim();
    if (department && department.trim()) filter.department = department.trim();
    // Fetch data
    const psEntries = await PersonnelServices.find(filter);
    const mooeEntries = await MOOEProposal.find(filter)
      .populate({ path: "uacsCode", select: "uacsCode lineItem subLineItem accountingTitle" });
    // Properly populate the category field
    const coEntries = await CapitalOutlay.find(filter)
      .populate({ 
        path: "category", 
        select: "categoryName _id",
        model: Category
      });
    // Fetch IAs O&M Cost data
    let iasOMCostData = await IAsOMCost.findOne(filter);
    if (!iasOMCostData) {
      // Create default empty data if none exists
      iasOMCostData = {
        nis: 0,
        cis: 0,
        nisSubsidy: 0,
        cisSubsidy: 0
      };
    }
    // Sum Personnel Services fields (updated to include new components)
    const psFieldsToSum = [
      "annualSalary",
      "RATA",
      "PERA",
      "uniformALLOWANCE",
      "productivityIncentive",
      "medical",
      "additionalMedical",
      "childrenAllowance",
      "meal",
      "cashGift",
      "subsistenceAllowance",
      "subsistenceAllowanceMDS",
      "subsistenceAllowanceST",
      "loyaltyAward",
      "overtimePay",
      "midyearBonus",
      "yearEndBonus",
      "gsisPremium",
      "providentFund",
      "philhealthPremium",
      "pagibigPremium",
      "employeeCompensation",
      "courtAppearance",
      "earnedLeaves",
      "retirementBenefits",
      "terminalLeave",
      "hazardPay",
      "honoraria"
    ];
    const psSummary = {};
    psFieldsToSum.forEach(field => {
      psSummary[field] = psEntries.reduce(
        (sum, e) => sum + (Number(e[field]) || 0),
        0
      );
    });
    // Overall Personnel Services total, aligned with PersonnelServices.Total
    psSummary.totalPersonnelServices = psEntries.reduce(
      (sum, e) => sum + (Number(e.Total) || 0),
      0
    );
    // Compute annualSalary breakdown by appointment type
    const permAnnual = psEntries
      .filter(e => e.statusOfAppointment.toUpperCase() === "PERMANENT")
      .reduce((sum, e) => sum + (Number(e.annualSalary) || 0), 0);
    const casualAnnual = psEntries
      .filter(e => e.statusOfAppointment.toUpperCase() === "CASUAL")
      .reduce((sum, e) => sum + (Number(e.annualSalary) || 0), 0);
    psSummary.annualSalaryPermanent = permAnnual;
    psSummary.annualSalaryCasual    = casualAnnual;    // Map MOOE entries
    const mooe = mooeEntries.map(entry => {
      // Calculate total amount including income, subsidy, and IAs O&M Cost
      const totalAmount = (Number(entry.income) || 0) + 
                         (Number(entry.subsidy) || 0) + 
                         (entry.uacsCode === "5-02-99-990-NIS" ? (Number(entry.nis) || 0) : 0) +
                         (entry.uacsCode === "5-02-99-990-CIS" ? (Number(entry.cis) || 0) : 0);
      return {
        uacsCode: entry.uacsCode?.uacsCode || entry.uacsCode,
        lineItem: entry.uacsCode?.lineItem,
        subLineItem: entry.sublineItem || entry.uacsCode?.subLineItem,
        accountingTitle: entry.accountingTitle || entry.uacsCode?.accountingTitle,
        amount: totalAmount,
        region: entry.region || '',
        department: entry.department || '',
        income: Number(entry.income) || 0,
        subsidy: Number(entry.subsidy) || 0
      };
    });
    // Map Capital Outlay entries with proper category handling
    const co = await Promise.all(coEntries.map(async (entry) => {
      let categoryName = 'Uncategorized';
      // If category is populated, use its categoryName
      if (entry.category && typeof entry.category === 'object' && entry.category.categoryName) {
        categoryName = entry.category.categoryName;
      } 
      // If category is an ObjectId, fetch the category
      else if (entry.category && typeof entry.category !== 'object') {
        try {
          const categoryDoc = await Category.findById(entry.category);
          if (categoryDoc) {
            categoryName = categoryDoc.categoryName;
          }
        } catch (err) {
          console.error(`Error fetching category for ID ${entry.category}:`, err);
        }
      }
      return {
        category: categoryName,
        particulars: entry.particulars || '',
        subLineItem: entry.sublineItem || '',
        accountingTitle: entry.accountingTitle || '',
        uacsCode: entry.uacsCode || '',
        cost: entry.cost || 0,
        region: entry.region || '',
        department: entry.department || ''
      };
    }));    // Calculate MOOE Regular total
    const mooeRegularTotal = mooe.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    // Calculate IAs O&M Cost total
    const iasOMTotal = (Number(iasOMCostData?.nis || 0) + 
                       Number(iasOMCostData?.cis || 0) +
                       Number(iasOMCostData?.nisSubsidy || 0) + 
                       Number(iasOMCostData?.cisSubsidy || 0));
    // Calculate combined MOOE total (Regular + IAs O&M)
    const mooeTotal = mooeRegularTotal;
    // Calculate Capital Outlay total
    const coTotal = co.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
    // Add IAs O&M Cost to psSummary for the PDF report
    psSummary.iasOMCost = iasOMCostData;
    // Return consolidated summary with detailed MOOE breakdown
    res.json({ 
      fiscalYear, 
      psSummary, 
      mooe, 
      mooeTotal,
      mooeBreakdown: {
        regular: mooeRegularTotal,
        iasOM: iasOMTotal,
        total: mooeRegularTotal + iasOMTotal
      }, 
      co, 
      coTotal 
    });
  } catch (err) {
    console.error("Error in getConsolidatedSummary:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
/**
 * Get consolidated corporate income report by region
 */
const getConsolidatedCorporateIncome = async (req, res) => {
  try {
    // Determine fiscal year
    let fiscalYear;
    if (req.query.fiscalYear) {
      fiscalYear = req.query.fiscalYear;
    } else {
      const activeSetting = await Settings.findOne({ isActive: true });
      if (!activeSetting)
        return res.status(404).json({ error: "No active settings found." });
      fiscalYear = activeSetting.fiscalYear;
    }
    // Get budget type from query or default to "INITIAL"
    const budgetType = (req.query.budgetType || "INITIAL").toUpperCase();
    // Optional region filter from query (set by region interceptor)
    const regionFilterRaw = (req.query.region || '').trim();
    const regionFilter = regionFilterRaw && regionFilterRaw.toLowerCase() !== 'all' ? regionFilterRaw : null;
    // Get regions: if region filter present, only include that; else include all
    let regions;
    if (regionFilter) {
      regions = [{ Region: regionFilter }];
    } else {
      regions = await Region.find().sort({ Region: 1 });
    }
    // console.log(`Generating report${regionFilter ? ` (filtered to: ${regionFilter})` : ''}`);
    // // Get all income categories and deduplicate by name
    const allIncomeCategories = await IncomeCategory.find().sort({ incomeCategoryName: 1 });
    // Deduplicate categories by name - consolidate all regions for same category name
    const categoryMap = new Map();
    allIncomeCategories.forEach(category => {
      const rawName = category.incomeCategoryName || category.name;
      if (!rawName) return;
      const categoryName = rawName.trim();
      const lowerName = categoryName.toLowerCase();
      
      if (!categoryMap.has(lowerName)) {
        categoryMap.set(lowerName, {
          _id: category._id,
          name: categoryName,
          regions: [...(category.regions || [])],
          isGlobal: category.isGlobal || false,
          order: category.order || 0
        });
      } else {
        // Merge regions from duplicate categories
        const existing = categoryMap.get(lowerName);
        const newRegions = category.regions || [];
        existing.regions = [...new Set([...existing.regions, ...newRegions])];
        existing.isGlobal = existing.isGlobal || category.isGlobal;
      }
    });
    const incomeCategories = Array.from(categoryMap.values());
    // Get all income subcategories and also extract subcategories from income entries
    const incomeSubCategories = await IncomeSubCategory.find().sort({ incomeSubcategoryName: 1 });
    // Fetch all income entries first to extract subcategories
    const budgetTypeQuery = { $regex: new RegExp(budgetType, 'i') };
    const query = { fiscalYear };
    if (budgetType) {
      query.budgetType = budgetTypeQuery;
    }
    if (regionFilter) {
      // Case-insensitive exact match for region
      query.region = { $regex: new RegExp(`^${regionFilter}$`, 'i') };
    }
    const incomeEntries = await Income.find(query).populate('incomecategory');
    // Extract unique subcategories from income entries
    const subcategorySet = new Set();
    const subcategoryToCategoryMap = new Map(); // Track which category each subcategory belongs to
    incomeEntries.forEach(entry => {
      const subcategoryName = entry.subcategory;
      const entryCategory = entry.incomecategory;
      if (subcategoryName && subcategoryName !== 'Uncategorized' && subcategoryName.trim() !== '') {
        subcategorySet.add(subcategoryName);
        // Map subcategory to its parent category
        if (entryCategory) {
          let categoryName = 'Uncategorized';
          if (typeof entryCategory === 'object' && entryCategory.incomeCategoryName) {
            categoryName = entryCategory.incomeCategoryName;
          } else if (typeof entryCategory === 'object' && entryCategory.name) {
            categoryName = entryCategory.name;
          }
          subcategoryToCategoryMap.set(subcategoryName, categoryName);
        }
      } else {
        // Skip entries without valid category
      }
    });
    // Create dynamic subcategory objects from extracted data
    const dynamicSubcategories = Array.from(subcategorySet).map(subcategoryName => {
      const parentCategory = subcategoryToCategoryMap.get(subcategoryName) || 'Uncategorized';
      return {
        _id: `dynamic_${subcategoryName.replace(/\s+/g, '_').toLowerCase()}`,
        incomeSubcategoryName: subcategoryName,
        name: subcategoryName,
        parentCategory: parentCategory
      };
    });
    // Combine formal subcategories with dynamic ones
    const allSubcategories = [...incomeSubCategories, ...dynamicSubcategories];
    //console.log(`Total subcategories: ${allSubcategories.length}`);
    // Initialize result structure with hierarchical data
    const result = {
      fiscalYear,
      budgetType,
      regions: regions.map(r => r.Region),
      hierarchicalData: [],
      regionData: {},
      categoryTotals: {},
      subcategoryTotals: {},
      categorySubcategoryMap: {}, // Map to track which subcategories belong to which category
      grandTotal: 0
    };
    // Initialize region data structure
    regions.forEach(region => {
      result.regionData[region.Region] = {
        categoryAmounts: {},
        subcategoryAmounts: {},
        total: 0
      };
      // Initialize category amounts for each region
      incomeCategories.forEach(category => {
        result.regionData[region.Region].categoryAmounts[category._id.toString()] = 0;
      });
      // Initialize subcategory amounts for each region
      allSubcategories.forEach(subcategory => {
        const subcategoryId = subcategory._id.toString();
        result.regionData[region.Region].subcategoryAmounts[subcategoryId] = 0;
      });
    });
    // Initialize category totals and prepare hierarchical structure
    incomeCategories.forEach(category => {
      const categoryId = category._id.toString();
      result.categoryTotals[categoryId] = 0;
      // Add category to hierarchical data
      result.hierarchicalData.push({
        id: categoryId,
        name: category.name,
        type: 'category',
        subcategories: [],
        order: category.order || 0 // Use order if available
      });
      // Initialize the subcategory map for this category
      result.categorySubcategoryMap[categoryId] = [];
    });
    // Initialize subcategory totals
    allSubcategories.forEach(subcategory => {
      const subcategoryId = subcategory._id.toString();
      result.subcategoryTotals[subcategoryId] = 0;
    });
    // First pass: Process income entries and collect subcategory information
    const subcategoryByCategoryMap = new Map(); // Map to track which subcategories belong to which category
    incomeEntries.forEach(entry => {
      const region = entry.region || 'Unspecified';
      const entryCategory = entry.incomecategory;
      const subcategoryName = entry.subcategory || 'Uncategorized';
      const amount = Number(entry.amount) || 0;
      // Skip if region doesn't exist in our structure
      if (!result.regionData[region]) {
        return;
      }
      // Find the matching category by name
      let categoryId = null;
      let categoryName = 'Uncategorized';
      if (entryCategory) {
        if (typeof entryCategory === 'object' && entryCategory.incomeCategoryName) {
          categoryName = entryCategory.incomeCategoryName;
        } else if (typeof entryCategory === 'object' && entryCategory.name) {
          categoryName = entryCategory.name;
        }
        // Find the category by name in our deduplicated list
        const matchingCategory = incomeCategories.find(cat => 
          cat.name === categoryName || 
          (cat.name && cat.name.toLowerCase() === categoryName.toLowerCase())
        );
        if (matchingCategory) {
          categoryId = matchingCategory._id.toString();
        }
      }
      // Skip if category doesn't exist in our structure
      if (!categoryId || result.categoryTotals[categoryId] === undefined) {
        return;
      }
      // Add to region's category amount
      result.regionData[region].categoryAmounts[categoryId] += amount;
      // Track subcategory to category relationship
      if (subcategoryName && subcategoryName !== 'Uncategorized') {
        if (!subcategoryByCategoryMap.has(categoryId)) {
          subcategoryByCategoryMap.set(categoryId, new Set());
        }
        subcategoryByCategoryMap.get(categoryId).add(subcategoryName);
      }
      // Find matching subcategory
      const matchingSubcategory = allSubcategories.find(
        sc => (sc.incomeSubcategoryName || sc.name).toLowerCase() === subcategoryName.toLowerCase()
      );
      // If we found a matching subcategory, update its amounts
      if (matchingSubcategory) {
        const subcategoryId = matchingSubcategory._id.toString();
        // Add to region's subcategory amount
        if (result.regionData[region].subcategoryAmounts[subcategoryId] !== undefined) {
          result.regionData[region].subcategoryAmounts[subcategoryId] += amount;
        }
        // Update subcategory total
        if (result.subcategoryTotals[subcategoryId] !== undefined) {
          result.subcategoryTotals[subcategoryId] += amount;
        }
        // Add to category-subcategory map if not already there
        if (!result.categorySubcategoryMap[categoryId].includes(subcategoryId)) {
          result.categorySubcategoryMap[categoryId].push(subcategoryId);
        }
      }
      // Update region total
      result.regionData[region].total += amount;
      // Update category total
      result.categoryTotals[categoryId] += amount;
      // Update grand total
      result.grandTotal += amount;
    });
    // Second pass: Build the hierarchical structure
    // For each category, add its subcategories to the hierarchical data
    result.hierarchicalData.forEach(categoryItem => {
      const categoryId = categoryItem.id;
      const subcategoryIds = result.categorySubcategoryMap[categoryId] || [];
      // Add subcategories to this category
      subcategoryIds.forEach(subcategoryId => {
        const subcategory = allSubcategories.find(sc => sc._id.toString() === subcategoryId);
        if (subcategory) {
          categoryItem.subcategories.push({
            id: subcategoryId,
            name: subcategory.incomeSubcategoryName || subcategory.name,
            type: 'subcategory',
            parentId: categoryId,
            order: subcategory.order || 0 // Use order if available
          });
        }
      });
      // Sort subcategories by name
      categoryItem.subcategories.sort((a, b) => a.name.localeCompare(b.name));
    });
    // Sort categories by name
    result.hierarchicalData.sort((a, b) => a.name.localeCompare(b.name));
    // If there's no data, still return the structure but with a message
    if (incomeEntries.length === 0) {
      result.message = "No income data found for the selected fiscal year and budget type.";
    }
    res.json(result);
  } catch (err) {
    console.error("Error in getConsolidatedCorporateIncome:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
};
module.exports = { 
  getConsolidatedSummary,
  getConsolidatedCorporateIncome
};
