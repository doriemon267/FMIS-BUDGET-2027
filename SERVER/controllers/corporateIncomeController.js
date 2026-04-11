const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');
const IncomeSubcategory = require('../models/IncomeSubcategory');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
// Helper function to get subcategories for a region
const getSubcategoriesForRegion = async (region) => {
  try {
    // Find subcategories that:
    // 1. Have the specified region in their regions array, OR
    // 2. Are marked as global, OR
    // 3. Have a special region that applies to this region
    const filter = {
      $or: [
        { regions: region },
        { isGlobal: true }
      ]
    };
    // Handle special cases for MARIIS and UPRIIS
    if (['Region 1', 'Region 2', 'Region 3'].includes(region)) {
      filter.$or.push({ specialRegions: 'MARIIS' });
      filter.$or.push({ specialRegions: 'UPRIIS' });
    }
    // Handle Region X and Region 10 equivalence
    if (region === 'Region 10') {
      filter.$or.push({ regions: 'Region X' });
    } else if (region === 'Region X') {
      filter.$or.push({ regions: 'Region 10' });
    }
    const subcategories = await IncomeSubcategory.find(filter);
    return subcategories.map(subcat => subcat.incomeSubcategoryName || subcat.name);
  } catch (error) {
    console.error('Error getting subcategories for region:', error);
    return [];
  }
};
// Upload corporate income data
exports.uploadCorporateIncome = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    if (data.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data' });
    }
    // Extract fiscal year and budget type from the first row
    const fiscalYear = data[0].FiscalYear;
    const budgetType = data[0].BudgetType;
    if (!fiscalYear || !budgetType) {
      return res.status(400).json({ 
        error: 'Missing required fields: FiscalYear and BudgetType must be included in the first row' 
      });
    }
    // Process the data
    const results = {
      fiscalYear,
      budgetType,
      totalRecords: data.length,
      successfullyProcessed: 0,
      failedRecords: 0,
      errors: [],
      regions: new Set()
    };
    for (const row of data) {
      try {
        // Validate required fields
        if (!row.Category || !row.Region || !row.Amount) {
          results.errors.push({
            category: row.Category,
            region: row.Region,
            amount: row.Amount,
            error: 'Missing required field(s): Category, Region, or Amount'
          });
          results.failedRecords++;
          continue;
        }
        // Add region to the set of processed regions
        results.regions.add(row.Region);
        // Find the income category
        const category = await IncomeCategory.findOne({ 
          $or: [
            { incomeCategoryName: row.Category },
            { name: row.Category }
          ]
        });
        if (!category) {
          results.errors.push({
            category: row.Category,
            region: row.Region,
            amount: row.Amount,
            error: `Income category "${row.Category}" not found`
          });
          results.failedRecords++;
          continue;
        }
        // Get valid subcategories for this region
        const validSubcategories = await getSubcategoriesForRegion(row.Region);
        // Check if subcategory is valid for this region
        if (row.Subcategory && !validSubcategories.includes(row.Subcategory)) {
          results.errors.push({
            category: row.Category,
            subcategory: row.Subcategory,
            region: row.Region,
            amount: row.Amount,
            error: `Subcategory "${row.Subcategory}" is not valid for region "${row.Region}"`
          });
          results.failedRecords++;
          continue;
        }
        // Create the income record
        // Normalize via submission workflow: corporate income is region-level
        const workflowData = req.submissionWorkflowData || {};
        const income = new Income({
          particulars: row.Particulars || row.Category,
          incomecategory: category._id,
          category: row.Category,
          subcategory: row.Subcategory || null,
          amount: parseFloat(row.Amount),
          fiscalYear,
          budgetType,
          region: workflowData.region || row.Region,
          department: null, // Corporate income doesn't belong to a specific department
          division: null,   // Corporate income doesn't belong to a specific division
          originalLevel: 'REGION', // Corporate income starts at region level
          workflowLevel: 'REGION',
          processBy: req.user ? req.user.username : 'System',
          processDate: new Date(),
          status: 'Draft' // Changed from 'Submitted' to 'Draft' for consistency
        });
        await income.save();
        results.successfullyProcessed++;
      } catch (error) {
        console.error('Error processing row:', error);
        results.errors.push({
          category: row.Category,
          region: row.Region,
          amount: row.Amount,
          error: error.message
        });
        results.failedRecords++;
      }
    }
    // Convert regions set to array
    results.regions = Array.from(results.regions);
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error uploading corporate income:', error);
    return res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
};
// Generate template for corporate income upload
exports.generateTemplate = async (req, res) => {
  try {
    // Create a new workbook
    const workbook = xlsx.utils.book_new();
    // Sample data
    const sampleData = [
      {
        FiscalYear: '2024',
        BudgetType: 'Corporate',
        Category: 'Water Service Fee',
        Subcategory: 'Region 1 Water Service',
        Particulars: 'Water Service Fee for Region 1',
        Region: 'Region 1',
        Amount: 1000000
      },
      {
        FiscalYear: '2024',
        BudgetType: 'Corporate',
        Category: 'Water Service Fee',
        Subcategory: 'Region 2 Water Service',
        Particulars: 'Water Service Fee for Region 2',
        Region: 'Region 2',
        Amount: 1500000
      }
    ];
    // Create a worksheet
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Corporate Income');
    // Create a buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=corporate_income_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Send the buffer
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
};
// Get corporate income data
exports.getCorporateIncome = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    // Build query
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (region) query.region = region;
    // Apply submission workflow filters if present (region-level corporate income should be visible only per workflow rules)
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    if (submissionFilters && Object.keys(submissionFilters).length > 0) {
      if (submissionFilters.$and) {
        const baseConditions = Object.entries(query).map(([k,v]) => ({ [k]: v }));
        query = { $and: [ ...baseConditions, ...submissionFilters.$and ] };
      } else {
        query = { ...query, ...submissionFilters };
      }
    } else if (hierarchicalFilters && Object.keys(hierarchicalFilters).length > 0) {
      if (hierarchicalFilters.$and) {
        const baseConditions = Object.entries(query).map(([k,v]) => ({ [k]: v }));
        query = { $and: [ ...baseConditions, ...hierarchicalFilters.$and ] };
      } else {
        query = { ...query, ...hierarchicalFilters };
      }
    }
    // Get income data
    const incomeData = await Income.find(query)
      .populate('incomecategory')
      .sort({ category: 1, subcategory: 1 });
    return res.status(200).json(incomeData);
  } catch (error) {
    console.error('Error getting corporate income:', error);
    return res.status(500).json({ error: 'Failed to get corporate income data' });
  }
};
// Get consolidated corporate income data
exports.getConsolidatedCorporateIncome = async (req, res) => {
  try {
    const { fiscalYear, budgetType, department, division } = req.query;
    if (!fiscalYear || !budgetType) {
      return res.status(400).json({ error: 'Fiscal year and budget type are required' });
    }
    // Get all income categories
    const categories = await IncomeCategory.find().sort({ incomeCategoryName: 1 });
    // Get all regions with income data
    // Build base filter and apply submission workflow filters
    let baseFilter = { fiscalYear, budgetType };
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    if (submissionFilters && Object.keys(submissionFilters).length > 0) {
      if (submissionFilters.$and) {
        const conditions = Object.entries(baseFilter).map(([k,v]) => ({ [k]: v }));
        baseFilter = { $and: [ ...conditions, ...submissionFilters.$and ] };
      } else {
        baseFilter = { ...baseFilter, ...submissionFilters };
      }
    } else if (hierarchicalFilters && Object.keys(hierarchicalFilters).length > 0) {
      if (hierarchicalFilters.$and) {
        const conditions = Object.entries(baseFilter).map(([k,v]) => ({ [k]: v }));
        baseFilter = { $and: [ ...conditions, ...hierarchicalFilters.$and ] };
      } else {
        baseFilter = { ...baseFilter, ...hierarchicalFilters };
      }
    }
    if (department && !baseFilter.department) {
      baseFilter.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (division && !baseFilter.division) {
      baseFilter.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    const regionsResult = await Income.distinct('region', baseFilter);
    const regions = regionsResult.sort();
    // Initialize result structure
    const result = {
      fiscalYear,
      budgetType,
      regions,
      categories: []
    };
    // Process each category
    for (const category of categories) {
      const categoryData = {
        _id: category._id,
        name: category.incomeCategoryName || category.name,
        subcategories: [],
        regionTotals: {}
      };
      // Initialize region totals
      regions.forEach(region => {
        categoryData.regionTotals[region] = 0;
      });
      // Get subcategories for this category
      const subcategories = category.incomeSubcategoryName || [];
      // Process each subcategory
      for (const subcategory of subcategories) {
        const subcategoryData = {
          name: subcategory,
          regionValues: {}
        };
        // Initialize region values
        regions.forEach(region => {
          subcategoryData.regionValues[region] = 0;
        });
        // Get income data for this subcategory
        const incomeData = await Income.find({
          ...(baseFilter.$and ? {} : baseFilter),
          fiscalYear,
          budgetType,
          incomecategory: category._id,
          subcategory
        }).and(baseFilter.$and || []);
        // Aggregate by region
        for (const income of incomeData) {
          if (income.region && subcategoryData.regionValues[income.region] !== undefined) {
            subcategoryData.regionValues[income.region] += income.amount;
            categoryData.regionTotals[income.region] += income.amount;
          }
        }
        categoryData.subcategories.push(subcategoryData);
      }
      // Get income data without subcategory
      const incomeWithoutSubcategory = await Income.find({
        ...(baseFilter.$and ? {} : baseFilter),
        fiscalYear,
        budgetType,
        incomecategory: category._id,
        $or: [
          { subcategory: null },
          { subcategory: '' }
        ]
      }).and(baseFilter.$and || []);
      // If there's income without subcategory, add a "General" subcategory
      if (incomeWithoutSubcategory.length > 0) {
        const generalSubcategory = {
          name: 'General',
          regionValues: {}
        };
        // Initialize region values
        regions.forEach(region => {
          generalSubcategory.regionValues[region] = 0;
        });
        // Aggregate by region
        for (const income of incomeWithoutSubcategory) {
          if (income.region && generalSubcategory.regionValues[income.region] !== undefined) {
            generalSubcategory.regionValues[income.region] += income.amount;
            categoryData.regionTotals[income.region] += income.amount;
          }
        }
        categoryData.subcategories.push(generalSubcategory);
      }
      result.categories.push(categoryData);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting consolidated corporate income:', error);
    return res.status(500).json({ error: 'Failed to get consolidated corporate income data' });
  }
};