const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}
// Import models for data fetching
const PersonnelServices = require('../models/PersonnelServices');
const COSPersonnel = require('../models/COSPersonnel');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const { extractSignatoriesFromWorkflow, drawWorkflowSignatureBlock, cleanupTempImages, enrichSignatoriesWithPositionTitle } = require('../utils/pdfSignatureHelper');
// Export Budget Summary as PDF
const exportBudgetSummaryPDF = async (req, res) => {
  try {
    if (!MuhammaraRecipe) {
      return res.status(500).json({
        error: 'PDF generation library (muhammara) is not installed on the server.'
      });
    }

    const { 
      fiscalYear, 
      budgetType, 
      region, 
      dataCounts,
      budgetSummary 
    } = req.body;
    // Apply hierarchical filters
    let queryRegion = region;
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      queryRegion = req.hierarchicalFilters.region;
    }
    // Fetch actual data from database instead of receiving in payload
    const [personnelData, cosPersonnelData, mooeData, capitalOutlayData, incomeData] = await Promise.all([
      PersonnelServices.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      COSPersonnel.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      MooeProposal.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status amount subsidy region fiscalYear itemName category').lean(),
      CapitalOutlay.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status cost subsidy region fiscalYear itemDescription category').lean(),
      Income.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status amount region fiscalYear category subcategory').lean()
    ]);
    // Log data for debugging
    // Sample data for debugging
    if (personnelData && personnelData.length > 0) {
      }
    if (mooeData && mooeData.length > 0) {
      }

    // Combine personnel data
    const allPersonnelData = [...personnelData, ...cosPersonnelData];

    const filename = `Budget_Summary_${fiscalYear}_${region}.pdf`;

    const tmpFilePath = path.join(os.tmpdir(), `budget_summary_${Date.now()}.pdf`);
    const tempSignatureImagePaths = [];
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Budget Proposal Summary',
      subject: 'Budget Proposal Summary Report',
    });

    const PAGE_WIDTH = 576;
    const PAGE_HEIGHT = 936;
    const MARGIN = 40;
    const MARGIN_TOP = 50;
    const MARGIN_BOTTOM = 60;
    const LINE_HEIGHT = 13;
    const CONTENT_LEFT = MARGIN + 10;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN - 10;
    const CENTER_X = PAGE_WIDTH / 2;

    let currentY = MARGIN_TOP;
    let currentPage = 1;

    const textOpt = (opts = {}) => ({ color: '#000000', ...opts });
    const drawBorder = () => {
      pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, {
        stroke: '#000000',
        lineWidth: 1.2
      });
    };
    const drawFooter = () => {
      pdfDoc.text('Budget Summary Report', CONTENT_LEFT, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Page ${currentPage}`, CONTENT_RIGHT - 45, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
    };
    const ensureSpace = (lines = 1) => {
      if (currentY + (lines * LINE_HEIGHT) > PAGE_HEIGHT - MARGIN_BOTTOM) {
        drawFooter();
        pdfDoc.endPage();
        pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        currentPage += 1;
        currentY = MARGIN_TOP;
        drawBorder();
      }
    };
    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';

    const resolveLogoPath = (name) => {
      const serverAsset = path.join(__dirname, `../assets/${name}`);
      if (fs.existsSync(serverAsset)) return serverAsset;
      const clientAsset = path.join(__dirname, `../../CLIENT/public/${name}`);
      if (fs.existsSync(clientAsset)) return clientAsset;
      return null;
    };

    const drawHeader = () => {
      const sealPath = resolveLogoPath('Seal.png');
      const logoPath = resolveLogoPath('logo.png');
      const bagongPath = resolveLogoPath('Bagong_Pilipinas.png');
      const logoY = currentY + 3;
      const logoW = 36;
      const logoH = 36;

      try {
        if (sealPath) pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoW, height: logoH });
        if (logoPath) pdfDoc.image(logoPath, CONTENT_LEFT + 40, logoY, { width: logoW, height: logoH });
        if (bagongPath) pdfDoc.image(bagongPath, CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH });
      } catch (e) {
        console.warn('Header logo load failed:', e.message);
      }

      const headerY = currentY + 4;
      pdfDoc.text('Republic of the Philippines', CENTER_X, headerY, textOpt({ fontSize: 9, align: 'center' }));
      pdfDoc.text('OFFICE OF THE PRESIDENT', CENTER_X, headerY + 11, textOpt({ fontSize: 9, bold: true, align: 'center' }));
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', CENTER_X, headerY + 22, textOpt({ fontSize: 9, bold: true, align: 'center', color: '#FF0000' }));
      pdfDoc.text('ANNEX A', CONTENT_RIGHT - 48, logoY + logoH + 4, textOpt({ fontSize: 10, bold: true }));

      currentY = logoY + logoH + 22;
      pdfDoc.text('BUDGET PROPOSAL SUMMARY', CENTER_X, currentY, textOpt({ fontSize: 14, bold: true, align: 'center' }));
      currentY += LINE_HEIGHT;
      pdfDoc.text(`FISCAL YEAR ${safeStr(fiscalYear)}`, CENTER_X, currentY, textOpt({ fontSize: 11, bold: true, align: 'center' }));
      currentY += LINE_HEIGHT;
      pdfDoc.text(`Budget Type: ${safeStr(budgetType)}  |  Region: ${safeStr(region)}`, CENTER_X, currentY, textOpt({ fontSize: 9, align: 'center' }));
      currentY += LINE_HEIGHT * 1.3;
    };

    pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    drawBorder();
    drawHeader();

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
    
    const drawSectionTitle = (title) => {
      ensureSpace(2);
      pdfDoc.text(title, CONTENT_LEFT, currentY, textOpt({ fontSize: 10, bold: true, underline: true }));
      currentY += LINE_HEIGHT;
    };

    const drawSummaryRow = (label, value, opts = {}) => {
      ensureSpace(1);
      pdfDoc.text(label, CONTENT_LEFT + 2, currentY, textOpt({ fontSize: opts.fontSize || 9, bold: !!opts.bold }));
      pdfDoc.text(value, CONTENT_RIGHT - 5, currentY, textOpt({ fontSize: opts.fontSize || 9, bold: !!opts.bold, align: 'right' }));
      currentY += LINE_HEIGHT;
    };

    const drawStatusSummary = (title, data) => {
      drawSectionTitle(title);
      const statusCounts = {};
      const list = Array.isArray(data) ? data : [];
      list.forEach(item => {
        const status = item?.status || 'Not Submitted';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const total = list.length || 1;
      const entries = Object.entries(statusCounts);
      if (entries.length === 0) {
        drawSummaryRow('No data available', '0 (0.0%)', { fontSize: 8 });
      } else {
        entries.forEach(([status, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          drawSummaryRow(status, `${count} (${pct}%)`, { fontSize: 8 });
        });
      }
      currentY += 4;
    };

    drawSectionTitle('BUDGET OVERVIEW');
    drawSummaryRow('Personnel Services', cleanBudgetSummary.personnelTotal);
    drawSummaryRow('Maintenance & Other Operating Expenses', cleanBudgetSummary.mooeTotal);
    drawSummaryRow('Capital Outlay', cleanBudgetSummary.capitalOutlayTotal);
    drawSummaryRow('Budgetary Support', cleanBudgetSummary.budgetarySupportTotal);
    pdfDoc.rectangle(CONTENT_LEFT, currentY - 3, CONTENT_RIGHT - CONTENT_LEFT, 0.5, { stroke: '#000000', lineWidth: 0.5 });
    currentY += 2;
    drawSummaryRow('GRAND TOTAL', cleanGrandTotal, { bold: true });
    currentY += 6;

    drawSectionTitle('INCOME SUMMARY');
    drawSummaryRow('Corporate Income', cleanBudgetSummary.incomeTotal);
    drawSummaryRow('Combined Income Total', cleanBudgetSummary.combinedIncomeTotal);
    drawSummaryRow('Balance Status', budgetSummary?.isIncomeBalanced ? 'BALANCED' : 'UNBALANCED', { bold: true });
    currentY += 6;

    ensureSpace(2);
    drawFooter();
    pdfDoc.endPage();
    pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    currentPage += 1;
    currentY = MARGIN_TOP;
    drawBorder();

    drawSectionTitle('DETAILED BREAKDOWN');
    drawStatusSummary('Personnel Services Summary', allPersonnelData);
    drawStatusSummary('MOOE Summary', mooeData);
    drawStatusSummary('Capital Outlay Summary', capitalOutlayData);
    drawStatusSummary('Income Summary', incomeData);

    // Fetch workflow data to get signatories
    // Fetch workflow data to get signatories
    let signatoriesInfo = extractSignatoriesFromWorkflow(null, req.user);
    const workflowRefId = (mooeData.find(m => m.workflowRef)?.workflowRef) || 
                          (capitalOutlayData.find(c => c.workflowRef)?.workflowRef) || 
                          (personnelData.find(p => p.workflowRef)?.workflowRef);
    if (workflowRefId) {
      const NewProposalWorkflow = require('../models/NewProposalWorkflow');
      const workflow = await NewProposalWorkflow.findById(workflowRefId).lean();
      if (workflow) {
        signatoriesInfo = extractSignatoriesFromWorkflow(workflow, req.user);
      }
    }

    ensureSpace(4);
    currentY += 10;
    
    const sigContext = region ? { region } : null;
    signatoriesInfo = await enrichSignatoriesWithPositionTitle(signatoriesInfo, sigContext);
    currentY = drawWorkflowSignatureBlock(pdfDoc, signatoriesInfo, currentY, MARGIN, PAGE_WIDTH - (MARGIN * 2), tempSignatureImagePaths);

    drawFooter();

    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        console.error('PDF Export Error:', err);
        return res.status(500).json({ error: 'Failed to generate PDF report', details: err.message || String(err) });
      }

      const filename = `Budget-Summary-Report-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      
      res.on('finish', () => {
        cleanupTempImages(tempSignatureImagePaths);
      });

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('PDF stream error:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream PDF report', details: streamErr.message });
        }
      });
      res.on('finish', () => {
        fs.unlink(tmpFilePath, () => {});
      });
      readStream.pipe(res);
    });
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
    // Apply hierarchical filters
    let queryRegion = region;
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      queryRegion = req.hierarchicalFilters.region;
    }
    // Fetch actual data from database instead of receiving in payload
    const [personnelData, cosPersonnelData, mooeData, capitalOutlayData, incomeData] = await Promise.all([
      PersonnelServices.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      COSPersonnel.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status Total category region fiscalYear employeeName positionTitle').lean(),
      MooeProposal.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status amount subsidy region fiscalYear itemName category').lean(),
      CapitalOutlay.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
      }).select('_id status cost subsidy region fiscalYear itemDescription category').lean(),
      Income.find({ 
        fiscalYear, 
        region: { $regex: new RegExp(queryRegion, 'i') } 
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
