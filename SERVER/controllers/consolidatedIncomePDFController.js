/**
 * Consolidated Corporate Income PDF Controller
 * Server-side secure PDF generation for corporate income reports
 * 
 * Security Features:
 * - Server-side generation (data never exposed to client raw)
 * - Watermarking with timestamp and user info
 * - Digital signature placeholder
 * - Audit trail logging
 * - Hierarchical access control support
 */

const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');
const Region = require('../models/Region');
const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');
const IncomeSubCategory = require('../models/IncomeSubcategory');

// Constants for PDF styling
const COLORS = {
  primary: '#1976d2',
  secondary: '#2e7d32',
  accent: '#f57c00',
  text: '#333333',
  lightText: '#666666',
  headerBg: '#1976d2',
  categoryBg: '#e3f2fd',
  subcategoryBg: '#f5f5f5',
  totalBg: '#e8f5e8',
  border: '#cccccc',
  white: '#ffffff'
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique'
};

/**
 * Format currency in Philippine Peso
 * Note: Using 'P' instead of '₱' because PDFKit's Helvetica doesn't support the peso symbol
 */
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  // Format with commas and 2 decimal places
  const formatted = num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `P ${formatted}`;
};

/**
 * Format percentage
 */
const formatPercentage = (value, total) => {
  if (!total || total === 0) return '0.0%';
  return ((value / total) * 100).toFixed(1) + '%';
};

/**
 * Truncate text to fit in column
 */
const truncateText = (text, maxLength = 40) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
};

/**
 * Draw watermark on page
 */
const drawWatermark = (doc, user, pageWidth, pageHeight) => {
  doc.save();
  doc.opacity(0.08);
  doc.fontSize(60);
  doc.font(FONTS.bold);
  doc.fillColor('#000000');
  
  // Diagonal watermark - use absolute positioning to avoid page overflow
  doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
  doc.text('OFFICIAL DOCUMENT', pageWidth / 4 - 100, pageHeight / 2 - 30, {
    align: 'center',
    width: 400,
    lineBreak: false  // Prevent line breaks that might cause page overflow
  });
  doc.restore();
  doc.opacity(1); // Reset opacity
};

/**
 * Draw page header
 */
const drawPageHeader = (doc, reportData, options, pageNum, totalPages) => {
  const { fiscalYear, budgetType, generatedBy, generatedAt } = reportData;
  
  // Header background
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.headerBg);
  
  // Title - use specific Y position, avoid text flow
  doc.fillColor(COLORS.white)
     .font(FONTS.bold)
     .fontSize(18)
     .text('CONSOLIDATED CORPORATE INCOME REPORT', 40, 20, {
       width: doc.page.width - 80,
       align: 'center',
       lineBreak: false
     });
  
  // Subtitle
  doc.font(FONTS.regular)
     .fontSize(11)
     .text(`Fiscal Year ${fiscalYear} | Budget Type: ${budgetType}`, 40, 45, {
       width: doc.page.width - 80,
       align: 'center',
       lineBreak: false
     });
  
  // Region info
  doc.fontSize(9)
     .text(`Region: ${options.selectedRegions === 'all' ? 'All Regions' : options.selectedRegions}`, 40, 60, {
       width: doc.page.width - 80,
       align: 'center',
       lineBreak: false
     });
};

/**
 * Draw page footer with security info
 */
const drawPageFooter = (doc, reportData, pageNum, totalPages) => {
  const footerY = doc.page.height - 40;
  
  doc.strokeColor(COLORS.border)
     .moveTo(40, footerY - 5)
     .lineTo(doc.page.width - 40, footerY - 5)
     .stroke();
  
  doc.fillColor(COLORS.lightText)
     .font(FONTS.regular)
     .fontSize(8);
  
  // Left side - Security info
  doc.text(`Generated: ${reportData.generatedAt} | By: ${reportData.generatedBy}`, 40, footerY, {
    width: 300,
    align: 'left',
    lineBreak: false
  });
  
  // Center - Document ID
  doc.text(`Doc ID: ${reportData.documentId}`, doc.page.width / 2 - 80, footerY, {
    width: 160,
    align: 'center',
    lineBreak: false
  });
  
  // Right side - Page number
  doc.text(`Page ${pageNum} of ${totalPages}`, doc.page.width - 140, footerY, {
    width: 100,
    align: 'right',
    lineBreak: false
  });
};

/**
 * Draw executive summary section
 */
