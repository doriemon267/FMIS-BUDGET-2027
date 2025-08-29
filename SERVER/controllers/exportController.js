const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Import models for data fetching
const PersonnelServices = require('../models/PersonnelServices');
const COSPersonnel = require('../models/COSPersonnel');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');

// Export Budget Summary as PDF
const exportBudgetSummaryPDF = async (req, res) => {
  try {
    console.log('Starting PDF export...');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request query:', req.query);
    
    const { 
      fiscalYear, 
      budgetType, 
      region, 
      dataCounts,
      budgetSummary 
    } = req.body;

    console.log('Extracted parameters:', {
      fiscalYear,
      budgetType,
      region,
      dataCounts,
      budgetSummary: budgetSummary ? Object.keys(budgetSummary) : 'undefined'
    });

    // Fetch actual data from database instead of receiving in payload
    const [personnelData, cosPersonnelData, mooeData, capitalOutlayData, incomeData] = await Promise.all([
      PersonnelServices.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      
      COSPersonnel.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      
      MooeProposal.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status amount subsidy region fiscalYear itemName category').lean(),
      
      CapitalOutlay.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status cost subsidy region fiscalYear itemDescription category').lean(),
      
      Income.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status amount region fiscalYear category subcategory').lean()
    ]);

    // Log data for debugging
    console.log('Database query results:');
    console.log('Personnel data count:', personnelData ? personnelData.length : 0);
    console.log('COS Personnel data count:', cosPersonnelData ? cosPersonnelData.length : 0);
    console.log('MOOE data count:', mooeData ? mooeData.length : 0);
    console.log('Capital Outlay data count:', capitalOutlayData ? capitalOutlayData.length : 0);
    console.log('Income data count:', incomeData ? incomeData.length : 0);
    
    // Sample data for debugging
    if (personnelData && personnelData.length > 0) {
      console.log('Sample personnel data:', personnelData[0]);
    }
    if (mooeData && mooeData.length > 0) {
      console.log('Sample MOOE data:', mooeData[0]);
    }
    console.log(`🔍 PDF Export Debug for ${region}, FY ${fiscalYear}:`);
    console.log(`📊 Personnel Data: ${personnelData.length} records`);
    console.log(`👥 COS Personnel Data: ${cosPersonnelData.length} records`);
    console.log(`🛠️ MOOE Data: ${mooeData.length} records`);
    console.log(`🏗️ Capital Outlay Data: ${capitalOutlayData.length} records`);
    console.log(`💰 Income Data: ${incomeData.length} records`);
    console.log(`📋 Budget Summary:`, budgetSummary);

    // Combine personnel data
    const allPersonnelData = [...personnelData, ...cosPersonnelData];

    // Create PDF document with better page setup
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      layout: 'portrait'
    });
    const filename = `Budget_Summary_${fiscalYear}_${region}.pdf`;

    // Set response headers
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function for clean currency formatting (no +- signs)
    const formatCurrency = (amount) => {
      // Handle string values that might have currency symbols or signs
      let cleanValue = amount;
      if (typeof amount === 'string') {
        // Remove currency symbols, commas, and any +/- signs
        cleanValue = amount.replace(/[₱$,+\-\s]/g, '');
      }
      
      const numericValue = Math.abs(Number(cleanValue) || 0);
      return `₱${numericValue.toLocaleString('en-PH', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })}`;
    };

    // Clean budget summary values to remove any +/- signs
    const cleanBudgetSummary = {
      personnelTotal: formatCurrency(budgetSummary.personnelTotal || 0),
      mooeTotal: formatCurrency(budgetSummary.mooeTotal || 0),
      capitalOutlayTotal: formatCurrency(budgetSummary.capitalOutlayTotal || 0),
      budgetarySupportTotal: formatCurrency(budgetSummary.budgetarySupportTotal || 0),
      incomeTotal: formatCurrency(budgetSummary.incomeTotal || 0),
      combinedIncomeTotal: formatCurrency(budgetSummary.combinedIncomeTotal || budgetSummary.incomeTotal || 0),
      isIncomeBalanced: budgetSummary.isIncomeBalanced
    };

    // Calculate clean grand total
    const grandTotalValue = (Number(String(budgetSummary.personnelTotal || 0).replace(/[₱$,+\-\s]/g, '')) || 0) + 
                           (Number(String(budgetSummary.mooeTotal || 0).replace(/[₱$,+\-\s]/g, '')) || 0) + 
                           (Number(String(budgetSummary.capitalOutlayTotal || 0).replace(/[₱$,+\-\s]/g, '')) || 0) + 
                           (Number(String(budgetSummary.budgetarySupportTotal || 0).replace(/[₱$,+\-\s]/g, '')) || 0);
    
    const cleanGrandTotal = formatCurrency(grandTotalValue);

    // Helper function to draw tables
    const drawTable = (startX, startY, headers, rows, columnWidths) => {
      const rowHeight = 25;
      const headerHeight = 30;
      let currentY = startY;

      // Draw header
      doc.rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), headerHeight)
         .fillAndStroke('#4472C4', '#000000');
      
      doc.fillColor('white')
         .fontSize(10)
         .font('Helvetica-Bold');

      let currentX = startX;
      headers.forEach((header, i) => {
        doc.text(header, currentX + 5, currentY + 8, {
          width: columnWidths[i] - 10,
          align: 'center'
        });
        currentX += columnWidths[i];
      });

      currentY += headerHeight;

      // Draw rows
      doc.fillColor('black').font('Helvetica');
      rows.forEach((row, rowIndex) => {
        const fillColor = rowIndex % 2 === 0 ? '#F2F2F2' : 'white';
        doc.rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
           .fill(fillColor);

        currentX = startX;
        row.forEach((cell, cellIndex) => {
          const isNumeric = cellIndex > 0 && typeof cell === 'string' && cell.includes('₱');
          doc.text(String(cell), currentX + 5, currentY + 6, {
            width: columnWidths[cellIndex] - 10,
            align: isNumeric ? 'right' : 'left'
          });
          currentX += columnWidths[cellIndex];
        });
        currentY += rowHeight;
      });

      // Draw table borders
      doc.strokeColor('#000000').lineWidth(1);
      for (let i = 0; i <= headers.length; i++) {
        const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.moveTo(x, startY)
           .lineTo(x, currentY)
           .stroke();
      }
      
      for (let i = 0; i <= rows.length + 1; i++) {
        const y = startY + (i === 0 ? 0 : headerHeight + (i - 1) * rowHeight);
        doc.moveTo(startX, y)
           .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y)
           .stroke();
      }

      return currentY + 10;
    };

    // PDF Header with Logo Space
    doc.fillColor('#1f4e79')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('BUDGET PROPOSAL SUMMARY', { align: 'center' });
    
    doc.fillColor('#666666')
       .fontSize(12)
       .font('Helvetica')
       .moveDown(0.5);
       
    doc.text(`Fiscal Year: ${fiscalYear}`, { align: 'center' });
    doc.text(`Budget Type: ${budgetType}`, { align: 'center' });
    doc.text(`Region: ${region}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, { align: 'center' });

    doc.moveDown(2);

    // Budget Overview Table
    doc.fillColor('#1f4e79')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('BUDGET OVERVIEW');
    
    doc.moveDown(1);

    const budgetHeaders = ['Category', 'Amount'];
    const budgetRows = [
      ['Personnel Services', cleanBudgetSummary.personnelTotal],
      ['Maintenance & Other Operating Expenses', cleanBudgetSummary.mooeTotal],
      ['Capital Outlay', cleanBudgetSummary.capitalOutlayTotal],
      ['Budgetary Support', cleanBudgetSummary.budgetarySupportTotal]
    ];

    let currentY = drawTable(50, doc.y, budgetHeaders, budgetRows, [300, 200]);

    // Grand Total Row (highlighted)
    doc.rect(50, currentY, 500, 35).fillAndStroke('#1f4e79', '#000000');
    doc.fillColor('white')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('GRAND TOTAL', 55, currentY + 10)
       .text(cleanGrandTotal, 355, currentY + 10, { 
         width: 190, 
         align: 'right' 
       });

    currentY += 50;

    // Income Summary Table
    doc.fillColor('#1f4e79')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('INCOME SUMMARY', 50, currentY);

    currentY += 30;

    const incomeHeaders = ['Type', 'Amount', 'Status'];
    const incomeRows = [
      ['Corporate Income', cleanBudgetSummary.incomeTotal, ''],
      ['Combined Income Total', cleanBudgetSummary.combinedIncomeTotal, ''],
      ['Balance Status', '', budgetSummary.isIncomeBalanced ? 'BALANCED ✓' : 'UNBALANCED ✗']
    ];

    currentY = drawTable(50, currentY, incomeHeaders, incomeRows, [200, 150, 150]);

    // Add new page for detailed breakdown
    doc.addPage();
    
    doc.fillColor('#1f4e79')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('DETAILED BREAKDOWN', { align: 'center' });
    
    doc.moveDown(1);

    let detailY = doc.y;

    // Personnel Services Summary Table
    doc.fillColor('#1f4e79')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Personnel Services Summary', 50, detailY);

    detailY += 25;

    if (allPersonnelData && allPersonnelData.length > 0) {
      const statusCounts = {};
      let totalPersonnelAmount = 0;
      
      allPersonnelData.forEach(item => {
        const status = item.status || 'Not Submitted';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        totalPersonnelAmount += Number(item.Total || 0);
      });

      const personnelHeaders = ['Status', 'Count', 'Percentage'];
      const personnelRows = Object.entries(statusCounts).map(([status, count]) => [
        status,
        count.toString(),
        `${((count / allPersonnelData.length) * 100).toFixed(1)}%`
      ]);

      detailY = drawTable(50, detailY, personnelHeaders, personnelRows, [200, 100, 100]);
    } else {
      // Fallback when no data
      const personnelHeaders = ['Status', 'Count', 'Percentage'];
      const personnelRows = [['No data available', '0', '0%']];
      detailY = drawTable(50, detailY, personnelHeaders, personnelRows, [200, 100, 100]);
    }
    detailY += 20;

    // MOOE Summary Table
    doc.fillColor('#1f4e79')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('MOOE Summary', 50, detailY);

    detailY += 25;

    if (mooeData && mooeData.length > 0) {
      const statusCounts = {};
      let totalMooeAmount = 0;
      
      mooeData.forEach(item => {
        const status = item.status || 'Not Submitted';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        totalMooeAmount += Number(item.amount || 0);
      });

      const mooeHeaders = ['Status', 'Count', 'Percentage'];
      const mooeRows = Object.entries(statusCounts).map(([status, count]) => [
        status,
        count.toString(),
        `${((count / mooeData.length) * 100).toFixed(1)}%`
      ]);

      detailY = drawTable(50, detailY, mooeHeaders, mooeRows, [200, 100, 100]);
    } else {
      // Fallback when no data
      const mooeHeaders = ['Status', 'Count', 'Percentage'];
      const mooeRows = [['No data available', '0', '0%']];
      detailY = drawTable(50, detailY, mooeHeaders, mooeRows, [200, 100, 100]);
    }
    detailY += 20;

    // Capital Outlay Summary Table
    doc.fillColor('#1f4e79')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Capital Outlay Summary', 50, detailY);

    detailY += 25;

    if (capitalOutlayData && capitalOutlayData.length > 0) {
      const statusCounts = {};
      let totalCapitalAmount = 0;
      
      capitalOutlayData.forEach(item => {
        const status = item.status || 'Not Submitted';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        totalCapitalAmount += Number(item.cost || 0);
      });

      const capitalHeaders = ['Status', 'Count', 'Percentage'];
      const capitalRows = Object.entries(statusCounts).map(([status, count]) => [
        status,
        count.toString(),
        `${((count / capitalOutlayData.length) * 100).toFixed(1)}%`
      ]);

      detailY = drawTable(50, detailY, capitalHeaders, capitalRows, [200, 100, 100]);
    } else {
      // Fallback when no data
      const capitalHeaders = ['Status', 'Count', 'Percentage'];
      const capitalRows = [['No data available', '0', '0%']];
      detailY = drawTable(50, detailY, capitalHeaders, capitalRows, [200, 100, 100]);
    }
    detailY += 20;

    // Income Summary Table
    doc.fillColor('#1f4e79')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Income Summary', 50, detailY);

    detailY += 25;

    if (incomeData && incomeData.length > 0) {
      const statusCounts = {};
      let totalIncomeAmount = 0;
      
      incomeData.forEach(item => {
        const status = item.status || 'Not Submitted';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        totalIncomeAmount += Number(item.amount || 0);
      });

      const incomeHeaders = ['Status', 'Count', 'Percentage'];
      const incomeRows = Object.entries(statusCounts).map(([status, count]) => [
        status,
        count.toString(),
        `${((count / incomeData.length) * 100).toFixed(1)}%`
      ]);

      detailY = drawTable(50, detailY, incomeHeaders, incomeRows, [200, 100, 100]);
    } else {
      // Fallback when no data
      const incomeHeaders = ['Status', 'Count', 'Percentage'];
      const incomeRows = [['No data available', '0', '0%']];
      detailY = drawTable(50, detailY, incomeHeaders, incomeRows, [200, 100, 100]);
    }

    // Professional Footer
    const footerY = doc.page.height - 60;
    doc.fillColor('#666666')
       .fontSize(8)
       .font('Helvetica')
       .text('Generated by Financial Management Information System (FMIS)', 50, footerY, { align: 'center' })
       .text(`Report generated on ${new Date().toLocaleString('en-PH')}`, 50, footerY + 12, { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('PDF Export Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF report',
      details: error.message 
    });
  }
};

// Export Budget Summary as Excel
const exportBudgetSummaryExcel = async (req, res) => {
  try {
    const { 
      fiscalYear, 
      budgetType, 
      region, 
      dataCounts,
      budgetSummary 
    } = req.body;

    // Fetch actual data from database instead of receiving in payload
    const [personnelData, cosPersonnelData, mooeData, capitalOutlayData, incomeData] = await Promise.all([
      PersonnelServices.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      
      COSPersonnel.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      
      MooeProposal.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status amount subsidy region fiscalYear itemName category').lean(),
      
      CapitalOutlay.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status cost subsidy region fiscalYear itemDescription category').lean(),
      
      Income.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(region, 'i') } 
      }).select('_id status amount region fiscalYear category subcategory').lean()
    ]);

    // Combine personnel data
    const allPersonnelData = [...personnelData, ...cosPersonnelData];

    // Helper function for clean currency formatting (no +- signs)
    const formatExcelCurrency = (amount) => {
      return Math.abs(Number(amount) || 0);
    };

    // Create workbook with metadata
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FMIS Budget System';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Summary worksheet with professional styling
    const summarySheet = workbook.addWorksheet('Budget Summary');
    
    // Set column widths
    summarySheet.columns = [
      { width: 30 },
      { width: 20 },
      { width: 15 }
    ];

    // Title and Header Section
    summarySheet.mergeCells('A1:C1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'BUDGET PROPOSAL SUMMARY';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    // Metadata rows
    summarySheet.addRow([]);
    summarySheet.addRow([`Fiscal Year:`, fiscalYear]);
    summarySheet.addRow([`Budget Type:`, budgetType]);
    summarySheet.addRow([`Region:`, region]);
    summarySheet.addRow([`Generated:`, new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })]);
    summarySheet.addRow([]); // Empty row

    // Budget Overview Section
    const overviewHeaderRow = summarySheet.addRow(['BUDGET OVERVIEW']);
    summarySheet.mergeCells(`A${overviewHeaderRow.number}:C${overviewHeaderRow.number}`);
    overviewHeaderRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    overviewHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F3FF' } };

    // Budget table headers
    const budgetHeaderRow = summarySheet.addRow(['Category', 'Amount', '']);
    budgetHeaderRow.font = { bold: true };
    budgetHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    budgetHeaderRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    budgetHeaderRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Budget data rows
    summarySheet.addRow(['Personnel Services', formatExcelCurrency(budgetSummary.personnelTotal)]);
    summarySheet.addRow(['Maintenance & Other Operating Expenses', formatExcelCurrency(budgetSummary.mooeTotal)]);
    summarySheet.addRow(['Capital Outlay', formatExcelCurrency(budgetSummary.capitalOutlayTotal)]);
    summarySheet.addRow(['Budgetary Support', formatExcelCurrency(budgetSummary.budgetarySupportTotal)]);
    
    // Grand total row
    const grandTotalRow = summarySheet.addRow(['GRAND TOTAL', 
      formatExcelCurrency(
        (budgetSummary.personnelTotal || 0) + 
        (budgetSummary.mooeTotal || 0) + 
        (budgetSummary.capitalOutlayTotal || 0) + 
        (budgetSummary.budgetarySupportTotal || 0)
      )
    ]);
    grandTotalRow.font = { bold: true };
    grandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    grandTotalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    grandTotalRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    summarySheet.addRow([]); // Empty row

    // Income Summary Section
    const incomeHeaderRow = summarySheet.addRow(['INCOME SUMMARY']);
    summarySheet.mergeCells(`A${incomeHeaderRow.number}:C${incomeHeaderRow.number}`);
    incomeHeaderRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    incomeHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F3FF' } };

    // Income table headers
    const incomeTableHeaderRow = summarySheet.addRow(['Type', 'Amount', 'Status']);
    incomeTableHeaderRow.font = { bold: true };
    incomeTableHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    incomeTableHeaderRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    incomeTableHeaderRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    incomeTableHeaderRow.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Income data rows
    summarySheet.addRow(['Corporate Income', formatExcelCurrency(budgetSummary.incomeTotal)]);
    summarySheet.addRow(['Combined Income Total', formatExcelCurrency(budgetSummary.combinedIncomeTotal || budgetSummary.incomeTotal)]);
    const balanceRow = summarySheet.addRow(['Balance Status', '', budgetSummary.isIncomeBalanced ? 'BALANCED ✓' : 'UNBALANCED ✗']);
    balanceRow.getCell(3).font = { 
      bold: true, 
      color: { argb: budgetSummary.isIncomeBalanced ? 'FF008000' : 'FFFF0000' } 
    };

    // Format currency columns
    const currencyFormat = '"₱"#,##0.00';
    summarySheet.getColumn(2).numFmt = currencyFormat;

    // Style headers
    summarySheet.getRow(1).font = { bold: true, size: 16 };
    summarySheet.getRow(7).font = { bold: true, size: 14 };
    summarySheet.getRow(8).font = { bold: true };
    summarySheet.getRow(15).font = { bold: true, size: 14 };
    summarySheet.getRow(16).font = { bold: true };

    // Personnel Data Sheet
    if (allPersonnelData && allPersonnelData.length > 0) {
      const personnelSheet = workbook.addWorksheet('Personnel Services');
      const headers = ['Employee Name', 'Position', 'Status', 'Annual Salary', 'Total Benefits', 'Region', 'Fiscal Year'];
      personnelSheet.addRow(headers);
      
      allPersonnelData.forEach(item => {
        personnelSheet.addRow([
          item.employeeName || '',
          item.positionTitle || '',
          item.status || 'Not Submitted',
          item.annualSalary || 0,
          item.Total || 0,
          item.region || '',
          item.fiscalYear || ''
        ]);
      });
      
      // Format headers
      personnelSheet.getRow(1).font = { bold: true };
      personnelSheet.getColumn(4).numFmt = currencyFormat;
      personnelSheet.getColumn(5).numFmt = currencyFormat;
    }

    // MOOE Data Sheet
    if (mooeData && mooeData.length > 0) {
      const mooeSheet = workbook.addWorksheet('MOOE');
      const headers = ['Accounting Title', 'Subline Item', 'Status', 'Amount', 'Subsidy', 'Region', 'Fiscal Year'];
      mooeSheet.addRow(headers);
      
      mooeData.forEach(item => {
        mooeSheet.addRow([
          item.accountingTitle || '',
          item.itemName || '',
          item.status || 'Not Submitted',
          item.amount || 0,
          item.subsidy || 0,
          item.region || '',
          item.fiscalYear || ''
        ]);
      });
      
      mooeSheet.getRow(1).font = { bold: true };
      mooeSheet.getColumn(4).numFmt = currencyFormat;
      mooeSheet.getColumn(5).numFmt = currencyFormat;
    }

    // Capital Outlay Data Sheet
    if (capitalOutlayData && capitalOutlayData.length > 0) {
      const capitalSheet = workbook.addWorksheet('Capital Outlay');
      const headers = ['Accounting Title', 'Description', 'Status', 'Cost', 'Subsidy', 'Region', 'Fiscal Year'];
      capitalSheet.addRow(headers);
      
      capitalOutlayData.forEach(item => {
        capitalSheet.addRow([
          item.accountingTitle || '',
          item.itemDescription || '',
          item.status || 'Not Submitted',
          item.cost || 0,
          item.subsidy || 0,
          item.region || '',
          item.fiscalYear || ''
        ]);
      });
      
      capitalSheet.getRow(1).font = { bold: true };
      capitalSheet.getColumn(4).numFmt = currencyFormat;
      capitalSheet.getColumn(5).numFmt = currencyFormat;
    }

    // Set response headers
    const filename = `Budget_Summary_${fiscalYear}_${region}.xlsx`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate Excel report',
      details: error.message 
    });
  }
};

module.exports = {
  exportBudgetSummaryPDF,
  exportBudgetSummaryExcel
};
