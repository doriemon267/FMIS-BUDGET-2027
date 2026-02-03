const mongoose = require('mongoose');
const Tier = require('../models/Tier');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const PDFDocument = require('pdfkit');

/**
 * GET /api/tier/finalized-data
 * Returns PROJECTED CORPORATE INCOME and PROJECTED SUBSIDY (→ TIER 1) from BRD-finalized Initial proposals.
 * Strictly filtered by fiscalYear (from current settings), region, department, division.
 * Tier page should only show data when hasFinalized is true.
 */
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
      status: { $in: ['FINALIZED', 'Finalized'] },
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
      projectedCorporateIncome,
      projectedSubsidy,
      proposalCount: proposals.length,
      proposals: proposals.map((p) => ({
        _id: p._id,
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

    let tierDoc = await Tier.findOne(queryConditions);

    if (tierDoc) {
      // Update existing items or add new ones
      items.forEach(newItem => {
        const existingItem = tierDoc.items.find(i => i.lineItemId.toString() === newItem.lineItemId.toString());
        if (existingItem) {
          existingItem.tier1 = newItem.tier1;
          existingItem.tier2 = newItem.tier2;
        } else {
          tierDoc.items.push(newItem);
        }
      });
      tierDoc.updatedBy = req.user.id;
    } else {
      // Create a new Tier document
      tierDoc = new Tier({
        ...queryConditions,
        items,
        createdBy: req.user.id,
      });
    }

    const savedTier = await tierDoc.save();
    res.status(200).json(savedTier);

  } catch (error) {
    console.error('Error in saveTierData:', error);
    res.status(500).json({ message: error.message });
  }
};

const generateTierPDF = async (req, res) => {
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

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true
    });

    // Set response headers
    const filename = `Tier_Report_${fiscalYear}_${region || 'All'}_${department || 'All'}_${division || 'All'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('Tier Budget Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Fiscal Year: ${fiscalYear}`, { align: 'center' });
    if (region) doc.text(`Region: ${region}`, { align: 'center' });
    if (department) doc.text(`Department: ${department}`, { align: 'center' });
    if (division) doc.text(`Division: ${division}`, { align: 'center' });
    doc.moveDown(2);

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(amount || 0);
    };

    // Personnel Services Section
    doc.fontSize(16).text('PERSONNEL SERVICES', { underline: true });
    doc.moveDown();

    if (personnelServices.length > 0) {
      // Table headers
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Description', 50, tableTop);
      doc.text('Tier 1', 350, tableTop);
      doc.text('Tier 2', 420, tableTop);
      doc.text('Total', 490, tableTop);

      // Header line
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let yPosition = tableTop + 25;
      let personnelTotalTier1 = 0;
      let personnelTotalTier2 = 0;

      personnelServices.forEach((item) => {
        const tier1 = getTierValue(item._id, 'tier1');
        const tier2 = getTierValue(item._id, 'tier2');
        const total = tier1 + tier2;

        personnelTotalTier1 += tier1;
        personnelTotalTier2 += tier2;

        doc.text(item.employeeFullName || 'N/A', 50, yPosition);
        doc.text(formatCurrency(tier1), 350, yPosition);
        doc.text(formatCurrency(tier2), 420, yPosition);
        doc.text(formatCurrency(total), 490, yPosition);

        yPosition += 20;

        // Add new page if needed
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      });

      // Personnel totals
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 10;
      doc.fontSize(11).text('TOTAL PERSONNEL SERVICES', 50, yPosition, { bold: true });
      doc.text(formatCurrency(personnelTotalTier1), 350, yPosition, { bold: true });
      doc.text(formatCurrency(personnelTotalTier2), 420, yPosition, { bold: true });
      doc.text(formatCurrency(personnelTotalTier1 + personnelTotalTier2), 490, yPosition, { bold: true });
    } else {
      doc.text('No personnel services data found.');
    }

    doc.moveDown(2);

    // MOOE Section
    doc.fontSize(16).text('MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)', { underline: true });
    doc.moveDown();

    if (mooeData.length > 0) {
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Description', 50, tableTop);
      doc.text('Tier 1', 350, tableTop);
      doc.text('Tier 2', 420, tableTop);
      doc.text('Total', 490, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let yPosition = tableTop + 25;
      let mooeTotalTier1 = 0;
      let mooeTotalTier2 = 0;

      mooeData.forEach((item) => {
        const tier1 = getTierValue(item._id, 'tier1');
        const tier2 = getTierValue(item._id, 'tier2');
        const total = tier1 + tier2;

        mooeTotalTier1 += tier1;
        mooeTotalTier2 += tier2;

        doc.text(item.uacsCode || item.description || 'N/A', 50, yPosition);
        doc.text(formatCurrency(tier1), 350, yPosition);
        doc.text(formatCurrency(tier2), 420, yPosition);
        doc.text(formatCurrency(total), 490, yPosition);

        yPosition += 20;

        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      });

      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 10;
      doc.fontSize(11).text('TOTAL MOOE', 50, yPosition, { bold: true });
      doc.text(formatCurrency(mooeTotalTier1), 350, yPosition, { bold: true });
      doc.text(formatCurrency(mooeTotalTier2), 420, yPosition, { bold: true });
      doc.text(formatCurrency(mooeTotalTier1 + mooeTotalTier2), 490, yPosition, { bold: true });
    } else {
      doc.text('No MOOE data found.');
    }

    doc.moveDown(2);

    // Capital Outlay Section
    doc.fontSize(16).text('CAPITAL OUTLAY', { underline: true });
    doc.moveDown();

    if (capitalOutlays.length > 0) {
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Description', 50, tableTop);
      doc.text('Tier 1', 350, tableTop);
      doc.text('Tier 2', 420, tableTop);
      doc.text('Total', 490, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let yPosition = tableTop + 25;
      let capitalTotalTier1 = 0;
      let capitalTotalTier2 = 0;

      capitalOutlays.forEach((item) => {
        const tier1 = getTierValue(item._id, 'tier1');
        const tier2 = getTierValue(item._id, 'tier2');
        const total = tier1 + tier2;

        capitalTotalTier1 += tier1;
        capitalTotalTier2 += tier2;

        doc.text(item.description || 'N/A', 50, yPosition);
        doc.text(formatCurrency(tier1), 350, yPosition);
        doc.text(formatCurrency(tier2), 420, yPosition);
        doc.text(formatCurrency(total), 490, yPosition);

        yPosition += 20;

        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      });

      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 10;
      doc.fontSize(11).text('TOTAL CAPITAL OUTLAY', 50, yPosition, { bold: true });
      doc.text(formatCurrency(capitalTotalTier1), 350, yPosition, { bold: true });
      doc.text(formatCurrency(capitalTotalTier2), 420, yPosition, { bold: true });
      doc.text(formatCurrency(capitalTotalTier1 + capitalTotalTier2), 490, yPosition, { bold: true });
    } else {
      doc.text('No capital outlay data found.');
    }

    // Add page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.text(`Page ${i + 1} of ${range.start + range.count}`, 50, doc.page.height - 50, { align: 'center' });
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating tier PDF:', error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  getFinalizedData,
  getTierData,
  saveTierData,
  generateTierPDF,
};