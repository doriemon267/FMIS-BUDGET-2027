const mongoose = require('mongoose');
const Tier = require('../models/Tier');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const PDFDocument = require('pdfkit');

/**
 * GET /api/tier/finalized-data
 * Returns PROJECTED CORPORATE INCOME and PROJECTED SUBSIDY (→ TIER 1) from Initial proposals at BRD level or finalized.
 * Tier is available once the proposal reaches BRD (Budget Planning Analyst → Budget Officer → Budget Manager) so that
 * Tier data saved here is what gets passed along until the Budget Manager finalizes.
 * Strictly filtered by fiscalYear (from current settings), region, department, division.
 */
const BRD_OR_FINALIZED_STATUSES = [
  'FINALIZED',
  'Finalized',
  'FORWARDED_TO_BRD_ANALYST',
  'FORWARDED_TO_BRD_OFFICER',
  'FORWARDED_TO_BRD_MANAGER',
];

const getFinalizedData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;

    if (!fiscalYear) {
      return res.status(400).json({
        success: false,
        message: 'fiscalYear is required (use current settings fiscal year).',
      });
    }

    const fy = parseInt(String(fiscalYear), 10);
    if (isNaN(fy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscalYear.',
      });
    }

    const query = {
      modelType: 'Initial',
      status: { $in: BRD_OR_FINALIZED_STATUSES },
      fiscalYear: fy,
    };

    if (region) {
      if (mongoose.Types.ObjectId.isValid(region)) {
        query.region = new mongoose.Types.ObjectId(region);
      } else {
        // Try to find region by name/string
        const Region = require('../models/Region');
        const regionDoc = await Region.findOne({
          $or: [
            { regionName: region },
            { Region: region },
            { name: region },
          ],
        });
        if (regionDoc) {
          query.region = regionDoc._id;
        } else {
          // If no match found, log warning and skip region filter
          console.warn(`Region not found for value: ${region}, proceeding without region filter`);
        }
      }
    }

    if (department) query.department = department;
    if (division) query.division = division;

    console.log('getFinalizedData query:', JSON.stringify(query, null, 2));
    const proposals = await NewProposalWorkflow.find(query).lean();
    console.log(`getFinalizedData found ${proposals.length} proposals`);

    const projectedCorporateIncome = proposals.reduce(
      (sum, p) => sum + (Number(p.projectedCorporateIncome) || 0),
      0
    );
    const projectedSubsidy = proposals.reduce(
      (sum, p) => sum + (Number(p.projectedSubsidy) || 0),
      0
    );

    res.json({
      success: true,
      hasFinalized: proposals.length > 0,
      hasTierData: proposals.length > 0,
      projectedCorporateIncome,
      projectedSubsidy,
      proposalCount: proposals.length,
      proposals: proposals.map((p) => ({
        _id: p._id,
        status: p.status,
        division: p.division,
        department: p.department,
        projectedCorporateIncome: p.projectedCorporateIncome,
        projectedSubsidy: p.projectedSubsidy,
      })),
    });
  } catch (error) {
    console.error('Error in getFinalizedData:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch finalized tier data.',
    });
  }
};