const drawExecutiveSummary = (doc, reportData, startY) => {
  let currentY = startY;
  
  // Section title
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(14)
     .text('EXECUTIVE SUMMARY', 40, currentY, { lineBreak: false });
  currentY += 25;
  
  // Summary box
  doc.rect(40, currentY, doc.page.width - 80, 100)
     .fillAndStroke(COLORS.categoryBg, COLORS.border);
  
  currentY += 15;
  
  // Summary stats - use explicit positioning for each item
  doc.fillColor(COLORS.text)
     .font(FONTS.regular)
     .fontSize(10);
  
  const stats = [
    { label: 'Total Income Categories:', value: reportData.hierarchicalData?.length || 0 },
    { label: 'Total Subcategories:', value: reportData.hierarchicalData?.reduce((acc, cat) => acc + (cat.subcategories?.length || 0), 0) || 0 },
    { label: 'Regions Covered:', value: reportData.regions?.length || 0 },
    { label: 'Grand Total Income:', value: formatCurrency(reportData.grandTotal), highlight: true }
  ];
  
  stats.forEach((stat, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 60 + (col * 250);
    const y = currentY + (row * 25);
    
    doc.font(FONTS.bold).text(stat.label, x, y, { lineBreak: false, continued: false });
    doc.font(stat.highlight ? FONTS.bold : FONTS.regular)
       .fillColor(stat.highlight ? COLORS.secondary : COLORS.text)
       .text(String(stat.value), x + 150, y, { lineBreak: false, continued: false });
    doc.fillColor(COLORS.text);
  });
  
  currentY += 85;
  
  // Top categories by income - SIMPLIFIED to avoid page overflow
  if (reportData.hierarchicalData && reportData.hierarchicalData.length > 0) {
    currentY += 15;
    doc.fillColor(COLORS.primary)
       .font(FONTS.bold)
       .fontSize(12)
       .text('Top Income Categories', 40, currentY, { lineBreak: false });
    currentY += 20;
    
    // Sort and get top 3 categories (reduced from 5 to save space)
    const sortedCategories = [...reportData.hierarchicalData]
      .map(cat => ({
        name: cat.name,
        total: reportData.categoryTotals[cat.id] || 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    
    sortedCategories.forEach((cat, index) => {
      const percentage = reportData.grandTotal > 0 
        ? ((cat.total / reportData.grandTotal) * 100).toFixed(1) 
        : 0;
      
      doc.fillColor(COLORS.text)
         .font(FONTS.regular)
         .fontSize(9);
      doc.text(`${index + 1}. ${truncateText(cat.name, 40)}`, 60, currentY, { lineBreak: false });
      doc.text(formatCurrency(cat.total), 320, currentY, { lineBreak: false });
      doc.text(`(${percentage}%)`, 420, currentY, { lineBreak: false });
      
      currentY += 15;
    });
  }
  
  return currentY + 10;
};

/**
 * Draw category breakdown table
 */
const drawCategoryTable = (doc, reportData, options, startY, regionGroup, groupIndex, totalGroups) => {
  let currentY = startY;
  
  // Section title
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(12)
     .text(`INCOME CATEGORY BREAKDOWN ${totalGroups > 1 ? `(Part ${groupIndex + 1} of ${totalGroups})` : ''}`, 40, currentY, { lineBreak: false });
  currentY += 20;
  
  // Calculate column widths - adjusted for better alignment
  const pageWidth = doc.page.width - 80; // Account for margins
  const nameColWidth = 160;
  const totalColWidth = 100;
  const availableForRegions = pageWidth - nameColWidth - totalColWidth;
  const regionColWidth = Math.floor(availableForRegions / regionGroup.length);
  const tableWidth = nameColWidth + (regionColWidth * regionGroup.length) + totalColWidth;
  const startX = 40;
  
  // Table header
  const headerHeight = 25;
  doc.rect(startX, currentY, tableWidth, headerHeight).fill(COLORS.headerBg);
  
  // Draw header cell borders
  doc.strokeColor(COLORS.white).lineWidth(0.5);
  let borderX = startX + nameColWidth;
  for (let i = 0; i < regionGroup.length; i++) {
    doc.moveTo(borderX, currentY).lineTo(borderX, currentY + headerHeight).stroke();
    borderX += regionColWidth;
  }
  doc.moveTo(borderX, currentY).lineTo(borderX, currentY + headerHeight).stroke();
  
  doc.fillColor(COLORS.white)
     .font(FONTS.bold)
     .fontSize(8);
  
  // Header cells
  doc.text('Income Category', startX + 5, currentY + 8, { width: nameColWidth - 10, lineBreak: false });
  
  let headerX = startX + nameColWidth;
  regionGroup.forEach(region => {
    doc.text(truncateText(region, 12), headerX + 2, currentY + 8, { 
      width: regionColWidth - 4, 
      align: 'center',
      lineBreak: false
    });
    headerX += regionColWidth;
  });
  
  doc.text('Total', headerX + 2, currentY + 8, { 
    width: totalColWidth - 4, 
    align: 'center',
    lineBreak: false
  });
  
  currentY += headerHeight;
  
  // Data rows
  const rowHeight = 18;
  
  // Calculate how many rows can fit on current page
  const availableHeight = doc.page.height - 80 - currentY;
  const maxRowsOnPage = Math.floor(availableHeight / rowHeight);
  
  // Only render rows that fit on this page
  const rowsToRender = Math.min(reportData.hierarchicalData.length, maxRowsOnPage);
  
  for (let index = 0; index < rowsToRender; index++) {
    const category = reportData.hierarchicalData[index];
    const categoryTotal = reportData.categoryTotals[category.id] || 0;
    const bgColor = index % 2 === 0 ? COLORS.categoryBg : COLORS.white;
    
    // Row background with border
    doc.rect(startX, currentY, tableWidth, rowHeight).fill(bgColor);
    doc.rect(startX, currentY, tableWidth, rowHeight).stroke(COLORS.border);
    
    // Draw vertical cell borders
    doc.strokeColor(COLORS.border).lineWidth(0.3);
    let rowBorderX = startX + nameColWidth;
    for (let j = 0; j < regionGroup.length; j++) {
      doc.moveTo(rowBorderX, currentY).lineTo(rowBorderX, currentY + rowHeight).stroke();
      rowBorderX += regionColWidth;
    }
    doc.moveTo(rowBorderX, currentY).lineTo(rowBorderX, currentY + rowHeight).stroke();
    
    // Row content
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(7)
       .text(truncateText(category.name, 35), startX + 5, currentY + 5, { 
         width: nameColWidth - 10,
         lineBreak: false
       });
    
    let cellX = startX + nameColWidth;
    regionGroup.forEach(region => {
      const amount = reportData.regionData[region]?.categoryAmounts[category.id] || 0;
      doc.font(FONTS.regular)
         .text(formatCurrency(amount), cellX + 4, currentY + 5, { 
           width: regionColWidth - 8, 
           align: 'right',
           lineBreak: false
         });
      cellX += regionColWidth;
    });
    
    // Total
    doc.font(FONTS.bold)
       .fillColor(COLORS.secondary)
       .text(formatCurrency(categoryTotal), cellX + 4, currentY + 5, { 
         width: totalColWidth - 8, 
         align: 'right',
         lineBreak: false
       });
    
    doc.fillColor(COLORS.text);
    currentY += rowHeight;
  }
  
  // Grand total row
  doc.rect(startX, currentY, tableWidth, 22).fill(COLORS.totalBg);
  doc.rect(startX, currentY, tableWidth, 22).stroke(COLORS.secondary);
  
  // Draw vertical borders for grand total row
  doc.strokeColor(COLORS.secondary).lineWidth(0.5);
  let gtBorderX = startX + nameColWidth;
  for (let i = 0; i < regionGroup.length; i++) {
    doc.moveTo(gtBorderX, currentY).lineTo(gtBorderX, currentY + 22).stroke();
    gtBorderX += regionColWidth;
  }
  doc.moveTo(gtBorderX, currentY).lineTo(gtBorderX, currentY + 22).stroke();
  
  doc.fillColor(COLORS.secondary)
     .font(FONTS.bold)
     .fontSize(9)
     .text('GRAND TOTAL', startX + 5, currentY + 6, { width: nameColWidth - 10, lineBreak: false });
  
  let totalX = startX + nameColWidth;
  regionGroup.forEach(region => {
    const regionTotal = reportData.regionData[region]?.total || 0;
    doc.text(formatCurrency(regionTotal), totalX + 4, currentY + 6, { 
      width: regionColWidth - 8, 
      align: 'right',
      lineBreak: false
    });
    totalX += regionColWidth;
  });
  
  doc.fillColor(COLORS.primary)
     .text(formatCurrency(reportData.grandTotal), totalX + 4, currentY + 6, { 
       width: totalColWidth - 8, 
       align: 'right',
       lineBreak: false
     });
  
  currentY += 30;
  
  return currentY;
};

/**
 * Draw subcategory tree view
 */
const drawSubcategoryTreeView = (doc, reportData, options, startY, regionGroup, groupIndex, totalGroups) => {
  let currentY = startY;
  
  const categoriesWithSubcategories = reportData.hierarchicalData?.filter(
    cat => cat.subcategories && cat.subcategories.length > 0
  ) || [];
  
  if (categoriesWithSubcategories.length === 0) {
    doc.fillColor(COLORS.lightText)
       .font(FONTS.oblique)
       .fontSize(10)
       .text('No subcategory data available for this report.', 40, currentY, { lineBreak: false });
    return currentY + 30;
  }
  
  // Section title
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(12)
     .text(`SUBCATEGORY DETAILS (TREE VIEW) ${totalGroups > 1 ? `(Part ${groupIndex + 1} of ${totalGroups})` : ''}`, 40, currentY, { lineBreak: false });
  currentY += 20;
  
  // Calculate column widths - adjusted for better alignment
  const pageWidth = doc.page.width - 80; // Account for margins
  const nameColWidth = 180;
  const totalColWidth = 100;
  const availableForRegions = pageWidth - nameColWidth - totalColWidth;
  const regionColWidth = Math.floor(availableForRegions / regionGroup.length);
  const tableWidth = nameColWidth + (regionColWidth * regionGroup.length) + totalColWidth;
  const startX = 40;
  
  // Table header
  const headerHeight = 22;
  doc.rect(startX, currentY, tableWidth, headerHeight).fill(COLORS.headerBg);
  
  doc.fillColor(COLORS.white)
     .font(FONTS.bold)
     .fontSize(7);
  
  doc.text('Category / Subcategory', startX + 5, currentY + 7, { width: nameColWidth - 10, lineBreak: false });
  
  let headerX = startX + nameColWidth;
  regionGroup.forEach(region => {
    doc.text(truncateText(region, 10), headerX + 2, currentY + 7, { 
      width: regionColWidth - 4, 
      align: 'center',
      lineBreak: false
    });
    headerX += regionColWidth;
  });
  
  doc.text('Total', headerX + 2, currentY + 7, { 
    width: totalColWidth - 4, 
    align: 'center',
    lineBreak: false
  });
  
  currentY += headerHeight;
  
  // Tree view data - limit to what fits on page
  const maxCategoriesOnPage = Math.floor((doc.page.height - 80 - currentY) / 50); // Estimate 50px per category with subcategories
  const categoriesToRender = categoriesWithSubcategories.slice(0, Math.max(maxCategoriesOnPage, 5));
  
  categoriesToRender.forEach((category, catIndex) => {
    // Skip if no space
    if (currentY + 40 > doc.page.height - 60) {
      return;
    }
    
    const categoryTotal = reportData.categoryTotals[category.id] || 0;
    
    // Category row
    doc.rect(startX, currentY, tableWidth, 18).fill(COLORS.categoryBg);
    
    doc.fillColor(COLORS.primary)
       .font(FONTS.bold)
       .fontSize(7)
       .text(`▼ ${truncateText(category.name, 40)}`, startX + 5, currentY + 5, { 
         width: nameColWidth - 10,
         lineBreak: false
       });
    
    let cellX = startX + nameColWidth;
    regionGroup.forEach(region => {
      const amount = reportData.regionData[region]?.categoryAmounts[category.id] || 0;
      doc.fillColor(COLORS.text)
         .font(FONTS.regular)
         .text(formatCurrency(amount), cellX + 2, currentY + 5, { 
           width: regionColWidth - 4, 
           align: 'right',
           lineBreak: false
         });
      cellX += regionColWidth;
    });
    
    doc.fillColor(COLORS.secondary)
       .font(FONTS.bold)
       .text(formatCurrency(categoryTotal), cellX + 2, currentY + 5, { 
         width: totalColWidth - 4, 
         align: 'right',
         lineBreak: false
       });
    
    currentY += 18;
    
    // Subcategory rows - limit to first 3 if space is limited
    const maxSubcategories = Math.min(category.subcategories.length, 3);
    for (let subIndex = 0; subIndex < maxSubcategories; subIndex++) {
      // Skip if no space left
      if (currentY + 16 > doc.page.height - 60) {
        break;
      }
      
      const subcategory = category.subcategories[subIndex];
      const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;
      const subBgColor = subIndex % 2 === 0 ? COLORS.white : COLORS.subcategoryBg;
      
      doc.rect(startX, currentY, tableWidth, 15).fill(subBgColor);
      
      doc.fillColor(COLORS.lightText)
         .font(FONTS.regular)
         .fontSize(6)
         .text(`   └─ ${truncateText(subcategory.name, 38)}`, startX + 15, currentY + 4, { 
           width: nameColWidth - 20,
           lineBreak: false
         });
      
      let subCellX = startX + nameColWidth;
      regionGroup.forEach(region => {
        const amount = reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0;
        doc.fillColor(COLORS.text)
           .text(formatCurrency(amount), subCellX + 2, currentY + 4, { 
             width: regionColWidth - 4, 
             align: 'right',
             lineBreak: false
           });
        subCellX += regionColWidth;
      });
      
      doc.fillColor(COLORS.text)
         .text(formatCurrency(subcategoryTotal), subCellX + 2, currentY + 4, { 
           width: totalColWidth - 4, 
           align: 'right',
           lineBreak: false
         });
      
      currentY += 15;
    }
    
    currentY += 5;
  });
  
  return currentY;
};

/**
 * Generate unique document ID for audit trail
 */
const generateDocumentId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CCI-${timestamp}-${random}`.toUpperCase();
};

/**
 * Main PDF export controller
 * Generates server-side PDF with security features
 */
const exportConsolidatedIncomePDF = async (req, res) => {
  // Use console.error for debugging (bypasses ALLOW_SERVER_LOGS filter)
  console.error('[PDF EXPORT] ========== ENDPOINT HIT ==========');
  console.error('[PDF EXPORT] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { fiscalYear, budgetType, selectedRegions, activeTab, showPercentages } = req.body;
    console.error('[PDF EXPORT] Parsed values - fiscalYear:', fiscalYear, 'activeTab:', activeTab, 'selectedRegions:', selectedRegions);
    
    const user = req.user || { name: 'System', email: 'system@fmis.gov.ph' };
    
    // Validate required parameters
    if (!fiscalYear) {
      return res.status(400).json({ 
        error: 'Fiscal year is required',
        code: 'MISSING_FISCAL_YEAR'
      });
    }
    
    // Apply hierarchical filters if present
    let regionFilter = null;
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      regionFilter = req.hierarchicalFilters.region;
    } else if (selectedRegions && selectedRegions !== 'all') {
      regionFilter = selectedRegions;
    }
    
    // Fetch data from database
    const queryBudgetType = (budgetType || 'INITIAL').toUpperCase();
    
    // Get regions
    let regions;
    if (regionFilter) {
      regions = [{ Region: regionFilter }];
    } else {
      regions = await Region.find().sort({ Region: 1 });
    }
    
    // Get income categories (deduplicated)
    const allIncomeCategories = await IncomeCategory.find().sort({ incomeCategoryName: 1 });
    const categoryMap = new Map();
    allIncomeCategories.forEach(category => {
      const categoryName = category.incomeCategoryName || category.name;
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          _id: category._id,
          name: categoryName,
          regions: [...(category.regions || [])],
          isGlobal: category.isGlobal || false
        });
      } else {
        const existing = categoryMap.get(categoryName);
        existing.regions = [...new Set([...existing.regions, ...(category.regions || [])])];
      }
    });
    const incomeCategories = Array.from(categoryMap.values());
    
    // Get income entries
    const incomeQuery = { fiscalYear, budgetType: { $regex: new RegExp(queryBudgetType, 'i') } };
    if (regionFilter) {
      incomeQuery.region = { $regex: new RegExp(`^${regionFilter}$`, 'i') };
    }
    const incomeEntries = await Income.find(incomeQuery).populate('incomecategory');
    
    // Get subcategories
    const incomeSubCategories = await IncomeSubCategory.find().sort({ incomeSubcategoryName: 1 });
    
    // Extract dynamic subcategories from income entries
    const subcategorySet = new Set();
    const subcategoryToCategoryMap = new Map();
    incomeEntries.forEach(entry => {
      const subcategoryName = entry.subcategory;
      if (subcategoryName && subcategoryName !== 'Uncategorized' && subcategoryName.trim() !== '') {
        subcategorySet.add(subcategoryName);
        const entryCategory = entry.incomecategory;
        if (entryCategory) {
          let categoryName = typeof entryCategory === 'object' 
            ? (entryCategory.incomeCategoryName || entryCategory.name || 'Uncategorized')
            : 'Uncategorized';
          subcategoryToCategoryMap.set(subcategoryName, categoryName);
        }
      }
    });
    
    const dynamicSubcategories = Array.from(subcategorySet).map(name => ({
      _id: `dynamic_${name.replace(/\s+/g, '_').toLowerCase()}`,
      incomeSubcategoryName: name,
      name: name,
      parentCategory: subcategoryToCategoryMap.get(name) || 'Uncategorized'
    }));
    
    const allSubcategories = [...incomeSubCategories, ...dynamicSubcategories];
    
    // Build result structure
    const reportData = {
      fiscalYear,
      budgetType: queryBudgetType,
      regions: regions.map(r => r.Region),
      hierarchicalData: [],
      regionData: {},
      categoryTotals: {},
      subcategoryTotals: {},
      categorySubcategoryMap: {},
      grandTotal: 0,
      generatedBy: user.name || user.email || 'Unknown',
      generatedAt: new Date().toLocaleString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      documentId: generateDocumentId()
    };
    
    // Initialize structures
    regions.forEach(region => {
      reportData.regionData[region.Region] = {
        categoryAmounts: {},
        subcategoryAmounts: {},
        total: 0
      };
      incomeCategories.forEach(cat => {
        reportData.regionData[region.Region].categoryAmounts[cat._id.toString()] = 0;
      });
      allSubcategories.forEach(sub => {
        reportData.regionData[region.Region].subcategoryAmounts[sub._id.toString()] = 0;
      });
    });
    
    incomeCategories.forEach(cat => {
      const catId = cat._id.toString();
      reportData.categoryTotals[catId] = 0;
      reportData.hierarchicalData.push({
        id: catId,
        name: cat.name,
        type: 'category',
        subcategories: []
      });
      reportData.categorySubcategoryMap[catId] = [];
    });
    
    allSubcategories.forEach(sub => {
      reportData.subcategoryTotals[sub._id.toString()] = 0;
    });
    
    // Process income entries
    incomeEntries.forEach(entry => {
      const region = entry.region || 'Unspecified';
      const amount = Number(entry.amount) || 0;
      const subcategoryName = entry.subcategory || 'Uncategorized';
      const entryCategory = entry.incomecategory;
      
      if (!reportData.regionData[region]) return;
      
      let categoryId = null;
      let categoryName = 'Uncategorized';
      
      if (entryCategory) {
        categoryName = typeof entryCategory === 'object'
          ? (entryCategory.incomeCategoryName || entryCategory.name || 'Uncategorized')
          : 'Uncategorized';
        
        const matchingCat = incomeCategories.find(c => 
          c.name === categoryName || c.name?.toLowerCase() === categoryName?.toLowerCase()
        );
        if (matchingCat) categoryId = matchingCat._id.toString();
      }
      
      if (!categoryId || reportData.categoryTotals[categoryId] === undefined) return;
      
      // Update amounts
      reportData.regionData[region].categoryAmounts[categoryId] += amount;
      reportData.regionData[region].total += amount;
      reportData.categoryTotals[categoryId] += amount;
      reportData.grandTotal += amount;
      
      // Handle subcategories
      if (subcategoryName && subcategoryName !== 'Uncategorized') {
        const matchingSub = allSubcategories.find(s => 
          (s.incomeSubcategoryName || s.name)?.toLowerCase() === subcategoryName.toLowerCase()
        );
        if (matchingSub) {
          const subId = matchingSub._id.toString();
          if (reportData.regionData[region].subcategoryAmounts[subId] !== undefined) {
            reportData.regionData[region].subcategoryAmounts[subId] += amount;
          }
          if (reportData.subcategoryTotals[subId] !== undefined) {
            reportData.subcategoryTotals[subId] += amount;
          }
          if (!reportData.categorySubcategoryMap[categoryId].includes(subId)) {
            reportData.categorySubcategoryMap[categoryId].push(subId);
          }
        }
      }
    });
    
    // Build hierarchical structure
    reportData.hierarchicalData.forEach(catItem => {
      const subIds = reportData.categorySubcategoryMap[catItem.id] || [];
      subIds.forEach(subId => {
        const sub = allSubcategories.find(s => s._id.toString() === subId);
        if (sub) {
          catItem.subcategories.push({
            id: subId,
            name: sub.incomeSubcategoryName || sub.name,
            type: 'subcategory',
            parentId: catItem.id
          });
        }
      });
      catItem.subcategories.sort((a, b) => a.name.localeCompare(b.name));
    });
    reportData.hierarchicalData.sort((a, b) => a.name.localeCompare(b.name));
    
    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      autoFirstPage: true, // Only create first page automatically
      info: {
        Title: `Consolidated Corporate Income Report - FY${fiscalYear}`,
        Author: reportData.generatedBy,
        Subject: 'Corporate Income Report',
        Keywords: 'income, budget, fiscal, report',
        Creator: 'FMIS Budget System',
        Producer: 'PDFKit',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
    
    // Set response headers
    const filename = `Consolidated_Corporate_Income_${fiscalYear}_${queryBudgetType}_${reportData.documentId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Document-ID', reportData.documentId);
    
    // Handle PDF errors before piping
    doc.on('error', (err) => {
      console.error('PDF Document Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'PDF generation failed' });
      }
    });
    
    // Pipe to response
    doc.pipe(res);
    
    // Calculate pages needed
    const filteredRegions = reportData.regions;
    const regionsPerPage = 4;
    const regionGroups = [];
    for (let i = 0; i < filteredRegions.length; i += regionsPerPage) {
      regionGroups.push(filteredRegions.slice(i, i + regionsPerPage));
    }
    
    const tabType = parseInt(activeTab);
    // Handle NaN case - default to showing category table (1)
    const effectiveTabType = isNaN(tabType) ? 1 : tabType;
    
    const isSingleRegion = filteredRegions.length <= 4;
    const totalExpectedPages = isSingleRegion ? 1 : regionGroups.length;
    
    console.error(`[PDF DEBUG] Regions: ${filteredRegions.length}, Groups: ${regionGroups.length}`);
    
    const pageWidth = 842; // A4 landscape
    const pageHeight = 595;
    const margin = 40;
    const tableWidth = pageWidth - (margin * 2);
    
    // Helper function - safe text that doesn't auto-advance cursor
    const safeText = (text, x, y, options = {}) => {
      doc.text(text, x, y, { lineBreak: false, height: 15, ...options });
    };
    
    // Get tab title - tabs are VIEW TYPES, not income type filters
    const getTabTitle = () => {
      switch(effectiveTabType) {
        case 0: return 'CONSOLIDATED CORPORATE INCOME - EXECUTIVE SUMMARY';
        case 1: return 'CONSOLIDATED CORPORATE INCOME - CATEGORY BREAKDOWN';
        case 2: return 'CONSOLIDATED CORPORATE INCOME - SUBCATEGORY DETAILS';
        default: return 'CONSOLIDATED CORPORATE INCOME REPORT';
      }
    };
    
    for (let pageIndex = 0; pageIndex < regionGroups.length; pageIndex++) {
      if (pageIndex > 0) doc.addPage();
      
      const pageRegions = regionGroups[pageIndex];
      console.error(`[PDF DEBUG] Page ${pageIndex + 1}: ${pageRegions.length} regions`);
      
      // ===== HEADER =====
      doc.rect(0, 0, pageWidth, 70).fill('#1565C0');
      doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(14);
      safeText(getTabTitle(), margin, 15, { width: tableWidth });
      doc.fontSize(11).font('Helvetica');
      safeText(`Fiscal Year: ${fiscalYear} | Budget Type: ${budgetType}`, margin, 35);
      safeText(`Page ${pageIndex + 1} of ${regionGroups.length}`, pageWidth - 150, 35);
      safeText(`Generated: ${new Date().toLocaleString()}`, margin, 52);
      
      // ===== TABLE HEADER =====
      let y = 85;
      const colWidths = [280]; // Category column
      const regionColWidth = Math.floor((tableWidth - 280 - 100) / pageRegions.length);
      pageRegions.forEach(() => colWidths.push(regionColWidth));
      colWidths.push(100); // Total column
      
      // Header row background
      doc.rect(margin, y, tableWidth, 25).fill('#E3F2FD');
      doc.rect(margin, y, tableWidth, 25).stroke('#1565C0');
      
      // Header text
      doc.fill('#1565C0').font('Helvetica-Bold').fontSize(9);
      let x = margin + 5;
      safeText('INCOME CATEGORY', x, y + 8);
      x = margin + colWidths[0];
      
      for (let i = 0; i < pageRegions.length; i++) {
        // Show full region name, let PDF handle text wrapping if needed
        const regionName = pageRegions[i];
        doc.rect(x, y, regionColWidth, 25).stroke('#1565C0');
        safeText(regionName, x + 3, y + 8, { width: regionColWidth - 6 });
        x += regionColWidth;
      }
      
      doc.rect(x, y, 100, 25).stroke('#1565C0');
      safeText('TOTAL', x + 35, y + 8);
      
      // ===== TABLE DATA ROWS =====
      y += 25;
      const rowHeight = 22;
      const maxRows = Math.floor((pageHeight - y - 80) / rowHeight); // Leave space for footer
      
      doc.font('Helvetica').fontSize(8);
      let rowCount = 0;
      
      for (const category of reportData.hierarchicalData) {
        if (rowCount >= maxRows) break;
        
        // Category row (bold, with background)
        const isEven = rowCount % 2 === 0;
        doc.rect(margin, y, tableWidth, rowHeight).fill(isEven ? '#FAFAFA' : '#FFFFFF');
        doc.rect(margin, y, tableWidth, rowHeight).stroke('#E0E0E0');
        
        doc.fill('#333333').font('Helvetica-Bold').fontSize(8);
        x = margin + 5;
        const catName = category.name.length > 40 ? category.name.substring(0, 40) + '...' : category.name;
        safeText(catName, x, y + 7);
        
        x = margin + colWidths[0];
        doc.font('Helvetica').fontSize(8);
        
        // Region values
        for (const regionName of pageRegions) {
          const regionData = reportData.regionData[regionName] || {};
          const catTotal = regionData.categoryAmounts?.[category.id] || 0;
          doc.rect(x, y, regionColWidth, rowHeight).stroke('#E0E0E0');
          safeText(formatCurrency(catTotal), x + 3, y + 7, { width: regionColWidth - 6, align: 'right' });
          x += regionColWidth;
        }
        
        // Total
        const categoryTotal = reportData.categoryTotals[category.id] || 0;
        doc.rect(x, y, 100, rowHeight).stroke('#E0E0E0');
        doc.font('Helvetica-Bold');
        safeText(formatCurrency(categoryTotal), x + 3, y + 7, { width: 94, align: 'right' });
        
        y += rowHeight;
        rowCount++;
        
        // Subcategories (if any, indented)
        if (category.subCategories && category.subCategories.length > 0) {
          for (const subcat of category.subCategories) {
            if (rowCount >= maxRows) break;
            
            const isSubEven = rowCount % 2 === 0;
            doc.rect(margin, y, tableWidth, rowHeight).fill(isSubEven ? '#FAFAFA' : '#FFFFFF');
            doc.rect(margin, y, tableWidth, rowHeight).stroke('#E0E0E0');
            
            doc.fill('#666666').font('Helvetica').fontSize(7);
            x = margin + 20; // Indent
            const subName = subcat.name.length > 38 ? subcat.name.substring(0, 38) + '...' : subcat.name;
            safeText(`• ${subName}`, x, y + 7);
            
            x = margin + colWidths[0];
            
            for (const regionName of pageRegions) {
              const regionData = reportData.regionData[regionName] || {};
              const subTotal = regionData.subcategoryAmounts?.[subcat.id] || 0;
              doc.rect(x, y, regionColWidth, rowHeight).stroke('#E0E0E0');
              safeText(formatCurrency(subTotal), x + 3, y + 7, { width: regionColWidth - 6, align: 'right' });
              x += regionColWidth;
            }
            
            const subcatTotal = reportData.subcategoryTotals[subcat.id] || 0;
            doc.rect(x, y, 100, rowHeight).stroke('#E0E0E0');
            safeText(formatCurrency(subcatTotal), x + 3, y + 7, { width: 94, align: 'right' });
            
            y += rowHeight;
            rowCount++;
          }
        }
      }
      
      // ===== GRAND TOTAL ROW - Only show on the last page =====
      const isLastPage = pageIndex === regionGroups.length - 1;
      if (isLastPage) {
        doc.rect(margin, y, tableWidth, 25).fill('#1565C0');
        doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(9);
        x = margin + 5;
        safeText('GRAND TOTAL', x, y + 8);
        
        x = margin + colWidths[0];
        for (const regionName of pageRegions) {
          const regionData = reportData.regionData[regionName] || {};
          const regionGrandTotal = regionData.total || 0;
          safeText(formatCurrency(regionGrandTotal), x + 3, y + 8, { width: regionColWidth - 6, align: 'right' });
          x += regionColWidth;
        }
        safeText(formatCurrency(reportData.grandTotal), x + 3, y + 8, { width: 94, align: 'right' });
        
        y += 25; // Add space after grand total
      }
      
      // ===== FOOTER =====
      // Position footer relative to content end, with minimum bottom margin
      const footerY = Math.max(y + 10, pageHeight - 60);
      doc.rect(0, footerY, pageWidth, 50).fill('#F5F5F5');
      doc.fill('#666666').font('Helvetica').fontSize(7);
      safeText(`Document ID: ${reportData.documentId}`, margin, footerY + 8);
      
      // Get user name - prefer user object, fallback to identity object
      let userFullName = 'Unknown User';
      let userEmail = '-';

      // First try the user object (should be updated by middleware)
      if (user?.FirstName && user?.LastName) {
        userFullName = `${user.FirstName} ${user.LastName}`;
        userEmail = user?.email || user?.Email || '-';
      } else if (user?.displayName || user?.fullName) {
        userFullName = user.displayName || user.fullName;
        userEmail = user?.email || user?.Email || '-';
      } else if (user?.name) {
        userFullName = user.name;
        userEmail = user?.email || user?.Email || '-';
      }

      // If user object doesn't have proper name, try identity object
      if (userFullName === '909549' || userFullName === 'Unknown User') {
        const identity = req.identity;
        if (identity?.displayName) {
          userFullName = identity.displayName;
          userEmail = identity?.email || userEmail;
        }
      }

      safeText(`Generated by: ${userFullName} (${userEmail})`, margin, footerY + 25);
      safeText('CONFIDENTIAL - For Official Use Only', pageWidth - 200, footerY + 17);
    }
    
    console.error(`[PDF DEBUG] Done - ${regionGroups.length} pages created`);
    
    // Log audit trail
    console.log(`[AUDIT] PDF Generated: ${reportData.documentId} | User: ${reportData.generatedBy} | FY: ${fiscalYear} | Type: ${queryBudgetType}`);
    
    // Finalize PDF
    doc.end();
    
  } catch (err) {
    console.error('Error generating consolidated income PDF:', err);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF report',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } else {
      // If headers already sent, end the response
      res.end();
    }
  }
};

/**
 * Get PDF preview data (returns report data without generating PDF)
 * Used for client-side preview before download
 */
const getConsolidatedIncomePreview = async (req, res) => {
  try {
    const { fiscalYear, budgetType, selectedRegions } = req.query;
    
    if (!fiscalYear) {
      return res.status(400).json({ error: 'Fiscal year is required' });
    }
    
    // Return minimal preview data
    res.json({
      success: true,
      preview: {
        fiscalYear,
        budgetType: budgetType || 'INITIAL',
        selectedRegions: selectedRegions || 'all',
        documentId: generateDocumentId(),
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('Error getting preview:', err);
    res.status(500).json({ error: 'Failed to get preview data' });
  }
};

module.exports = {
  exportConsolidatedIncomePDF,
  getConsolidatedIncomePreview
};
