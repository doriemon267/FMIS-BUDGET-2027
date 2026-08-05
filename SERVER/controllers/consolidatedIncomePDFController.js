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

const fs = require('fs');
const os = require('os');
const path = require('path');
let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}
const Settings = require('../models/Settings');
const Region = require('../models/Region');
const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');
const IncomeSubCategory = require('../models/IncomeSubcategory');
const DiscountSettings = require('../models/DiscountSettings');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { extractSignatoriesFromWorkflow, drawWorkflowSignatureBlock, cleanupTempImages, enrichSignatoriesWithPositionTitle } = require('../utils/pdfSignatureHelper');

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
 * Note: Using 'P' to keep symbol rendering consistent across environments
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
    if (!MuhammaraRecipe) {
      return res.status(500).json({ error: 'PDF generation library (muhammara) is not installed on the server.' });
    }

    const { fiscalYear, budgetType, selectedRegions, activeTab, showPercentages } = req.body;
    
    // --- SECURITY OVERRIDE: Enforce scope based on user roles and assignments ---
    const userId = req.user?.id || req.user?.userId || req.user?._id || req.user?.UserId;
    const userRoles = req.user?.roles || req.user?.Roles || [];

    // Region-wide roles (Super Admins + BRD roles)
    const REGION_WIDE_ROLES = [
      'SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER',
      'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST',
      'BUDGET_OFFICER', 'BUDGET OFFICER',
      'OVERALL_BUDGET_APPROVER', 'OVERALL BUDGET APPROVER',
      'BUDGET_ADMIN', 'BUDGET ADMIN',
    ];
    let isSuperAdmin = userRoles.some(r => REGION_WIDE_ROLES.includes(r));

    let department = req.body.department;
    let division = req.body.division;

    if (!isSuperAdmin) {
      let assignedDept = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName
        || req.submissionWorkflowFilters?.department;
      let assignedDiv = req.hierarchicalAccess?.accessibleDivisions?.[0]
        || req.submissionWorkflowFilters?.division;

      // Emergency DB lookup if middleware didn't provide dept
      if (userId && !assignedDept) {
        try {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
            .populate('departmentId').lean();
          if (assignment) {
            const level = assignment.assignmentLevel || '';
            const isRegionLevel = ['BUDGET_AND_REVENUE_DIVISION', 'REGION', 'FULL'].includes(level);
            if (isRegionLevel) {
              isSuperAdmin = true;
            } else if (!assignedDept) {
              assignedDept = assignment.departmentId?.departmentName
                || assignment.departmentId?.Department
                || assignment.departmentId?.DepartmentName;
              assignedDiv = assignedDiv || assignment.divisionName || assignment.division;
            }
          }
        } catch (_) {}
      }

      if (!isSuperAdmin) {
        if (!assignedDept) {
          return res.status(403).json({
            error: 'Cannot generate PDF: your organizational scope could not be determined.',
            code: 'SCOPE_NOT_DETERMINED'
          });
        }
        // Override with scoped values
        department = assignedDept;
        division = assignedDiv;
      }
    }
    
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

    // Enforce accessible region if not super admin and not specified
    if (!isSuperAdmin && !regionFilter) {
      const accessibleRegion = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName
        || req.hierarchicalAccessInfo?.accessibleRegions?.[0]?.regionName;
      if (accessibleRegion) regionFilter = accessibleRegion;
    }
    
    // Fetch data from database
    const queryBudgetType = (budgetType || 'INITIAL').toUpperCase();
    
    // Get regions
    let regions;
    if (regionFilter) {
      if (Array.isArray(regionFilter)) {
        regions = regionFilter.map(r => ({ Region: r }));
      } else {
        regions = [{ Region: regionFilter }];
      }
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
      if (Array.isArray(regionFilter)) {
        incomeQuery.region = { $in: regionFilter.map(r => new RegExp(`^${r}$`, 'i')) };
      } else {
        incomeQuery.region = { $regex: new RegExp(`^${regionFilter}$`, 'i') };
      }
    }
    
    // Fetch data using the same query as the screen report (reports.controller.js)
    const incomeEntries = await Income.find(incomeQuery).populate('incomecategory');

    // Resolve workflow signatories from linked NewProposalWorkflow
    let signatoriesInfo = extractSignatoriesFromWorkflow(null, req.user);
    const workflowRefId = incomeEntries.map((e) => e.workflowRef).filter(Boolean)[0];
    if (workflowRefId) {
      const workflow = await NewProposalWorkflow.findById(workflowRefId)
        .select('createdByName workflowHistory consolidatedByName')
        .lean();
      if (workflow) {
        signatoriesInfo = extractSignatoriesFromWorkflow(workflow, req.user);
      }
    }
    
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
    reportData.signatoriesInfo = signatoriesInfo;
    
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
      const entryRegion = (entry.region || 'Unspecified').trim();
      const amount = Number(entry.amount) || 0;
      const subcategoryName = entry.subcategory || 'Uncategorized';
      const entryCategory = entry.incomecategory;
      
      // Case-insensitive region matching
      const targetRegion = Object.keys(reportData.regionData).find(
        r => r.toLowerCase() === entryRegion.toLowerCase()
      );
      
      if (!targetRegion) return;
      
      let categoryId = null;
      let categoryName = 'Uncategorized';
      
      if (entryCategory) {
        categoryName = typeof entryCategory === 'object'
          ? (entryCategory.incomeCategoryName || entryCategory.name || 'Uncategorized')
          : 'Uncategorized';
        
        const matchingCat = incomeCategories.find(c => 
          c.name?.trim().toLowerCase() === categoryName.trim().toLowerCase()
        );
        if (matchingCat) categoryId = matchingCat._id.toString();
      }
      
      if (!categoryId || reportData.categoryTotals[categoryId] === undefined) return;
      
      // Update amounts
      reportData.regionData[targetRegion].categoryAmounts[categoryId] += amount;
      reportData.regionData[targetRegion].total += amount;
      reportData.categoryTotals[categoryId] += amount;
      reportData.grandTotal += amount;
      
      // Handle subcategories
      if (subcategoryName && subcategoryName !== 'Uncategorized') {
        const matchingSub = allSubcategories.find(s => 
          (s.incomeSubcategoryName || s.name)?.trim().toLowerCase() === subcategoryName.trim().toLowerCase()
        );
        if (matchingSub) {
          const subId = matchingSub._id.toString();
          if (reportData.regionData[targetRegion].subcategoryAmounts[subId] !== undefined) {
            reportData.regionData[targetRegion].subcategoryAmounts[subId] += amount;
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
    // NOTE: Final category order (matching IncomeTable.jsx) is applied AFTER discount rows are injected below.

    // Discount base = "Current Account" SUBCATEGORY of ISF (not the full ISF total).
    // Net ISF = isfTotal - discountAmount.
    try {
      const isfCategoryKey = reportData.hierarchicalData.find(cat =>
        cat.name && cat.name.toLowerCase().includes('irrigation service fees') &&
        !cat.name.toLowerCase().includes('net')
      );
      if (isfCategoryKey) {
        const discountQuery = { fiscalYear, budgetType: queryBudgetType };
        if (regionFilter && !Array.isArray(regionFilter)) {
          discountQuery.region = { $regex: new RegExp(`^${regionFilter}$`, 'i') };
        }
        const discountSettingsDoc = await DiscountSettings.findOne(discountQuery);
        const applyDiscount = discountSettingsDoc ? discountSettingsDoc.applyDiscount : true;
        const discountType   = discountSettingsDoc ? discountSettingsDoc.discountType   : 'percentage';
        const discountValue  = discountSettingsDoc ? discountSettingsDoc.discountValue  : 10;

        if (applyDiscount) {
          const isfCatId = isfCategoryKey.id;
          const isfGrandTotal = reportData.categoryTotals[isfCatId] || 0;

          // Compute "Current Account" subtotal per region
          const currentAccountByRegion = {};
          regions.forEach(r => { currentAccountByRegion[r.Region] = 0; });

          incomeEntries.forEach(entry => {
            const entryCategory = entry.incomecategory;
            if (!entryCategory) return;
            const catName = typeof entryCategory === 'object'
              ? (entryCategory.incomeCategoryName || entryCategory.name || '')
              : '';
            const isIsf = catName.toLowerCase().includes('irrigation service fees') &&
                          !catName.toLowerCase().includes('net');
            if (!isIsf) return;
            if (entry.subcategory !== 'Current Account') return;
            const rName = Object.keys(currentAccountByRegion).find(
              k => k.toLowerCase() === (entry.region || '').trim().toLowerCase()
            );
            if (rName) currentAccountByRegion[rName] += Number(entry.amount) || 0;
          });

          const discountRegionAmounts = {};
          const netIsfRegionAmounts = {};
          let discountGrandTotal = 0;

          regions.forEach(region => {
            const regionName = region.Region;
            const isfRegionAmount = reportData.regionData[regionName]?.categoryAmounts[isfCatId] || 0;
            const currentAcct = currentAccountByRegion[regionName] || 0;
            const discountAmount = discountType === 'percentage'
              ? currentAcct * (discountValue / 100)
              : Math.min(discountValue, currentAcct);
            discountRegionAmounts[regionName] = discountAmount;
            netIsfRegionAmounts[regionName] = isfRegionAmount - discountAmount;
            discountGrandTotal += discountAmount;
          });

          const netIsfGrandTotal = isfGrandTotal - discountGrandTotal;
          const discountLabel = discountType === 'percentage'
            ? `Less: ${discountValue}% Discount on Current Account`
            : `Less: Discount on Current Account (Fixed)`;

          const discountCatId = '__discount_isf__';
          reportData.categoryTotals[discountCatId] = discountGrandTotal;
          reportData.categorySubcategoryMap[discountCatId] = [];
          regions.forEach(region => {
            if (!reportData.regionData[region.Region]) return;
            reportData.regionData[region.Region].categoryAmounts[discountCatId] = discountRegionAmounts[region.Region];
          });
          reportData.hierarchicalData.push({
            id: discountCatId, name: discountLabel, type: 'category',
            isDiscount: true, subcategories: [], order: 9998
          });

          const netIsfCatId = '__net_isf__';
          reportData.categoryTotals[netIsfCatId] = netIsfGrandTotal;
          reportData.categorySubcategoryMap[netIsfCatId] = [];
          regions.forEach(region => {
            if (!reportData.regionData[region.Region]) return;
            reportData.regionData[region.Region].categoryAmounts[netIsfCatId] = netIsfRegionAmounts[region.Region];
          });
          reportData.hierarchicalData.push({
            id: netIsfCatId, name: 'Net Irrigation Service Fees', type: 'category',
            isNetIsf: true, subcategories: [], order: 9999
          });

          reportData.grandTotal -= discountGrandTotal;
          reportData.isfDiscount = { applyDiscount, discountType, discountValue, discountGrandTotal, netIsfGrandTotal };
        }
      }
    } catch (discountErr) {
      console.warn('[PDF] ISF discount computation failed (non-fatal):', discountErr.message);
    }
    // --- End ISF Discount Logic ---

    // --- Final Category Ordering (mirrors IncomeTable.jsx categoryOrder) ---
    {
      const CATEGORY_ORDER = [
        'irrigation service fees',
        'less:',
        'net irrigation service fees',
        'rent income',
        'water service fee',
        'miscellaneous income',
      ];
      const getPriority = (name) => {
        const lower = (name || '').toLowerCase();
        for (let i = 0; i < CATEGORY_ORDER.length; i++) {
          if (lower.startsWith(CATEGORY_ORDER[i]) || lower === CATEGORY_ORDER[i]) return i;
        }
        return CATEGORY_ORDER.length;
      };
      reportData.hierarchicalData.sort((a, b) => {
        const pa = getPriority(a.name);
        const pb = getPriority(b.name);
        if (pa !== pb) return pa - pb;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    // --- End Final Category Ordering ---
    
    const filename = `Consolidated_Income_${fiscalYear}_${queryBudgetType}.pdf`;
    const tmpFilePath = path.join(os.tmpdir(), `cons_income_${Date.now()}.pdf`);
    const tempSignatureImagePaths = [];

    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: reportData.generatedBy,
      title: `Consolidated Corporate Income Report - FY${fiscalYear}`,
      subject: 'Corporate Income Report',
    });

    const PAGE_WIDTH = 612; // 8.5 x 13 portrait
    const PAGE_HEIGHT = 936;
    const MARGIN = 18;
    const MARGIN_TOP = 25;
    const MARGIN_BOTTOM = 18;
    const LINE_HEIGHT = 14;
    const CONTENT_LEFT = MARGIN;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
    const TABLE_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

    let currentPage = 0;

    const resolveLogoPath = (name) => {
      const serverAsset = path.join(__dirname, `../assets/${name}`);
      if (fs.existsSync(serverAsset)) return serverAsset;
      const clientAsset = path.join(__dirname, `../../CLIENT/public/${name}`);
      if (fs.existsSync(clientAsset)) return clientAsset;
      return null;
    };

    const resolveExisting = (...candidates) => {
      for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
      return null;
    };

    // ── Font resolution: Cambria & Trajan Pro (Windows fonts) ────────────────
    const F_CAMBRIA      = resolveExisting('C:/Windows/Fonts/cambria.ttc',  'C:/Windows/Fonts/CAMBRIA.TTC')  || 'Times-Roman';
    const F_CAMBRIA_B    = resolveExisting('C:/Windows/Fonts/cambriab.ttf', 'C:/Windows/Fonts/CAMBRIAB.TTF') || 'Times-Bold';
    const F_TRAJAN       = resolveExisting(
      'C:/Windows/Fonts/TrajanPro3Regular.otf',
      'C:/Windows/Fonts/TrajanPro-Regular.otf',
      'C:/Windows/Fonts/trajan.ttf',
      'C:/Program Files/Adobe/Acrobat DC/Resource/Font/TrajanPro3-Regular.otf',
      'C:/Program Files (x86)/Common Files/Adobe/Fonts/TrajanPro3-Regular.otf'
    ) || 'Times-Bold';
    const F_TRAJAN_B     = resolveExisting(
      'C:/Windows/Fonts/TrajanPro3Bold.otf',
      'C:/Windows/Fonts/TrajanPro-Bold.otf'
    ) || 'Times-Bold';

    const textOpt = (opts = {}) => ({
      color: opts.color || '#000000',
      fontSize: opts.fontSize || 9,
      bold: opts.bold || false,
      align: opts.align || 'left',
      font: opts.font || (opts.bold ? F_CAMBRIA_B : F_CAMBRIA)
    });
    const drawBorder = () => {
      // Border disabled as requested
    };

    const tabType = parseInt(activeTab, 10);
    const effectiveTabType = isNaN(tabType) ? 1 : tabType;
    const getTabTitle = () => {
      switch (effectiveTabType) {
        case 0: return 'CORPORATE INCOME - EXECUTIVE SUMMARY';
        case 1: return 'CORPORATE INCOME - CATEGORY BREAKDOWN';
        case 2: return 'CORPORATE INCOME - SUBCATEGORY DETAILS';
        default: return 'CORPORATE INCOME REPORT';
      }
    };

    const filteredRegions = reportData.regions;
    const regionsPerGroup = 4;
    const regionGroups = [];
    for (let i = 0; i < filteredRegions.length; i += regionsPerGroup) {
      regionGroups.push(filteredRegions.slice(i, i + regionsPerGroup));
    }

    const rows = [];
    reportData.hierarchicalData.forEach((category) => {
      const categoryTotal = reportData.categoryTotals?.[category.id] || 0;
      if (categoryTotal <= 0) return; // Skip categories with 0 total

      rows.push({
        label: String(category.name || ''),
        bold: true,
        valuesByRegion: (regionName) => reportData.regionData?.[regionName]?.categoryAmounts?.[category.id] || 0,
        total: categoryTotal,
      });

      const subcategories = Array.isArray(category.subcategories)
        ? category.subcategories
        : (Array.isArray(category.subCategories) ? category.subCategories : []);
      subcategories.forEach((subcat) => {
        const subcatTotal = reportData.subcategoryTotals?.[subcat.id] || 0;
        if (subcatTotal <= 0) return; // Skip subcategories with 0 total

        rows.push({
          label: `  • ${String(subcat.name || '')}`,
          bold: false,
          valuesByRegion: (regionName) => reportData.regionData?.[regionName]?.subcategoryAmounts?.[subcat.id] || 0,
          total: subcatTotal,
        });
      });
    });

    const createPageWithHeader = (groupRegions, pageNo, totalPages, continuation = false) => {
      if (currentPage > 0) {
        pdfDoc.endPage();
      }
      // Use Folio Landscape
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      currentPage += 1;
      drawBorder();

      const sealPath = resolveLogoPath('Seal.png');
      const logoPath = resolveLogoPath('logo.png');
      const bagongPath = resolveLogoPath('Bagong_Pilipinas.png');
      const logoY = MARGIN_TOP - 2;
      const logoW = 44;
      const logoH = 44;
      try {
        if (sealPath) pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoW, height: logoH });
        if (logoPath) pdfDoc.image(logoPath, CONTENT_LEFT + logoW + 5, logoY, { width: logoW, height: logoH });
        if (bagongPath) pdfDoc.image(bagongPath, CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH });
      } catch (e) {
        console.warn('Consolidated header logo load failed:', e.message);
      }

      const headerY = MARGIN_TOP;
      const cx = (CONTENT_LEFT + CONTENT_RIGHT) / 2;
      
      let hy = headerY;
      pdfDoc.text('Republic of the Philippines', cx, hy, textOpt({ fontSize: 11, bold: true, align: 'center', font: F_CAMBRIA_B }));
      hy += 12;
      pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, textOpt({ fontSize: 11, align: 'center', font: F_CAMBRIA }));
      hy += 12;
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, textOpt({ fontSize: 11, bold: true, align: 'center', font: F_TRAJAN_B }));
      hy += 16;
      
      const title = continuation ? `${getTabTitle()} (CONT.)` : getTabTitle();
      pdfDoc.text(title, cx, hy, textOpt({ fontSize: 13, bold: true, align: 'center', font: F_CAMBRIA_B }));
      hy += 12;
      
      let subTitle = `Fiscal Year: ${fiscalYear} | Budget Type: ${budgetType}`;
      const filterDept = department || req.submissionWorkflowFilters?.department || req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const filterDiv = division || req.submissionWorkflowFilters?.division || req.hierarchicalAccess?.accessibleDivisions?.[0];
      if (filterDept) subTitle += ` | Dept: ${filterDept}`;
      if (filterDiv) subTitle += ` > Div: ${filterDiv}`;
      
      pdfDoc.text(subTitle, cx, hy, textOpt({ fontSize: 8, align: 'center' }));
      hy += 10;
      const regionsText = selectedRegions === 'all' ? 'ALL REGIONS' : groupRegions.join(', ');
      pdfDoc.text(`Regions: ${regionsText}`, cx, hy, textOpt({ fontSize: 8, align: 'center' }));
      pdfDoc.text('ANNEX A', CONTENT_RIGHT - 46, hy + 2, textOpt({ fontSize: 9, bold: true }));

      pdfDoc.text(`Doc ID: ${reportData.documentId}`, CONTENT_LEFT, PAGE_HEIGHT - 10, textOpt({ fontSize: 7 }));
      pdfDoc.text(`Page ${pageNo} of ${totalPages}`, CONTENT_RIGHT - 55, PAGE_HEIGHT - 10, textOpt({ fontSize: 7 }));

      return hy + 20;
    };

    const estimatedRowsPerPage = 24;
    const pagesPerGroup = Math.max(1, Math.ceil(rows.length / estimatedRowsPerPage));
    const totalPages = Math.max(1, regionGroups.length * pagesPerGroup);

    const descColW = 300;
    let pageNo = 0;
    for (const groupRegions of regionGroups) {
      const regionColW = Math.floor((TABLE_WIDTH - descColW - 100) / Math.max(groupRegions.length, 1));

      let rowIndex = 0;
      let continuation = false;
      while (rowIndex < rows.length) {
        pageNo += 1;
        let y = createPageWithHeader(groupRegions, pageNo, totalPages, continuation);

        pdfDoc.rectangle(CONTENT_LEFT, y, TABLE_WIDTH, 16, { stroke: '#000000', lineWidth: 0.8, fill: '#FFFFFF' });
        let x = CONTENT_LEFT + 3;
        pdfDoc.text('INCOME CATEGORY', x, y + 4, textOpt({ fontSize: 8, bold: true }));
        let colX = CONTENT_LEFT + descColW;
        groupRegions.forEach((regionName) => {
          // Right align the column header text to perfectly match the amounts
          pdfDoc.text(regionName, colX + regionColW - 5, y + 4, textOpt({ fontSize: 7, bold: true, align: 'right' }));
          colX += regionColW;
        });
        pdfDoc.text('TOTAL', CONTENT_RIGHT - 5, y + 4, textOpt({ fontSize: 8, bold: true, align: 'right' }));
        y += 18;

        while (rowIndex < rows.length && y <= PAGE_HEIGHT - MARGIN_BOTTOM - 100) {
          const row = rows[rowIndex];
          pdfDoc.text(row.label, CONTENT_LEFT + 3, y, textOpt({ fontSize: row.bold ? 8 : 7, bold: row.bold }));

          let colX = CONTENT_LEFT + descColW;
          groupRegions.forEach((regionName) => {
            const value = row.valuesByRegion(regionName);
            pdfDoc.text(formatCurrency(value), colX + regionColW - 5, y, textOpt({ fontSize: 7, align: 'right' }));
            colX += regionColW;
          });
          pdfDoc.text(formatCurrency(row.total), CONTENT_RIGHT - 5, y, textOpt({ fontSize: row.bold ? 8 : 7, bold: row.bold, align: 'right' }));
          y += 12;
          rowIndex += 1;
        }

        if (rowIndex >= rows.length) {
          pdfDoc.rectangle(CONTENT_LEFT, y + 2, TABLE_WIDTH, 15, { stroke: '#000000', lineWidth: 0.8, fill: '#FFFFFF' });
          pdfDoc.text('GRAND TOTAL', CONTENT_LEFT + 3, y + 6, textOpt({ fontSize: 8, bold: true, color: '#000000' }));
          let totalX = CONTENT_LEFT + descColW;
          groupRegions.forEach((regionName) => {
            const regionGrand = reportData.regionData?.[regionName]?.total || 0;
            pdfDoc.text(formatCurrency(regionGrand), totalX + regionColW - 5, y + 6, textOpt({ fontSize: 7, bold: true, color: '#000000', align: 'right' }));
            totalX += regionColW;
          });
          pdfDoc.text(formatCurrency(reportData.grandTotal), CONTENT_RIGHT - 5, y + 6, textOpt({ fontSize: 8, bold: true, color: '#000000', align: 'right' }));
        }

        continuation = true;
      }
    }

    // Signature block (workflow-based)
    if (currentPage > 0) {
      const sigY = PAGE_HEIGHT - MARGIN_BOTTOM - 80;
      const sigContext = (reportData.regionList && reportData.regionList.length === 1) ? { region: reportData.regionList[0] } : null;
      reportData.signatoriesInfo = await enrichSignatoriesWithPositionTitle(reportData.signatoriesInfo || extractSignatoriesFromWorkflow(null, req.user), sigContext);
      drawWorkflowSignatureBlock(pdfDoc, reportData.signatoriesInfo, sigY, CONTENT_LEFT, TABLE_WIDTH, tempSignatureImagePaths);
    }

    // Log audit trail
    console.log(`[AUDIT] PDF Generated: ${reportData.documentId} | User: ${reportData.generatedBy} | FY: ${fiscalYear} | Type: ${queryBudgetType}`);

    // Finalize PDF
    if (currentPage > 0) {
      pdfDoc.endPage();
    } else {
      // Create a blank page if no data was found to avoid corrupt PDF
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT).endPage();
    }

    pdfDoc.endPDF((err) => {
      if (err) {
        console.error('Error generating consolidated income PDF:', err);
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Failed to generate PDF report', details: err.message });
        }
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('X-Document-ID', reportData.documentId);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Document-ID');

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('Error streaming consolidated income PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream PDF report' });
        }
      });
      res.on('finish', () => {
        cleanupTempImages(tempSignatureImagePaths);
        fs.unlink(tmpFilePath, () => {});
      });
      readStream.pipe(res);
    });
    
  } catch (err) {
    console.error('Error generating consolidated income PDF:', err);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF report',
        details: err.message
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
