const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const MuhammaraRecipe = require('muhammara').Recipe;
const EmployeeCourtAppearance = require('../models/employeeCourtAppearance');

/**
 * Export Court Appearance Report as PDF
 * Uses Muhammara for secure server-side PDF generation
 */
exports.exportCourtAppearancePDF = async (req, res) => {
  const tmpFilePath = path.join(os.tmpdir(), `court-appearance-${Date.now()}.pdf`);
  
  try {
    const { filters = {} } = req.body;
    
    // Build query based on user's hierarchical access
    const query = { ...filters };
    
    // Apply hierarchical access control
    if (req.user && req.user.hierarchicalAccess) {
      const { assignmentLevel, hierarchicalAccess } = req.user;
      
      switch(assignmentLevel) {
        case 'DIVISION':
          if (hierarchicalAccess.accessibleDivisions?.length > 0) {
            query.division = { $in: hierarchicalAccess.accessibleDivisions };
          }
          break;
        case 'DEPARTMENT':
          if (hierarchicalAccess.accessibleDepartments?.length > 0) {
            const deptNames = hierarchicalAccess.accessibleDepartments.map(d => d.departmentName);
            query.department = { $in: deptNames };
          }
          break;
        case 'REGION':
          if (hierarchicalAccess.accessibleRegions?.length > 0) {
            const regionNames = hierarchicalAccess.accessibleRegions.map(r => r.regionName);
            query.region = { $in: regionNames };
          }
          break;
        case 'FULL':
          // No additional filters for full access
          break;
      }
    }
    
    // Fetch data
    const courtAppearanceData = await EmployeeCourtAppearance.find(query)
      .sort({ employeeFullName: 1 })
      .lean();
    
    if (!courtAppearanceData || courtAppearanceData.length === 0) {
      return res.status(404).json({ message: 'No court appearance data found' });
    }

    // Get hierarchical display for header
    let hierarchicalDisplay = 'All Data';
    if (req.user) {
      const { assignmentLevel, hierarchicalAccess } = req.user;
      switch(assignmentLevel) {
        case 'DIVISION':
          hierarchicalDisplay = `Division: ${hierarchicalAccess.accessibleDivisions?.[0] || 'N/A'}`;
          break;
        case 'DEPARTMENT':
          hierarchicalDisplay = `Department: ${hierarchicalAccess.accessibleDepartments?.[0]?.departmentName || 'N/A'}`;
          break;
        case 'REGION':
          hierarchicalDisplay = `Region: ${hierarchicalAccess.accessibleRegions?.[0]?.regionName || 'N/A'}`;
          break;
        case 'FULL':
          hierarchicalDisplay = 'Full Access: All Data';
          break;
      }
    }

    // Calculate grand total
    const grandTotal = courtAppearanceData.reduce((sum, item) => sum + (item.courtAppearanceAmount || 0), 0);
    
    // Initialize PDF with Muhammara (landscape A4)
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath);
    const pageWidth = 842; // A4 landscape width
    const pageHeight = 595; // A4 landscape height
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    
    // Page management
    let currentY = margin;
    const lineHeight = 12;
    const rowHeight = 18;
    const headerHeight = 100;
    const footerHeight = 50;
    const availableHeight = pageHeight - headerHeight - footerHeight - margin;
    
    // Column configuration for Court Appearance Report
    const columns = [
      { field: 'employeeNumber', label: 'Employee #', width: 70, align: 'left' },
      { field: 'employeeFullName', label: 'Full Name', width: 120, align: 'left' },
      { field: 'positionTitle', label: 'Position', width: 100, align: 'left' },
      { field: 'department', label: 'Department', width: 90, align: 'left' },
      { field: 'division', label: 'Division', width: 90, align: 'left' },
      { field: 'region', label: 'Region', width: 80, align: 'left' },
      { field: 'noOfCourtAppearance', label: 'No. of Appearances', width: 80, align: 'right' },
      { field: 'courtAppearanceAmount', label: 'Amount (₱)', width: 100, align: 'right' }
    ];
    
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const scaleFactor = contentWidth / totalWidth;
    columns.forEach(col => col.width *= scaleFactor);

    /**
     * Create page header with Annex A format (3 logos)
     */
    function createPageHeader(isFirstPage = true, isContinuation = false) {
      currentY = margin;
      
      // Logo paths
      const logoPath1 = path.join(__dirname, '../assets/nia_seal.png');
      const logoPath2 = path.join(__dirname, '../assets/nia-logo.png');
      const logoPath3 = path.join(__dirname, '../assets/bagong_pilipinas.png');
      const logoSize = 40;
      const logoY = currentY;
      
      // Left logo (NIA Seal)
      try {
        pdfDoc.image(logoPath1, margin, logoY, { width: logoSize, height: logoSize });
      } catch (err) {
        console.warn('Left logo not found:', err.message);
      }
      
      // Right logo (Bagong Pilipinas)
      try {
        pdfDoc.image(logoPath3, pageWidth - margin - logoSize, logoY, { width: logoSize, height: logoSize });
      } catch (err) {
        console.warn('Right logo not found:', err.message);
      }
      
      // Center logo (NIA Logo)
      const centerX = (pageWidth - logoSize) / 2;
      try {
        pdfDoc.image(logoPath2, centerX, logoY, { width: logoSize, height: logoSize });
      } catch (err) {
        console.warn('Center logo not found:', err.message);
      }
      
      currentY += logoSize + 8;
      
      // Header text
      pdfDoc
        .text('NATIONAL IRRIGATION ADMINISTRATION', pageWidth / 2, currentY, {
          fontSize: 13,
          bold: true,
          align: 'center',
          width: contentWidth
        });
      currentY += lineHeight;
      
      pdfDoc
        .text('COURT APPEARANCE REPORT', pageWidth / 2, currentY, {
          fontSize: 11,
          bold: true,
          align: 'center',
          width: contentWidth
        });
      currentY += lineHeight;
      
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      pdfDoc
        .text(`As of ${currentDate}`, pageWidth / 2, currentY, {
          fontSize: 9,
          align: 'center',
          width: contentWidth
        });
      currentY += lineHeight;
      
      pdfDoc
        .text(hierarchicalDisplay, pageWidth / 2, currentY, {
          fontSize: 9,
          align: 'center',
          color: '#4a6741',
          width: contentWidth
        });
      currentY += lineHeight;
      
      pdfDoc
        .text('LEGAL SERVICES PERSONNEL ONLY', pageWidth / 2, currentY, {
          fontSize: 8,
          italic: true,
          align: 'center',
          color: '#4a6741',
          width: contentWidth
        });
      currentY += lineHeight + 5;
      
      if (isContinuation) {
        pdfDoc
          .text('(Continued)', pageWidth / 2, currentY, {
            fontSize: 9,
            italic: true,
            align: 'center',
            width: contentWidth
          });
        currentY += lineHeight;
      }
    }

    /**
     * Draw table header
     */
    function drawTableHeader() {
      let currentX = margin;
      
      // Header background
      pdfDoc
        .rectangle(margin, currentY, contentWidth, rowHeight, { 
          fill: '#4a6741',
          stroke: '#000000',
          lineWidth: 0.5
        });
      
      // Header text
      columns.forEach(col => {
        pdfDoc
          .text(col.label, currentX + 3, currentY + 4, {
            fontSize: 8,
            bold: true,
            color: '#ffffff',
            width: col.width - 6,
            align: col.align
          });
        
        // Vertical line
        pdfDoc
          .line([
            [currentX, currentY],
            [currentX, currentY + rowHeight]
          ], { stroke: '#000000', lineWidth: 0.5 });
        
        currentX += col.width;
      });
      
      // Final vertical line
      pdfDoc
        .line([
          [currentX, currentY],
          [currentX, currentY + rowHeight]
        ], { stroke: '#000000', lineWidth: 0.5 });
      
      currentY += rowHeight;
    }

    /**
     * Ensure enough space for a row, start new page if needed
     */
    function ensureSpace(neededSpace) {
      if (currentY + neededSpace > pageHeight - footerHeight) {
        pdfDoc.endPage();
        pdfDoc.createPage(pageWidth, pageHeight);
        createPageHeader(false, true);
        drawTableHeader();
      }
    }

    /**
     * Draw data row
     */
    function drawDataRow(rowData, isEven) {
      let currentX = margin;
      
      // Alternating row colors
      if (isEven) {
        pdfDoc
          .rectangle(margin, currentY, contentWidth, rowHeight, { 
            fill: '#f5f5f5'
          });
      }
      
      // Row cells
      columns.forEach(col => {
        let cellValue = rowData[col.field] || '';
        
        if (col.field === 'courtAppearanceAmount') {
          cellValue = `₱${(rowData[col.field] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (col.field === 'noOfCourtAppearance') {
          cellValue = (rowData[col.field] || 0).toString();
        } else {
          cellValue = String(cellValue).substring(0, 50); // Truncate long text
        }
        
        pdfDoc
          .text(cellValue, currentX + 3, currentY + 4, {
            fontSize: 7,
            width: col.width - 6,
            align: col.align
          });
        
        // Vertical line
        pdfDoc
          .line([
            [currentX, currentY],
            [currentX, currentY + rowHeight]
          ], { stroke: '#000000', lineWidth: 0.5 });
        
        currentX += col.width;
      });
      
      // Final vertical line
      pdfDoc
        .line([
          [currentX, currentY],
          [currentX, currentY + rowHeight]
        ], { stroke: '#000000', lineWidth: 0.5 });
      
      // Bottom border
      pdfDoc
        .line([
          [margin, currentY + rowHeight],
          [margin + contentWidth, currentY + rowHeight]
        ], { stroke: '#000000', lineWidth: 0.5 });
      
      currentY += rowHeight;
    }

    /**
     * Draw total row
     */
    function drawTotalRow(total) {
      let currentX = margin;
      
      // Total row background
      pdfDoc
        .rectangle(margin, currentY, contentWidth, rowHeight, { 
          fill: '#e0e0e0',
          stroke: '#000000',
          lineWidth: 0.5
        });
      
      // "GRAND TOTAL:" label (spans first 7 columns)
      const labelWidth = columns.slice(0, 7).reduce((sum, col) => sum + col.width, 0);
      pdfDoc
        .text('GRAND TOTAL:', currentX + 3, currentY + 4, {
          fontSize: 8,
          bold: true,
          width: labelWidth - 6,
          align: 'right'
        });
      
      currentX += labelWidth;
      
      // Vertical line before total amount
      pdfDoc
        .line([
          [currentX, currentY],
          [currentX, currentY + rowHeight]
        ], { stroke: '#000000', lineWidth: 0.5 });
      
      // Total amount
      const totalAmount = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      pdfDoc
        .text(totalAmount, currentX + 3, currentY + 4, {
          fontSize: 8,
          bold: true,
          width: columns[7].width - 6,
          align: 'right'
        });
      
      currentX += columns[7].width;
      
      // Final vertical line
      pdfDoc
        .line([
          [currentX, currentY],
          [currentX, currentY + rowHeight]
        ], { stroke: '#000000', lineWidth: 0.5 });
      
      currentY += rowHeight;
    }

    // Start first page
    pdfDoc.createPage(pageWidth, pageHeight);
    createPageHeader(true, false);
    drawTableHeader();
    
    // Draw data rows
    courtAppearanceData.forEach((row, index) => {
      ensureSpace(rowHeight * 2); // Ensure space for row + potential total
      drawDataRow(row, index % 2 === 0);
    });
    
    // Draw total row
    ensureSpace(rowHeight * 2);
    drawTotalRow(grandTotal);
    
    // Footer info
    currentY += 10;
    if (currentY + 30 > pageHeight - margin) {
      pdfDoc.endPage();
      pdfDoc.createPage(pageWidth, pageHeight);
      createPageHeader(false, true);
      currentY = headerHeight + 20;
    }
    
    pdfDoc
      .text(`Total Records: ${courtAppearanceData.length}`, pageWidth / 2, currentY, {
        fontSize: 9,
        bold: true,
        align: 'center',
        width: contentWidth
      });
    currentY += lineHeight;
    
    pdfDoc
      .text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, {
        fontSize: 8,
        italic: true,
        align: 'center',
        width: contentWidth
      });
    currentY += lineHeight;
    
    pdfDoc
      .text('This report shows court appearances for LEGAL SERVICES personnel only.', pageWidth / 2, currentY, {
        fontSize: 8,
        italic: true,
        align: 'center',
        color: '#4a6741',
        width: contentWidth
      });
    
    // Finalize PDF
    pdfDoc.endPage().endPDF();
    
    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="court-appearance-report-${Date.now()}.pdf"`);
    
    const fileBuffer = await fs.readFile(tmpFilePath);
    res.send(fileBuffer);
    
    // Clean up temp file
    await fs.unlink(tmpFilePath);
    
  } catch (error) {
    console.error('Error generating court appearance PDF:', error);
    
    // Clean up temp file on error
    try {
      await fs.unlink(tmpFilePath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }
    
    res.status(500).json({ 
      message: 'Error generating PDF', 
      error: error.message 
    });
  }
};
