const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');
const IncomeSubcategory = require('../models/IncomeSubcategory');
const Settings = require('../models/Settings');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const normalizeUploadHeader = (value = '') => value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

const findUploadColumn = (headers, candidates) => headers.find((header) => {
  const normalizedHeader = normalizeUploadHeader(header);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeUploadHeader(candidate);
    return normalizedHeader === normalizedCandidate || normalizedHeader.includes(normalizedCandidate);
  });
});

const parseUploadAmount = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value.toString().replace(/,/g, '').replace(/₱/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};
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

    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({
        error: 'No active settings found',
        message: 'Please set active fiscal year and budget type before uploading'
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });

    if (data.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data' });
    }

    const headers = Object.keys(data[0]);
    const categoryCol = findUploadColumn(headers, ['CATEGORIES', 'Category']);
    const subcategoryCol = findUploadColumn(headers, ['SUB-CATEGORIES', 'Subcategory']);
    const amountCol = findUploadColumn(headers, ['AMOUNT', 'Amount']);
    const regionCol = findUploadColumn(headers, ['REGION', 'Region']);
    const particularsCol = findUploadColumn(headers, ['Particulars']);

    // Identify columns including Responsibility Center
    const departmentCol = findUploadColumn(headers, ['DEPARTMENT', 'Department']);
    const divisionCol = findUploadColumn(headers, ['DIVISION', 'Division']);
    const rcCol = findUploadColumn(headers, ['RESPONSIBILITY CENTER', 'Responsibility Center', 'RC']);

    const missingColumns = [
      ['CATEGORIES', categoryCol],
      ['AMOUNT', amountCol],
    ].filter(([, value]) => !value).map(([label]) => label);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    const workflowData = req.submissionWorkflowData || {};
    const resolvedRegion = workflowData.region || req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName || req.user?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

    // Get user assignment for department, division, workflowLevel
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    let assignedDepartment = undefined;
    let assignedDivision = undefined;
    let originalLevel = 'DIVISION';

    if (userIdString) {
      try {
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .lean();
        if (userAssignment) {
          assignedDepartment = userAssignment.departmentId?.Department || 
                               userAssignment.departmentId?.DepartmentName ||
                               userAssignment.departmentId?.department;
          assignedDivision = userAssignment.divisionName;
          originalLevel = userAssignment.assignmentLevel || 'DIVISION';
        }
      } catch (err) {
        console.error('Error fetching user assignment for bulk upload:', err.message);
      }
    }

    // Fetch master data for auto-detecting Responsibility Center levels
    const RegionModel = require('../models/Region');
    const DepartmentModel = require('../models/Department');
    const allRegions = await RegionModel.find({}).lean();
    const allDepartments = await DepartmentModel.find({}).lean();
    
    const knownRegions = allRegions.map(r => String(r.regionName || r.Region || '').toUpperCase().trim());
    const knownDepts = allDepartments.map(d => String(d.departmentName || d.DepartmentName || d.Department || '').toUpperCase().trim());

    // Process the data
    const results = {
      fiscalYear: activeSettings.fiscalYear,
      budgetType: activeSettings.budgetType,
      totalRecords: data.length,
      successfullyProcessed: 0,
      failedRecords: 0,
      errors: [],
      regions: new Set()
    };

    let currentRegion = '';
    let currentDept = '';
    let currentRC = '';
    let currentCategory = '';

    for (const [index, row] of data.entries()) {
      try {
        let rowRegionInput = regionCol ? row[regionCol]?.toString().trim() || '' : '';
        let rowDeptInput = departmentCol ? row[departmentCol]?.toString().trim() || '' : '';
        let rc = rcCol ? row[rcCol]?.toString().trim() || '' : '';
        let categoryName = row[categoryCol]?.toString().trim() || '';
        const subcategoryName = subcategoryCol ? row[subcategoryCol]?.toString().trim() || '' : '';
        const amount = parseUploadAmount(row[amountCol]);
        
        // Fill-down logic for grouped formatting
        if (rowRegionInput) currentRegion = rowRegionInput; else rowRegionInput = currentRegion;
        if (rowDeptInput) currentDept = rowDeptInput; else rowDeptInput = currentDept;
        if (rc) currentRC = rc; else rc = currentRC;
        if (categoryName) currentCategory = categoryName; else categoryName = currentCategory;

        // Auto-detect Regional / Department / Division level from RC
        let targetRegion = rowRegionInput || resolvedRegion || null;
        let targetDepartment = rowDeptInput || assignedDepartment || null;
        let targetDivision = divisionCol ? row[divisionCol]?.toString().trim() || '' : assignedDivision || null;
        let targetLevel = originalLevel || 'REGION';
        
        if (rc) {
          const rcUpper = rc.toUpperCase();
          if (knownRegions.includes(rcUpper) || rcUpper === 'CENTRAL OFFICE' || rcUpper === 'CO' || rcUpper.startsWith('REGION') || rcUpper === 'MARIIS' || rcUpper === 'UPRIIS') {
            targetRegion = rc;
            targetLevel = 'REGION';
          } else if (knownDepts.includes(rcUpper) || rcUpper.includes('DEPARTMENT') || rcUpper.includes('SERVICES')) {
            targetDepartment = rc;
            targetLevel = 'DEPARTMENT';
          } else {
            targetDivision = rc;
            targetLevel = 'DIVISION';
          }
        }
        const particulars = particularsCol
          ? row[particularsCol]?.toString().trim() || ''
          : (subcategoryName || categoryName);

        if (!categoryName && !subcategoryName && amount === 0) {
          continue;
        }

        // Require at least category, amount, and ANY organizational context
        if (!categoryName || (!targetRegion && !targetDepartment && !targetDivision) || amount <= 0) {
          results.errors.push({
            row: index + 2,
            category: categoryName,
            region: targetRegion || targetDepartment || targetDivision || 'Unknown',
            amount,
            error: 'Missing required field(s): CATEGORIES, AMOUNT, or Responsibility Center context'
          });
          results.failedRecords++;
          continue;
        }

        results.regions.add(targetRegion || targetDepartment || targetDivision || 'Unknown');

        // Prioritize region-specific category over global one
        const categoryQuery = {
          $or: [
            { incomeCategoryName: { $regex: new RegExp(`^${categoryName.trim()}$`, 'i') } },
            { name: { $regex: new RegExp(`^${categoryName.trim()}$`, 'i') } }
          ]
        };

        const category = await IncomeCategory.findOne({ 
          $and: [
            categoryQuery,
            { regions: targetRegion }
          ]
        }) || await IncomeCategory.findOne({ 
          $and: [
            categoryQuery,
            { isGlobal: true }
          ]
        }) || await IncomeCategory.findOne(categoryQuery);

        if (!category) {
          results.errors.push({
            row: index + 2,
            category: categoryName,
            region: targetRegion,
            amount,
            error: `Income category "${categoryName}" not found`
          });
          results.failedRecords++;
          continue;
        }

        const validSubcategories = await getSubcategoriesForRegion(targetRegion);
        if (subcategoryName && validSubcategories.length > 0 && !validSubcategories.includes(subcategoryName)) {
          results.errors.push({
            row: index + 2,
            category: categoryName,
            subcategory: subcategoryName,
            region: targetRegion,
            amount,
            error: `Subcategory "${subcategoryName}" is not valid for region "${targetRegion}"`
          });
          results.failedRecords++;
          continue;
        }

        const income = new Income({
          particulars: particulars || categoryName,
          incomecategory: category._id,
          category: categoryName,
          subcategory: subcategoryName || null,
          amount,
          cost: amount, // Ensure cost matches amount for frontend display
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType,
          region: targetRegion,
          department: targetDepartment,
          division: targetDivision,
          originalLevel: targetLevel,
          workflowLevel: targetLevel,
          createdBy: userIdString,
          processBy: req.user?.userName || req.user?.username || req.user?.id || 'System Upload',
          processDate: new Date(),
          status: 'Draft' // Reverted to Draft per user request
        });
        await income.save();
        results.successfullyProcessed++;
      } catch (error) {
        console.error('Error processing row:', error);
        results.errors.push({
          row: index + 2,
          category: row[categoryCol],
          region: resolvedRegion || row[regionCol],
          amount: row[amountCol],
          error: error.message
        });
        results.failedRecords++;
      }
    }
    // Convert regions set to array
    results.regions = Array.from(results.regions);
    results.success = results.successfullyProcessed;
    results.failed = results.failedRecords;
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error uploading corporate income:', error);
    return res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
};
// Generate template for corporate income upload
exports.generateTemplate = async (req, res) => {
  try {
    const workbook = xlsx.utils.book_new();
    const sampleData = [
      {
        'REGION': 'CENTRAL OFFICE',
        'DEPARTMENT': 'OFFICE OF THE ADMINISTRATOR',
        'RESPONSIBILITY CENTER': 'MANAGEMENT INFORMATION DIVISION',
        'CATEGORIES': 'Irrigation Service Fees',
        'SUB-CATEGORIES': 'Current Account',
        'AMOUNT': 1000000
      },
      {
        'REGION': '',
        'DEPARTMENT': '',
        'RESPONSIBILITY CENTER': '',
        'CATEGORIES': '',
        'SUB-CATEGORIES': 'Back Accounts',
        'AMOUNT': 1500000
      },
      {
        'REGION': '',
        'DEPARTMENT': 'CORPORATE PLANNING SERVICES',
        'RESPONSIBILITY CENTER': '',
        'CATEGORIES': 'Rent Income',
        'SUB-CATEGORIES': 'Rent Income',
        'AMOUNT': 1500000
      },
      {
        'REGION': 'REGION 1',
        'DEPARTMENT': '',
        'RESPONSIBILITY CENTER': '',
        'CATEGORIES': 'Irrigation Service Fees',
        'SUB-CATEGORIES': 'Current Account',
        'AMOUNT': 2000000
      },
      {
        'REGION': '',
        'DEPARTMENT': '',
        'RESPONSIBILITY CENTER': '',
        'CATEGORIES': '',
        'SUB-CATEGORIES': 'Back Accounts',
        'AMOUNT': 1000000
      },
      {
        'REGION': '',
        'DEPARTMENT': '',
        'RESPONSIBILITY CENTER': '',
        'CATEGORIES': 'Miscellaneous Income',
        'SUB-CATEGORIES': 'Bid Forms',
        'AMOUNT': 2000000
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 35 },
      { wch: 25 },
      { wch: 25 },
      { wch: 18 }
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Corporate Income');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=corporate_income_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
    const budgetRoleVisibilityFilter = req.budgetRoleVisibilityFilter || {};

    if (budgetRoleVisibilityFilter && Object.keys(budgetRoleVisibilityFilter).length > 0) {
      if (budgetRoleVisibilityFilter.$and || budgetRoleVisibilityFilter.$or) {
        const baseConditions = Object.entries(query).map(([k,v]) => ({ [k]: v }));
        query = { $and: [ ...baseConditions, budgetRoleVisibilityFilter ] };
      } else {
        query = { ...query, ...budgetRoleVisibilityFilter };
      }
    } else if (submissionFilters && Object.keys(submissionFilters).length > 0) {
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
    const budgetRoleVisibilityFilter = req.budgetRoleVisibilityFilter || {};

    if (budgetRoleVisibilityFilter && Object.keys(budgetRoleVisibilityFilter).length > 0) {
      if (budgetRoleVisibilityFilter.$and) {
        const conditions = Object.entries(baseFilter).map(([k,v]) => ({ [k]: v }));
        baseFilter = { $and: [ ...conditions, ...budgetRoleVisibilityFilter.$and ] };
      } else {
        baseFilter = { ...baseFilter, ...budgetRoleVisibilityFilter };
      }
    } else if (submissionFilters && Object.keys(submissionFilters).length > 0) {
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