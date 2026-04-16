const xlsx = require("xlsx");
const Income = require("../models/Income");
const IncomeCategory = require("../models/IncomeCategory");
const Settings = require("../models/Settings");
// Process Excel file for bulk corporate income upload
exports.uploadCorporateIncome = async (req, res) => {
  try {
    // Get active settings for fiscalYear and budgetType
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ 
        error: "No active settings found",
        message: "Please set active fiscal year and budget type before uploading" 
      });
    }

    // Get user assignment for department and division
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
    }    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    // Get the raw worksheet to see exact headers
    const worksheet = workbook.Sheets[sheetName];
    // Shows the range being read
    // Convert to Array of Arrays first to see exact headers
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('Headers:', rawData[0]); // First row contains headers
    // Now convert to objects
    const sheetData = xlsx.utils.sheet_to_json(worksheet, {
      raw: false, // This will preserve formatting
      defval: null // Use null for empty cells instead of skipping them
    });
    // Log the first row of processed data to see what we actually got
    if (sheetData.length > 0) {
    }
    if (sheetData.length === 0) {
      return res.status(400).json({ 
        error: "Empty file", 
        message: "The uploaded Excel file contains no data" 
      });
    }
    // Debug: Print the first row of data to see column names
    console.log('First row:', sheetData[0]);
    // Validate the tabular format (categories as rows, regions as columns)
    const headers = Object.keys(sheetData[0]);
    // Must have at least Category column and one region column
    if (headers.length <= 1) {
      return res.status(400).json({
        error: "Invalid format",
        message: "Excel file must be in tabular format with Category column and at least one region column"
      });
    }
    // First column must be Category
    if (!headers[0].toLowerCase().includes('category')) {
      return res.status(400).json({
        error: "Invalid format",
        message: "First column must be 'Category'"
      });
    }
    // Validate that there is at least one region column (any column after Category)
    const regionColumns = headers.slice(1);
    if (regionColumns.length === 0) {
      return res.status(400).json({
        error: "Invalid format",
        message: "Excel file must contain at least one region column"
      });
    }
    // Define region mappings (be more flexible with variations)
    const regionMappings = {
      'central office': 'Central Office',
      'central region': 'Central Office',
      'co': 'Central Office',
      'central': 'Central Office',
      'car': 'CAR',
      'region 1': 'Region 1',
      'region 2': 'Region 2',
      'region 3': 'Region 3',
      'region 10': 'Region 10',
      'region 12': 'Region 12'
    };
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      regions: regionColumns,
      processedData: [] // Add this to track what's being processed
    };
    // Fetch all income categories with their subcategories
    const allCategories = await IncomeCategory.find({}).lean();
    // Create maps for categories and their subcategories
    const categoryMap = new Map();
    const subcategoryMap = new Map();
    allCategories.forEach(cat => {
      const mainCat = cat.incomeCategoryName.toLowerCase().trim();
      categoryMap.set(mainCat, {
        id: cat._id,
        name: cat.incomeCategoryName,
        subcategories: cat.incomeSubcategoryName || []
      });
      // Create normalized subcategory lookup for each category
      if (cat.incomeSubcategoryName) {
        const subMap = new Map();
        cat.incomeSubcategoryName.forEach(sub => {
          // Create normalized version for matching
          const normalized = sub.toLowerCase()
            .replace(/\s*-\s*/g, '-')  // normalize spaces around hyphens
            .replace(/\s+/g, ' ')      // normalize multiple spaces
            .trim();
          subMap.set(normalized, sub); // map normalized to original
        });
        subcategoryMap.set(mainCat, subMap);
      }
    });
    // Process each row
    for (const record of sheetData) {
      try {
        // Debug: Print current record
        // Split the category input into category and subcategory
        const categoryInput = record[headers[0]].trim();
        let [mainCategory, ...subcategoryParts] = categoryInput.split('-').map(part => part.trim());
        let subcategoryInput = subcategoryParts.join('-').trim();
        // Try to find the main category
        const mainCatLower = mainCategory.toLowerCase();
        const categoryInfo = categoryMap.get(mainCatLower);
        if (!categoryInfo) {
          results.failed++;
          results.errors.push({
            category: categoryInput,
            error: `Category "${mainCategory}" not found in the system. Available categories: ${allCategories.map(c => c.incomeCategoryName).join(", ")}`
          });
          continue;
        }
        // Try to match subcategory if provided
        let matchedSubcategory = null;
        if (subcategoryInput) {
          const subMap = subcategoryMap.get(mainCatLower);
          if (subMap) {
            // Normalize input subcategory for matching
            const normalizedInput = subcategoryInput.toLowerCase()
              .replace(/\s*-\s*/g, '-')
              .replace(/\s+/g, ' ')
              .trim();
            // Try to find a match
            matchedSubcategory = subMap.get(normalizedInput);
            if (!matchedSubcategory) {
              results.failed++;
              results.errors.push({
                category: categoryInput,
                error: `Subcategory "${subcategoryInput}" not found for category "${mainCategory}". Available subcategories: ${categoryInfo.subcategories.join(", ")}`
              });
              continue;
            }
          }
        }
        // Debug: Log which region columns we're about to process
        // Process each region column
        for (const regionCol of regionColumns) {
          // Debug: Log EVERYTHING about this region column
          console.log('Processing region column:', regionCol, 'entireRecord:', entireRecord);
          const amount = parseFloat(record[regionCol]);
          // Skip if no amount for this region
          if (isNaN(amount) || amount === 0) {
            continue;
          }
            // Map the region name to standard format (be more flexible)
            const regionKey = regionCol.toLowerCase()
              .replace(/\s*-\s*/g, '-')
              .replace(/\s+/g, ' ')
              .trim();
            const standardRegion = regionMappings[regionKey] || regionCol;
            // Generate particulars based on subcategory and region
            let particulars;
            if (matchedSubcategory) {
              particulars = `${matchedSubcategory} (${standardRegion})`;
            } else {
              particulars = `${categoryInfo.name} (${standardRegion})`;
            }
            // Debug: Log what we're about to save
            try {
            // Create income record
            await Income.create({
              incomecategory: categoryInfo.id,
              category: categoryInfo.name,
              subcategory: matchedSubcategory || null,
              amount,
              cost: amount,
              particulars,
              region: standardRegion,
              fiscalYear: activeSettings.fiscalYear,
              budgetType: activeSettings.budgetType,
              department: assignedDepartment,
              division: assignedDivision,
              originalLevel: originalLevel,
              workflowLevel: originalLevel,
              createdBy: userIdString,
              processBy: req.user?.userName || userIdString || "System Upload",
              processDate: new Date()
            });
            // Track what was processed
            results.processedData.push({
              category: categoryInput,
              region: regionCol,
              standardRegion,
              amount,
              particulars
            });
            results.success++;
          } catch (error) {
            console.error(`Error processing region ${regionCol}:`, error);
            results.failed++;
            results.errors.push({
              category: categoryInput,
              region: regionCol,
              amount: record[regionCol],
              error: error.message
            });
          }
        }
      } catch (error) {
        console.error('Error processing record:', error);
        results.failed++;
        results.errors.push({
          category: record[headers[0]],
          error: error.message
        });
      }
    }
    // Debug: Show what was processed
    return res.json({
      message: "File processed successfully",
      processedRecords: results.success,
      failedRecords: results.failed,
      errors: results.errors,
      regions: results.regions,
      processed: results.processedData // Include processed data in response
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
};
// Generate sample template for corporate income upload
exports.getSampleTemplate = async (req, res) => {
  try {
    // Get all available categories
    const categories = await IncomeCategory.find({}).lean();
    if (!categories || categories.length === 0) {
      return res.status(400).json({
        error: "No categories available",
        message: "No income categories found in the system. Please set up categories first."
      });
    }
    // Define standard region names - order matters!
    const regions = [
      'Central Office',
      'CAR',
      'Region 1',
      'Region 2',
      'Region 3',
      'Region 10',
      'Region 12'
    ];
    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    // Create header row with exact region names
    const headers = ['Category', ...regions];
    // Create data rows with categories and subcategories
    const rows = [];
    categories.forEach(cat => {
      if (cat.incomeSubcategoryName && cat.incomeSubcategoryName.length > 0) {
        cat.incomeSubcategoryName.forEach(sub => {
          // Initialize a row with the category-subcategory and empty cells for each region
          const row = Array(headers.length).fill('');
          row[0] = `${cat.incomeCategoryName} - ${sub}`; // Set the category column
          rows.push(row);
        });
      } else {
        // Initialize a row with just the category and empty cells for each region
        const row = Array(headers.length).fill('');
        row[0] = cat.incomeCategoryName; // Set the category column
        rows.push(row);
      }
    });
    // Combine headers and data
    const data = [headers, ...rows];
    // Create worksheet
    const ws = xlsx.utils.aoa_to_sheet(data);
    // Set column widths
    const colWidths = [
      { wch: 50 }, // Category column
      ...regions.map(() => ({ wch: 15 })) // Region columns
    ];
    ws['!cols'] = colWidths;
    // Style the headers
    const range = xlsx.utils.decode_range(ws['!ref']);
    for(let C = range.s.c; C <= range.e.c; ++C) {
      const address = xlsx.utils.encode_cell({r: 0, c: C});
      if(!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: 'center' }
      };
    }
    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Corporate Income');
    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    // Send the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=corporate_income_template.xlsx');
    res.send(buf);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      message: error.message 
    });
  }
};
// Transform tabular Excel data (categories as rows, regions as columns) into standard format
const transformTabularData = (sheetData) => {
  const result = [];
  const regionColumns = [];
  // First row contains headers (Region names)
  const headers = Object.keys(sheetData[0]);
  // First column is expected to be "Category" or "Particulars"
  const categoryColumn = headers[0];
  // All other columns are region names
  regionColumns.push(...headers.slice(1));
    // Process each row (category)
  for (const row of sheetData) {
    const rawCategory = row[categoryColumn]?.trim();
    if (!rawCategory) continue;
    // Check if category contains subcategory (format: "Category - Subcategory")
    let category, subcategory;
    if (rawCategory.includes(" - ")) {
      [category, subcategory] = rawCategory.split(" - ").map(s => s.trim());
    } else {
      category = rawCategory;
      subcategory = ""; // Optional subcategory
    }    // Process each region column
    for (const region of regionColumns) {
      const amount = parseFloat(row[region]);
      // Allow zero values, only skip if amount is NaN
      if (!isNaN(amount)) {
        // Format particulars to only show subcategory and region
        const particulars = subcategory ? `${subcategory} (${region})` : region;
        result.push({
          Particulars: particulars,
          Category: category,
          Subcategory: subcategory,
          Amount: amount,
          Cost: amount,
          Region: region
        });
      }
    }
  }
  return result;
};
// Create sample template in tabular format (categories as rows, regions as columns)
const createTabularFormatTemplate = () => {
  const sampleData = [
    {
      "Category": "Corporate Income Tax - Large Taxpayers",  // With subcategory
      "Region I": 1500000,
      "Region II": 750000,
      "Region III": 250000
    },
    {
      "Category": "Irrigation Service Fees",  // Without subcategory
      "Region I": 800000,
      "Region II": 600000,
      "Region III": 400000
    },
    {
      "Category": "Permit Fees - Construction",  // With subcategory
      "Region I": 300000,
      "Region II": 250000,
      "Region III": 200000
    }
  ];
  const worksheet = xlsx.utils.json_to_sheet(sampleData);
  // Set column widths for better readability
  const wscols = [
    { wch: 40 }, // Category
    { wch: 15 }, // Region I
    { wch: 15 }, // Region II
    { wch: 15 }  // Region III
  ];
  worksheet['!cols'] = wscols;
  return worksheet;
};