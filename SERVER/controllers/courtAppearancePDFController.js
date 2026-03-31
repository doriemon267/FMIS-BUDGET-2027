const os = require('os');
const path = require('path');
const fs = require('fs'); // For Streaming
const fsPromises = require('fs').promises; // For Unlink
const MuhammaraRecipe = require('muhammara').Recipe;
const EmployeeCourtAppearance = require('../models/employeeCourtAppearance');

/**
 * Export Court Appearance Report as PDF
 * Uses Muhammara with Streaming - Full Detailed Layout
 */
exports.exportCourtAppearancePDF = async (req, res) => {
  const tmpFilePath = path.join(os.tmpdir(), `court-appearance-${Date.now()}.pdf`);
  
  try {
    const { filters = {} } = req.body;
    const query = { ...filters };
    
    // 1. Hierarchical Access Control (NIA Region X logic)
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
      }
    }
    
    const courtAppearanceData = await EmployeeCourtAppearance.find(query).sort({ employeeFullName: 1 }).lean();
    
    if (!courtAppearanceData || courtAppearanceData.length === 0) {
      return res.status(404).json({ message: 'No court appearance data found' });
    }

    // 2. Hierarchical Display String
    let hierarchicalDisplay = 'All Data';
    if (req.user) {
      const { assignmentLevel, hierarchicalAccess } = req.user;
      switch(assignmentLevel) {
        case 'DIVISION': hierarchicalDisplay = `Division: ${hierarchicalAccess.accessibleDivisions?.[0] || 'N/A'}`; break;
        case 'DEPARTMENT': hierarchicalDisplay = `Department: ${hierarchicalAccess.accessibleDepartments?.[0]?.departmentName || 'N/A'}`; break;
        case 'REGION': hierarchicalDisplay = `Region: ${hierarchicalAccess.accessibleRegions?.[0]?.regionName || 'N/A'}`; break;
        case 'FULL': hierarchicalDisplay = 'Full Access: All Data'; break;
      }
    }

    const grandTotal = courtAppearanceData.reduce((sum, item) => sum + (item.courtAppearanceAmount || 0), 0);
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath);
    const pageWidth = 842; 
    const pageHeight = 595;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;
    const lineHeight = 12;
    const rowHeight = 18;
    const footerHeight = 50;

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

    // --- Header Function ---
    function createPageHeader(isContinuation = false) {
      currentY = margin;
      const logoPath1 = path.join(__dirname, '../assets/nia_seal.png');
      const logoPath2 = path.join(__dirname, '../assets/nia-logo.png');
      const logoPath3 = path.join(__dirname, '../assets/bagong_pilipinas.png');
      const logoSize = 40;

      try { pdfDoc.image(logoPath1, margin, currentY, { width: logoSize, height: logoSize }); } catch (e) {}
      try { pdfDoc.image(logoPath3, pageWidth - margin - logoSize, currentY, { width: logoSize, height: logoSize }); } catch (e) {}
      try { pdfDoc.image(logoPath2, (pageWidth - logoSize) / 2, currentY, { width: logoSize, height: logoSize }); } catch (e) {}

      currentY += logoSize + 8;
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', pageWidth / 2, currentY, { fontSize: 13, bold: true, align: 'center', width: contentWidth });
      currentY += lineHeight;
      pdfDoc.text('COURT APPEARANCE REPORT', pageWidth / 2, currentY, { fontSize: 11, bold: true, align: 'center', width: contentWidth });
      currentY += lineHeight;
      pdfDoc.text(`As of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, currentY, { fontSize: 9, align: 'center', width: contentWidth });
      currentY += lineHeight;
      pdfDoc.text(hierarchicalDisplay, pageWidth / 2, currentY, { fontSize: 9, align: 'center', color: '#4a6741', width: contentWidth });
      currentY += lineHeight;
      pdfDoc.text('LEGAL SERVICES PERSONNEL ONLY', pageWidth / 2, currentY, { fontSize: 8, italic: true, align: 'center', color: '#4a6741', width: contentWidth });
      currentY += lineHeight + 5;
      
      if (isContinuation) {
        pdfDoc.text('(Continued)', pageWidth / 2, currentY, { fontSize: 9, italic: true, align: 'center', width: contentWidth });
        currentY += lineHeight;
      }
    }

    function drawTableHeader() {
      let currentX = margin;
      pdfDoc.rectangle(margin, currentY, contentWidth, rowHeight, { fill: '#4a6741', stroke: '#000000', lineWidth: 0.5 });
      columns.forEach(col => {
        pdfDoc.text(col.label, currentX + 3, currentY + 4, { fontSize: 8, bold: true, color: '#ffffff', width: col.width - 6, align: col.align });
        pdfDoc.line([[currentX, currentY], [currentX, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
        currentX += col.width;
      });
      pdfDoc.line([[currentX, currentY], [currentX, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
      currentY += rowHeight;
    }

    function ensureSpace(neededSpace) {
      if (currentY + neededSpace > pageHeight - footerHeight) {
        pdfDoc.endPage().createPage(pageWidth, pageHeight);
        createPageHeader(true);
        drawTableHeader();
      }
    }

    function drawDataRow(rowData, isEven) {
      let currentX = margin;
      if (isEven) pdfDoc.rectangle(margin, currentY, contentWidth, rowHeight, { fill: '#f5f5f5' });
      columns.forEach(col => {
        let val = rowData[col.field] || '';
        if (col.field === 'courtAppearanceAmount') val = `₱${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        else if (col.field === 'noOfCourtAppearance') val = (val || 0).toString();
        else val = String(val).substring(0, 50);

        pdfDoc.text(val, currentX + 3, currentY + 4, { fontSize: 7, width: col.width - 6, align: col.align });
        pdfDoc.line([[currentX, currentY], [currentX, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
        currentX += col.width;
      });
      pdfDoc.line([[currentX, currentY], [currentX, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
      pdfDoc.line([[margin, currentY + rowHeight], [margin + contentWidth, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
      currentY += rowHeight;
    }

    // --- Generation ---
    pdfDoc.createPage(pageWidth, pageHeight);
    createPageHeader();
    drawTableHeader();
    courtAppearanceData.forEach((row, index) => {
      ensureSpace(rowHeight * 2);
      drawDataRow(row, index % 2 === 0);
    });
    
    // Total Row
    ensureSpace(rowHeight * 2);
    let totalX = margin;
    pdfDoc.rectangle(margin, currentY, contentWidth, rowHeight, { fill: '#e0e0e0', stroke: '#000000', lineWidth: 0.5 });
    const labelW = columns.slice(0, 7).reduce((s, c) => s + c.width, 0);
    pdfDoc.text('GRAND TOTAL:', totalX + 3, currentY + 4, { fontSize: 8, bold: true, width: labelW - 6, align: 'right' });
    totalX += labelW;
    pdfDoc.line([[totalX, currentY], [totalX, currentY + rowHeight]], { stroke: '#000000', lineWidth: 0.5 });
    pdfDoc.text(`₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalX + 3, currentY + 4, { fontSize: 8, bold: true, width: columns[7].width - 6, align: 'right' });
    currentY += rowHeight + 10;

    // --- Original Detailed Footer ---
    ensureSpace(40);
    pdfDoc.text(`Total Records: ${courtAppearanceData.length}`, pageWidth / 2, currentY, { fontSize: 9, bold: true, align: 'center', width: contentWidth });
    currentY += lineHeight;
    pdfDoc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { fontSize: 8, italic: true, align: 'center', width: contentWidth });
    currentY += lineHeight;
    pdfDoc.text('This report shows court appearances for LEGAL SERVICES personnel only.', pageWidth / 2, currentY, { fontSize: 8, italic: true, align: 'center', color: '#4a6741', width: contentWidth });

    // Finalize
    pdfDoc.endPage().endPDF();

    // Send via Stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="court-appearance-report-${Date.now()}.pdf"`);
    const readStream = fs.createReadStream(tmpFilePath);
    readStream.pipe(res);
    readStream.on('end', async () => { try { await fsPromises.unlink(tmpFilePath); } catch (e) {} });

  } catch (error) {
    console.error('PDF Error:', error);
    try { await fsPromises.unlink(tmpFilePath); } catch (e) {}
    if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
};