const getTierData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    let queryConditions = { fiscalYear };
    if (region) queryConditions.region = region;
    if (department) queryConditions.department = department;
    if (division) queryConditions.division = division;

    const personnelServices = await PersonnelServices.find(queryConditions);
    const capitalOutlays = await CapitalOutlay.find(queryConditions);
    const mooeData = await mooeProposals.find(queryConditions);

    const tierDoc = await Tier.findOne(queryConditions);

    const getTierValue = (lineItemId, field) => {
      if (!tierDoc) return 0;
      const item = tierDoc.items.find(i => i.lineItemId.toString() === lineItemId.toString());
      return item ? item[field] : 0;
    };

    const personnelItems = personnelServices.map(p => ({
      _id: p._id,
      description: p.employeeFullName,
      tier1: getTierValue(p._id, 'tier1'),
      tier2: getTierValue(p._id, 'tier2'),
    }));

    const mooeItems = mooeData.map(m => ({
      _id: m._id,
      description: m.uacsCode, // Or another descriptive field
      tier1: getTierValue(m._id, 'tier1'),
      tier2: getTierValue(m._id, 'tier2'),
    }));

    const capitalOutlayItems = capitalOutlays.map(c => ({
      _id: c._id,
      description: c.description,
      tier1: getTierValue(c._id, 'tier1'),
      tier2: getTierValue(c._id, 'tier2'),
    }));

    res.json({
      personnelServices: personnelItems,
      mooe: mooeItems,
      capitalOutlay: capitalOutlayItems,
    });

  } catch (error) {
    console.error('Error in getTierData:', error);
    res.status(500).json({ message: error.message });
  }
};

const saveTierData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division, items } = req.body;
    let queryConditions = { fiscalYear, region, department, division };

    // Convert user ID to ObjectId if it's a string
    const userId = req.user?.id || req.user?._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : null;

    let tierDoc = await Tier.findOne(queryConditions);

    if (tierDoc) {
      // Update existing items or add new ones
      items.forEach(newItem => {
        const existingItem = tierDoc.items.find(i => i.lineItemId.toString() === newItem.lineItemId.toString());
        if (existingItem) {
          existingItem.tier1 = newItem.tier1;
          existingItem.tier2 = newItem.tier2;
          if (newItem.description) existingItem.description = newItem.description;
        } else {
          tierDoc.items.push({
            lineItemId: newItem.lineItemId,
            category: newItem.category,
            tier1: newItem.tier1 || 0,
            tier2: newItem.tier2 || 0,
            description: newItem.description || '',
          });
        }
      });
      if (userObjectId) tierDoc.updatedBy = userObjectId;
    } else {
      // Create a new Tier document
      tierDoc = new Tier({
        ...queryConditions,
        items: items.map(item => ({
          lineItemId: item.lineItemId,
          category: item.category,
          tier1: item.tier1 || 0,
          tier2: item.tier2 || 0,
          description: item.description || '',
        })),
        createdBy: userObjectId,
      });
    }

    const savedTier = await tierDoc.save();
    res.status(200).json(savedTier);

  } catch (error) {
    console.error('Error in saveTierData:', error);
    res.status(500).json({ message: error.message });
  }
};

