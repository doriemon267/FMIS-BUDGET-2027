const mongoose = require('mongoose');
const Tier = require('../models/Tier');
const TierRevision = require('../models/TierRevision');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const PDFDocument = require('pdfkit');
const { Writable } = require('stream');

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

/**
 * GET /api/tier/saved-items?fiscalYear=&region=&department=&division=
 * Returns the saved Tier document's items (lineItemId, tier1, tier2) so the client
 * can show the current version's values instead of "original" API values.
 */
const getTierSavedItems = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const queryConditions = {
      fiscalYear: String(fiscalYear),
      region: String(region),
      department: String(department || ''),
      division: String(division || ''),
    };
    const tierDoc = await Tier.findOne(queryConditions).select('items').lean();
    const items = Array.isArray(tierDoc?.items) ? tierDoc.items : [];
    res.json({ items });
  } catch (error) {
    console.error('Error in getTierSavedItems:', error);
    res.status(500).json({ message: error.message });
  }
};

const saveTierData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division, items, revisionComment } = req.body;
    const queryConditions = {
      fiscalYear: String(fiscalYear),
      region: String(region || ''),
      department: String(department || ''),
      division: String(division || ''),
    };

    const userId = req.user?.id || req.user?._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    let tierDoc = await Tier.findOne(queryConditions);

    if (tierDoc && Array.isArray(tierDoc.items) && tierDoc.items.length > 0) {
      const nextVersion = await TierRevision.findOne(queryConditions)
        .sort({ version: -1 })
        .select('version')
        .lean()
        .then((r) => (r ? (r.version || 0) + 1 : 1))
        .catch(() => 1);

      await TierRevision.create({
        ...queryConditions,
        version: nextVersion,
        comment: revisionComment || `Saved revision v${nextVersion}`,
        items: tierDoc.items.map((i) => ({
          lineItemId: i.lineItemId,
          description: i.description,
          category: i.category,
          tier1: i.tier1,
          tier2: i.tier2,
        })),
        createdBy: userObjectId,
      });
      await pruneRevisionsForScope(queryConditions.fiscalYear, queryConditions.region, queryConditions.department, queryConditions.division);
    }

    if (tierDoc) {
      items.forEach((newItem) => {
        const existingItem = tierDoc.items.find((i) => String(i.lineItemId) === String(newItem.lineItemId));
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
      tierDoc = new Tier({
        ...queryConditions,
        items: items.map((item) => ({
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

const MAX_REVISIONS_TO_KEEP = 3;

/**
 * Get current (latest) version number for a scope. Returns 0 if no revisions.
 */
const getCurrentVersionForScope = async (fiscalYear, region, department, division) => {
  const query = {
    fiscalYear: String(fiscalYear),
    region: String(region || ''),
    department: String(department || ''),
    division: String(division || ''),
  };
  const latest = await TierRevision.findOne(query).sort({ version: -1 }).select('version').lean();
  return latest ? (latest.version || 0) : 0;
};

/**
 * Keep only the latest MAX_REVISIONS_TO_KEEP revisions for the scope; delete older ones.
 */
const pruneRevisionsForScope = async (fiscalYear, region, department, division) => {
  const query = {
    fiscalYear: String(fiscalYear),
    region: String(region || ''),
    department: String(department || ''),
    division: String(division || ''),
  };
  const idsToRemove = await TierRevision.find(query)
    .sort({ version: -1 })
    .skip(MAX_REVISIONS_TO_KEEP)
    .select('_id')
    .lean();
  if (idsToRemove.length > 0) {
    await TierRevision.deleteMany({ _id: { $in: idsToRemove.map((r) => r._id) } });
  }
};

/**
 * GET /api/tier/current-version?fiscalYear=&region=&department=&division=
 * Returns { version: N } for the given scope (latest revision number, or 0).
 */
const getCurrentVersion = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const version = await getCurrentVersionForScope(fiscalYear, region, department, division);
    res.json({ version });
  } catch (error) {
    console.error('Error in getCurrentVersion:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/tier/revisions?fiscalYear=&region=&department=&division=
 * List revisions for the given scope (newest first). Limited to 3.
 */
const getRevisions = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const query = {
      fiscalYear: String(fiscalYear),
      region: String(region),
      department: String(department || ''),
      division: String(division || ''),
    };
    const list = await TierRevision.find(query)
      .sort({ version: -1 })
      .limit(MAX_REVISIONS_TO_KEEP)
      .select('version comment createdAt createdBy')
      .populate('createdBy', 'username name email')
      .lean();
    res.json(list);
  } catch (error) {
    console.error('Error in getRevisions:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/tier/revisions/:id
 * Get a single revision by _id (full items).
 */
const getRevisionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid revision id.' });
    }
    const rev = await TierRevision.findById(id).populate('createdBy', 'name username email').lean();
    if (!rev) return res.status(404).json({ message: 'Revision not found.' });
    res.json(rev);
  } catch (error) {
    console.error('Error in getRevisionById:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/tier/revisions/:id/restore
 * Copy this revision's items to Tier (current) and optionally create a new revision entry "Restored from vX".
 */
const restoreRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { saveAsNewRevision = true } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid revision id.' });
    }
    const rev = await TierRevision.findById(id).lean();
    if (!rev) return res.status(404).json({ message: 'Revision not found.' });

    const queryConditions = {
      fiscalYear: rev.fiscalYear,
      region: rev.region,
      department: rev.department || '',
      division: rev.division || '',
    };
    const userId = req.user?.id || req.user?._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;

    let tierDoc = await Tier.findOne(queryConditions);
    if (!tierDoc) {
      tierDoc = new Tier({
        ...queryConditions,
        items: rev.items.map((i) => ({
          lineItemId: i.lineItemId,
          category: i.category,
          tier1: i.tier1 || 0,
          tier2: i.tier2 || 0,
          description: i.description || '',
        })),
        createdBy: userObjectId,
      });
    } else {
      // Replace items with the chosen revision's data (so table shows that version, not "original")
      const restoredItems = Array.isArray(rev.items) && rev.items.length > 0
        ? rev.items.map((i) => ({
            lineItemId: i.lineItemId,
            description: i.description || '',
            category: i.category,
            tier1: Number(i.tier1) || 0,
            tier2: Number(i.tier2) || 0,
          }))
        : [];
      tierDoc.items = restoredItems;
      tierDoc.markModified('items');
      if (userObjectId) tierDoc.updatedBy = userObjectId;
    }
    await tierDoc.save();

    if (saveAsNewRevision) {
      const nextVersion = await TierRevision.findOne(queryConditions)
        .sort({ version: -1 })
        .select('version')
        .lean()
        .then((r) => (r ? (r.version || 0) + 1 : 1))
        .catch(() => 1);
      await TierRevision.create({
        ...queryConditions,
        version: nextVersion,
        comment: `Restored from revision v${rev.version}`,
        items: tierDoc.items.map((i) => ({
          lineItemId: i.lineItemId,
          description: i.description,
          category: i.category,
          tier1: i.tier1,
          tier2: i.tier2,
        })),
        createdBy: userObjectId,
      });
      await pruneRevisionsForScope(queryConditions.fiscalYear, queryConditions.region, queryConditions.department, queryConditions.division);
    }
    res.status(200).json({ success: true, tier: tierDoc, restoredFromVersion: rev.version });
  } catch (error) {
    console.error('Error in restoreRevision:', error);
    res.status(500).json({ message: error.message });
  }
};

// Use "Php " in PDF (Helvetica does not support ₱; some viewers show it as ±)
const formatTierCurrency = (amount) => {
  const n = Number(amount);
  if (n === undefined || n === null || isNaN(n) || !Number.isFinite(n)) return 'Php 0.00';
  return `Php ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return (n !== undefined && n !== null && !isNaN(n) && Number.isFinite(n)) ? n : fallback;
};

/**
 * Generate Tier Report PDF from reportSummary (view-only; inline disposition).
 * Accepts POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierPDF = async (req, res) => {
  let doc;
  try {
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary, version: versionFromBody } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems: rawLineItems = [] } = reportSummary;
    // MOOE and Capital Outlay: show only line items with total value > 0
    const lineItems = rawLineItems.filter((item) => {
      const cat = (item.category || '').toString();
      const total = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
      if (cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') return total > 0;
      return true;
    });
    doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.pdf`;
    const chunks = [];
    const bufferStream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
      final(cb) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(Buffer.concat(chunks));
        cb();
      },
    });
    doc.pipe(bufferStream);

    const pageW = doc.page.width - 80;
    const col1 = 40;
    const descColWidth = pageW * 0.38;
    const col2 = col1 + descColWidth + 8;
    const col3 = col2 + (pageW - descColWidth - 8) * 0.22;
    const col4 = col2 + (pageW - descColWidth - 8) * 0.44;
    const col5 = col2 + (pageW - descColWidth - 8) * 0.66;
    const numColW = col3 - col2 - 4;
    const rowH = 18;
    const minRowH = 14;
    const footerMargin = 50;
    const minSpaceForRow = 28;
    const maxDescLen = 55;

    const drawRow = (y, cells, bold = false) => {
      const startY = safeNum(y, 30);
      if (bold) doc.font('Helvetica-Bold');
      doc.fontSize(9);
      const descText = (cells[0] || '').toString().trim() || '—';
      const rawEndY = doc.text(descText, col1, startY, { width: descColWidth, align: 'left' });
      const endY = safeNum(rawEndY, startY + rowH);
      doc.text(cells[1] || '', col2, startY, { width: numColW, align: 'right' });
      doc.text(cells[2] || '', col3, startY, { width: numColW, align: 'right' });
      doc.text(cells[3] || '', col4, startY, { width: numColW, align: 'right' });
      doc.text(cells[4] || '', col5, startY, { width: numColW, align: 'right' });
      if (bold) doc.font('Helvetica');
      const rowHeight = Math.max(minRowH, (endY - startY) + 4);
      return Number.isFinite(rowHeight) ? rowHeight : rowH;
    };

    const pageHeight = safeNum(doc.page?.height, 842);
    let y = 30;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a472a');
    doc.text('TIER BUDGET REPORT', 40, y, { align: 'center', width: pageW });
    y = safeNum(y + 24, 30);
    doc.fontSize(10).font('Helvetica').fillColor('black');
    doc.text(`Fiscal Year: ${fiscalYear}  |  Region: ${regionDisplay}  |  Department: ${departmentDisplay}  |  Division: ${divisionDisplay}`, 40, y, { align: 'center', width: pageW });
    y = safeNum(y + 14, 30);
    doc.fontSize(9).fillColor('#555');
    doc.text(`Version ${Number.isFinite(Number(version)) ? version : 0}`, 40, y, { align: 'center', width: pageW });
    y = safeNum(y + 18, 30);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2e7d32');
    doc.text('A. SOURCES OF FUNDS', 40, y);
    y = safeNum(y + rowH + 4, y);
    doc.font('Helvetica').fillColor('black');
    doc.fontSize(9);
    y = safeNum(y + drawRow(y, ['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total'], true), y);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y = safeNum(y + rowH, y);
    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    y = safeNum(y + drawRow(y, ['Projected Corporate Income', formatTierCurrency(src.corporateIncome), '—', '—', formatTierCurrency(src.corporateIncome)]), y);
    y = safeNum(y + drawRow(y, ['Budgetary Support (Tier 1 + Tier 2)', '—', formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(bs.total)]), y);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y = safeNum(y + rowH, y);
    y = safeNum(y + drawRow(y, ['TOTAL SOURCES OF FUNDS', formatTierCurrency(src.corporateIncome), formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(src.proposedBudget || src.total)], true), y);
    y = safeNum(y + 16, y);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2e7d32');
    doc.text('B. USES OF FUNDS', 40, y);
    y = safeNum(y + rowH + 4, y);
    doc.font('Helvetica').fillColor('black');
    y = safeNum(y + drawRow(y, ['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total'], true), y);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y = safeNum(y + rowH, y);

    let currentCategory = '';
    for (const item of lineItems) {
      const cat = item.category || '';
      if (cat !== currentCategory) {
        currentCategory = cat;
        if (y > pageHeight - footerMargin - 80) { doc.addPage(); y = 40; }
        doc.font('Helvetica-Bold').fontSize(10);
        const catLabel = cat.length > maxDescLen ? cat.slice(0, maxDescLen - 3) + '...' : cat;
        doc.text(catLabel, col1, y, { width: descColWidth });
        doc.font('Helvetica').fontSize(9);
        y = safeNum(y + rowH + 2, y);
      }
      if (y > pageHeight - footerMargin - minSpaceForRow) { doc.addPage(); y = 40; }
      const desc = (item.description || '—').toString();
      y = safeNum(y + drawRow(y, [desc, formatTierCurrency(item.corporateIncome), formatTierCurrency(item.tier1), formatTierCurrency(item.tier2), formatTierCurrency(item.total)]), y);
    }

    const ps = usesOfFunds['Personnel Services'];
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'];
    const co = usesOfFunds['Capital Outlay'];
    if (y > pageHeight - footerMargin - 60) { doc.addPage(); y = 40; }
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y = safeNum(y + rowH, y);
    y = safeNum(y + drawRow(y, ['Personnel Services', formatTierCurrency(usesCorporateIncome['Personnel Services']), formatTierCurrency(ps?.tier1), formatTierCurrency(ps?.tier2), formatTierCurrency(ps?.total)], true), y);
    y = safeNum(y + drawRow(y, ['Maintenance and Other Operating Expenses', formatTierCurrency(usesCorporateIncome['Maintenance and Other Operating Expenses']), formatTierCurrency(mooe?.tier1), formatTierCurrency(mooe?.tier2), formatTierCurrency(mooe?.total)], true), y);
    y = safeNum(y + drawRow(y, ['Capital Outlay', formatTierCurrency(usesCorporateIncome['Capital Outlay']), formatTierCurrency(co?.tier1), formatTierCurrency(co?.tier2), formatTierCurrency(co?.total)], true), y);
    y = safeNum(y + rowH, y);
    doc.moveTo(col1, y).lineTo(col1 + pageW, y).stroke();
    y = safeNum(y + rowH, y);
    const tot = usesOfFunds;
    const totalCorp = (usesCorporateIncome['Personnel Services'] || 0) + (usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0) + (usesCorporateIncome['Capital Outlay'] || 0);
    y = safeNum(y + drawRow(y, ['TOTAL USES OF FUNDS', formatTierCurrency(tot.totalCorporateIncome ?? totalCorp), formatTierCurrency(tot.totalTier1), formatTierCurrency(tot.totalTier2), formatTierCurrency(tot.proposedBudget)], true), y);
    y = safeNum(y + 20, y);

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Surplus/(Deficit): ${formatTierCurrency(surplusDeficit)}`, 40, y);
    y = safeNum(y + rowH + 10, y);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#666');
      const footerY = safeNum(doc.page?.height, pageHeight) - 30;
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, 40, footerY, { width: pageW, align: 'center' });
    }
    doc.end();
  } catch (error) {
    console.error('Error generating tier PDF:', error);
    if (doc && typeof doc.destroy === 'function') doc.destroy();
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Error generating PDF' });
    }
  }
};

/**
 * Generate Tier Report Excel from reportSummary.
 * POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary, version: versionFromBody } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems: rawLineItems = [] } = reportSummary;
    // MOOE and Capital Outlay: show only line items with total value > 0
    const lineItems = rawLineItems.filter((item) => {
      const cat = (item.category || '').toString();
      const total = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
      if (cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') return total > 0;
      return true;
    });
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
    sheet.addRow([`Version ${version}`]);
    sheet.mergeCells('A3:E3');
    sheet.getCell('A3').alignment = { horizontal: 'center' };
    sheet.getCell('A3').font = { italic: true, size: 9 };
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
  getTierSavedItems,
  saveTierData,
  getCurrentVersion,
  getRevisions,
  getRevisionById,
  restoreRevision,
  generateTierPDF,
  generateTierExcel,
};