// Use "Php " in PDF (Helvetica does not support ₱; some viewers show it as ±)
const formatTierCurrency = (amount) => {
  const n = Number(amount);
  if (isNaN(n)) return 'Php 0.00';
  return `Php ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generate Tier Report PDF from reportSummary (view-only; inline disposition).
 * Accepts POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierPDF = async (req, res) => {
  try {
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems = [] } = reportSummary;
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    doc.pipe(res);

    const pageW = doc.page.width - 80;
    const col1 = 40;
    const col2 = col1 + pageW * 0.22;
    const col3 = col1 + pageW * 0.40;
    const col4 = col1 + pageW * 0.58;
    const col5 = col1 + pageW * 0.76;

    const rowH = 18;
    const col1Width = col2 - col1 - 4;
    const maxDescLen = 48;
    // Single-line description (truncate) + fixed row height to avoid wrap/auto page breaks and blank pages
    const drawRow = (y, cells, bold = false) => {
      if (bold) doc.font('Helvetica-Bold');
      doc.fontSize(9);
      let descText = (cells[0] || '').toString();
      if (descText.length > maxDescLen) descText = descText.slice(0, maxDescLen - 3) + '...';
      doc.text(descText, col1, y, { width: col1Width });
      doc.text(cells[1] || '', col2, y, { width: col3 - col2 - 4, align: 'right' });
      doc.text(cells[2] || '', col3, y, { width: col4 - col3 - 4, align: 'right' });
      doc.text(cells[3] || '', col4, y, { width: col5 - col4 - 4, align: 'right' });
      doc.text(cells[4] || '', col5, y, { width: pageW - (col5 - col1), align: 'right' });
      if (bold) doc.font('Helvetica');
      return rowH;
    };

    let y = 30;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a472a');
    doc.text('TIER BUDGET REPORT', 40, y, { align: 'center', width: pageW });
    y += 24;
    doc.fontSize(10).font('Helvetica').fillColor('black');
    doc.text(`Fiscal Year: ${fiscalYear}  |  Region: ${regionDisplay}  |  Department: ${departmentDisplay}  |  Division: ${divisionDisplay}`, 40, y, { align: 'center', width: pageW });
    y += 28;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2e7d32');
    doc.text('A. SOURCES OF FUNDS', 40, y);
    y += rowH + 4;
    doc.font('Helvetica').fillColor('black');
    doc.fontSize(9);
    y += drawRow(y, ['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total'], true);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y += rowH;
    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    y += drawRow(y, ['Projected Corporate Income', formatTierCurrency(src.corporateIncome), '—', '—', formatTierCurrency(src.corporateIncome)]);
    y += drawRow(y, ['Budgetary Support (Tier 1 + Tier 2)', '—', formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(bs.total)]);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y += rowH;
    y += drawRow(y, ['TOTAL SOURCES OF FUNDS', formatTierCurrency(src.corporateIncome), formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(src.proposedBudget || src.total)], true);
    y += 16;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2e7d32');
    doc.text('B. USES OF FUNDS', 40, y);
    y += rowH + 4;
    doc.font('Helvetica').fillColor('black');
    y += drawRow(y, ['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total'], true);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y += rowH;

    let currentCategory = '';
    for (const item of lineItems) {
      const cat = item.category || '';
      if (cat !== currentCategory) {
        currentCategory = cat;
        if (y > doc.page.height - 120) { doc.addPage(); y = 40; }
        doc.font('Helvetica-Bold').fontSize(10);
        const catLabel = cat.length > maxDescLen ? cat.slice(0, maxDescLen - 3) + '...' : cat;
        doc.text(catLabel, col1, y, { width: col1Width });
        doc.font('Helvetica').fontSize(9);
        y += rowH + 2;
      }
      if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      const desc = (item.description || '—').toString();
      y += drawRow(y, [desc, formatTierCurrency(item.corporateIncome), formatTierCurrency(item.tier1), formatTierCurrency(item.tier2), formatTierCurrency(item.total)]);
    }

    const ps = usesOfFunds['Personnel Services'];
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'];
    const co = usesOfFunds['Capital Outlay'];
    if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y += rowH;
    y += drawRow(y, ['Personnel Services', formatTierCurrency(usesCorporateIncome['Personnel Services']), formatTierCurrency(ps?.tier1), formatTierCurrency(ps?.tier2), formatTierCurrency(ps?.total)], true);
    y += drawRow(y, ['Maintenance and Other Operating Expenses', formatTierCurrency(usesCorporateIncome['Maintenance and Other Operating Expenses']), formatTierCurrency(mooe?.tier1), formatTierCurrency(mooe?.tier2), formatTierCurrency(mooe?.total)], true);
    y += drawRow(y, ['Capital Outlay', formatTierCurrency(usesCorporateIncome['Capital Outlay']), formatTierCurrency(co?.tier1), formatTierCurrency(co?.tier2), formatTierCurrency(co?.total)], true);
    y += rowH;
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y += rowH;
    const tot = usesOfFunds;
    const totalCorp = (usesCorporateIncome['Personnel Services'] || 0) + (usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0) + (usesCorporateIncome['Capital Outlay'] || 0);
    y += drawRow(y, ['TOTAL USES OF FUNDS', formatTierCurrency(tot.totalCorporateIncome ?? totalCorp), formatTierCurrency(tot.totalTier1), formatTierCurrency(tot.totalTier2), formatTierCurrency(tot.proposedBudget)], true);
    y += 20;

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Surplus/(Deficit): ${formatTierCurrency(surplusDeficit)}`, 40, y);
    y += rowH + 10;

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#666');
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, 40, doc.page.height - 30, { width: pageW, align: 'center' });
    }
    doc.end();
  } catch (error) {
    console.error('Error generating tier PDF:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate Tier Report Excel from reportSummary.
 * POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems = [] } = reportSummary;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FMIS Budget System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tier Report', { views: [{ state: 'frozen', ySplit: 4 }] });
    sheet.columns = [
      { width: 42 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2e7d32' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const titleFont = { bold: true, size: 14, color: { argb: 'FF1a472a' } };
    const numFormat = '#,##0.00';

    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'TIER BUDGET REPORT';
    sheet.getCell('A1').font = titleFont;
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.addRow([`Fiscal Year: ${fiscalYear}  |  Region: ${regionDisplay}  |  Department: ${departmentDisplay}  |  Division: ${divisionDisplay}`]);
    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([]);

    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    sheet.addRow(['A. SOURCES OF FUNDS']).getCell(1).font = { bold: true };
    sheet.addRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total']);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; });
    sheet.addRow(['Projected Corporate Income', Number(src.corporateIncome) || 0, '', '', Number(src.corporateIncome) || 0]);
    sheet.addRow(['Budgetary Support', '', Number(bs.tier1) || 0, Number(bs.tier2) || 0, Number(bs.total) || 0]);
    sheet.addRow(['TOTAL SOURCES OF FUNDS', Number(src.corporateIncome) || 0, Number(bs.tier1) || 0, Number(bs.tier2) || 0, Number(src.proposedBudget || src.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow([]);

    sheet.addRow(['B. USES OF FUNDS']).getCell(1).font = { bold: true };
    sheet.addRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total']);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; });

    let currentCategory = '';
    for (const item of lineItems) {
      if ((item.category || '') !== currentCategory) {
        currentCategory = item.category || '';
        sheet.addRow([currentCategory]).getCell(1).font = { bold: true };
      }
      const row = sheet.addRow([
        item.description || '—',
        Number(item.corporateIncome) || 0,
        Number(item.tier1) || 0,
        Number(item.tier2) || 0,
        Number(item.total) || 0,
      ]);
      row.getCell(2).numFmt = numFormat;
      row.getCell(3).numFmt = numFormat;
      row.getCell(4).numFmt = numFormat;
      row.getCell(5).numFmt = numFormat;
    }

    const ps = usesOfFunds['Personnel Services'];
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'];
    const co = usesOfFunds['Capital Outlay'];
    const tot = usesOfFunds;
    sheet.addRow(['Personnel Services', Number(usesCorporateIncome['Personnel Services']) || 0, Number(ps?.tier1) || 0, Number(ps?.tier2) || 0, Number(ps?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['Maintenance and Other Operating Expenses', Number(usesCorporateIncome['Maintenance and Other Operating Expenses']) || 0, Number(mooe?.tier1) || 0, Number(mooe?.tier2) || 0, Number(mooe?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['Capital Outlay', Number(usesCorporateIncome['Capital Outlay']) || 0, Number(co?.tier1) || 0, Number(co?.tier2) || 0, Number(co?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['TOTAL USES OF FUNDS', Number(tot.totalCorporateIncome) || 0, Number(tot.totalTier1) || 0, Number(tot.totalTier2) || 0, Number(tot.proposedBudget) || 0]);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow([]);
    sheet.addRow(['Surplus/(Deficit)', Number(surplusDeficit) || 0]).getCell(1).font = { bold: true };
    sheet.lastRow.getCell(2).numFmt = numFormat;

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error generating tier Excel:', error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  getFinalizedData,
  getTierData,
  saveTierData,
  generateTierPDF,
  generateTierExcel,
};