const fs = require('fs');
const os = require('os');
const path = require('path');
const MooeProposal = require('../models/mooeProposals');
const Region = require('../models/Region');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { extractSignatoriesFromWorkflow, drawWorkflowSignatureBlock, cleanupTempImages } = require('../utils/pdfSignatureHelper');

let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}

const consolidatedReportsController = {
  getConsolidatedData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType, department, division } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      const accessScope = req.hierarchicalAccess?.scope;
      const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        regionFilter.region = accessibleRegionName;
      }
      if (accessScope === 'DIVISION') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
        if (deptName) regionFilter.department = deptName;
        if (divName) regionFilter.division = divName;
      } else if (accessScope === 'DEPARTMENT') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        if (deptName) regionFilter.department = deptName;
      } else if (accessScope === 'REGION') {
        regionFilter.$and = [
          { region: accessibleRegionName },
          {
            $or: [
              { department: { $exists: false } },
              { department: null },
              { department: '' },
              {
                $and: [
                  { department: { $exists: true, $ne: null, $ne: '' } },
                  { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
                ]
              }
            ]
          }
        ];
      }
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter.region = { $in: regionList };
      }
      const mooeQuery = { ...regionFilter };
      if (fiscalYear) mooeQuery.fiscalYear = fiscalYear;
      if (budgetType) mooeQuery.budgetType = budgetType;
      if (department && !mooeQuery.department && !mooeQuery.$and) {
        mooeQuery.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      if (division && !mooeQuery.division && !mooeQuery.$and) {
        mooeQuery.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      const mooeData = await MooeProposal.find(mooeQuery).lean();
      if (!Array.isArray(mooeData) || mooeData.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          summary: { totalRegions: 0, totalCategories: 0, totalEntries: 0, grandTotal: 0 }
        });
      }
      const grouped = {};
      let grandTotal = 0;
      let regionSet = new Set();
      let categorySet = new Set();
      mooeData.forEach((item) => {
        const region = item.region || 'Unspecified';
        const category = item.sublineItem || 'Uncategorized';
        regionSet.add(region);
        categorySet.add(category);
        const key = `${region}||${category}`;
        if (!grouped[key]) {
          grouped[key] = { region, category, items: [], total: 0 };
        }
        const total =
          Number(item.income || 0) + Number(item.subsidy || 0) + Number(item.amount || 0) +
          Number(item.nis || 0) + Number(item.cis || 0);
        grouped[key].items.push({
          uacsCode: item.uacsCode || '',
          accountingTitle: item.accountingTitle || '',
          income: Number(item.income || 0),
          subsidy: Number(item.subsidy || 0),
          amount: Number(item.amount || 0),
          nis: Number(item.nis || 0),
          cis: Number(item.cis || 0),
          total,
          status: item.status || '',
          processBy: item.processBy || '',
          fiscalYear: item.fiscalYear || '',
          budgetType: item.budgetType || '',
          id: item._id || ''
        });
        grouped[key].total += total;
        grandTotal += total;
      });
      const result = Object.values(grouped).map(g => {
        const sortedItems = Array.isArray(g.items)
          ? [...g.items].sort((a, b) => {
              const aUacs = (a.uacsCode || '').toString();
              const bUacs = (b.uacsCode || '').toString();
              if (/^\d[\d\-]*$/.test(aUacs) && /^\d[\d\-]*$/.test(bUacs)) {
                return aUacs.padStart(20, '0').localeCompare(bUacs.padStart(20, '0'));
              }
              return aUacs.localeCompare(bUacs);
            })
          : [];
        return { region: g.region, category: g.category, total: g.total, items: sortedItems };
      }).sort((a, b) => a.region.localeCompare(b.region) || a.category.localeCompare(b.category));
      const safeResult = Array.isArray(result)
        ? result.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] }))
        : [];
      res.status(200).json({
        success: true,
        data: Array.isArray(safeResult) ? safeResult.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] })) : [],
        summary: {
          totalRegions: regionSet.size,
          totalCategories: categorySet.size,
          totalEntries: mooeData.length,
          grandTotal
        }
      });
    } catch (error) {
      console.error('Error fetching consolidated MOOE data:', error);
      res.status(200).json({
        success: false,
        data: [],
        summary: { totalRegions: 0, totalCategories: 0, totalEntries: 0, grandTotal: 0 },
        message: 'Failed to fetch consolidated MOOE data',
        error: error.message
      });
    }
  },

  getConsolidatedSummary: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
        regionFilter.region = req.hierarchicalFilters.region;
      }
      const mooeQuery = { ...regionFilter };
      if (fiscalYear) mooeQuery.fiscalYear = fiscalYear;
      if (budgetType) mooeQuery.budgetType = budgetType;
      const mooeAggregation = await MooeProposal.aggregate([
        { $match: mooeQuery },
        { $unwind: '$entries' },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $toDouble: '$entries.amount' } },
            entryCount: { $sum: 1 }
          }
        }
      ]);
      const mooeTotals = mooeAggregation[0] || { totalAmount: 0, entryCount: 0 };
      const summary = {
        mooe: { totalAmount: mooeTotals.totalAmount, entryCount: mooeTotals.entryCount },
        grandTotals: { totalAmount: mooeTotals.totalAmount }
      };
      res.status(200).json({ success: true, summary });
    } catch (error) {
      console.error('Error fetching consolidated summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch consolidated summary',
        error: error.message
      });
    }
  },

  getAvailableRegions: async (req, res) => {
    try {
      const query = {};
      if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
        query.region = req.hierarchicalFilters.region;
      }
      const mooeRegions = await MooeProposal.distinct('region', query);
      const allRegions = mooeRegions.filter(Boolean);
      const regionDetails = await Region.find({ name: { $in: allRegions } }).lean();
      res.status(200).json({ success: true, regions: regionDetails, availableRegions: allRegions });
    } catch (error) {
      console.error('Error fetching available regions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available regions',
        error: error.message
      });
    }
  },

  // Generate consolidated MOOE PDF report — PRINT-FRIENDLY (ink-saving)
  // Design principles:
  //   - NO background color fills anywhere (except the faintest gray for grand total only)
  //   - Hierarchy shown via borders, bold text, and font size — not color blocks
  //   - All text is black (#000000) or dark gray (#333333) for data and labels
  //   - No watermark fill; just a faint text-only stamp
  //   - Single thin outer border only
  getConsolidatedMooePdf: async (req, res) => {
    if (!MuhammaraRecipe) {
      return res.status(500).json({ message: 'PDF generation library (muhammara) is not installed on the server.' });
    }

    const requesterId = String(req.user?.id || '').trim();
    if (!requesterId) {
      return res.status(401).json({ message: 'Authentication is required to generate PDF reports.' });
    }

    try {
      const { regions, fiscalYear, budgetType, department, division } = req.query;
      const regionList = regions ? (Array.isArray(regions) ? regions : [regions]) : null;

      let regionFilter = {};
      if (regionList && regionList.length) {
        regionFilter.region = { $in: regionList };
      }

      const accessScope = req.hierarchicalAccess?.scope;
      const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName && !regionFilter.region) {
        regionFilter.region = accessibleRegionName;
      }
      if (accessScope === 'DIVISION') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
        if (deptName && !regionFilter.department) regionFilter.department = deptName;
        if (divName && !regionFilter.division) regionFilter.division = divName;
      } else if (accessScope === 'DEPARTMENT') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        if (deptName && !regionFilter.department) regionFilter.department = deptName;
      }

      const mooeQuery = { ...regionFilter };
      if (fiscalYear) mooeQuery.fiscalYear = fiscalYear;
      if (budgetType) mooeQuery.budgetType = budgetType;
      if (department && !mooeQuery.department && !mooeQuery.$and) {
        mooeQuery.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      if (division && !mooeQuery.division && !mooeQuery.$and) {
        mooeQuery.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }

      const mooeData = await MooeProposal.find(mooeQuery).lean();

      // --- Resolve signatories from workflow ---
      let signatoriesInfo = extractSignatoriesFromWorkflow(null);
      const workflowRefId = mooeData.map((m) => m.workflowRef).filter(Boolean)[0];
      if (workflowRefId) {
        const workflow = await NewProposalWorkflow.findById(workflowRefId)
          .select('createdByName createdByTitle workflowHistory')
          .lean();
        if (workflow) {
          signatoriesInfo = extractSignatoriesFromWorkflow(workflow);
        }
      }

      // --- Group data by region > category ---
      const grouped = {};
      mooeData.forEach((item) => {
        const regionName = item.region || 'Unknown Region';
        const categoryName = item.sublineItem || 'Uncategorized';
        if (!grouped[regionName]) grouped[regionName] = {};
        if (!grouped[regionName][categoryName]) grouped[regionName][categoryName] = [];
        grouped[regionName][categoryName].push({
          uacsCode: item.uacsCode || '',
          accountingTitle: item.accountingTitle || '',
          income: Number(item.income || 0),
          subsidy: Number(item.subsidy || 0),
          amount: Number(item.amount || 0),
        });
      });

      // Sort items within each category by uacsCode
      for (const regionName of Object.keys(grouped)) {
        for (const catName of Object.keys(grouped[regionName])) {
          grouped[regionName][catName].sort((a, b) => {
            const aUacs = (a.uacsCode || '').toString();
            const bUacs = (b.uacsCode || '').toString();
            if (/^\d[\d\-]*$/.test(aUacs) && /^\d[\d\-]*$/.test(bUacs)) {
              return aUacs.padStart(20, '0').localeCompare(bUacs.padStart(20, '0'));
            }
            return aUacs.localeCompare(bUacs);
          });
        }
      }

      // ============================================================
      // PAGE SETUP
      // ============================================================
      const tmpFilePath = path.join(os.tmpdir(), `consolidated_mooe_${Date.now()}.pdf`);
      const tempSignatureImagePaths = [];

      // A4 Landscape — more horizontal space for columns
      const PAGE_WIDTH  = 841.89;
      const PAGE_HEIGHT = 595.28;
      const MARGIN      = 36;
      const CONTENT_LEFT  = MARGIN;
      const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
      const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
      const FOOTER_Y      = PAGE_HEIGHT - MARGIN - 14;

      // Row heights
      const ROW_H        = 14;   // standard data row
      const HDR_ROW_H    = 16;   // column header row
      const REGION_ROW_H = 15;   // region label row

      // ============================================================
      // INK-SAVING COLOR PALETTE  — only black and grays
      // ============================================================
      const BLACK       = '#000000';
      const DARK        = '#1a1a1a';   // main text
      const MID         = '#444444';   // secondary / UACS labels
      const LIGHT       = '#888888';   // footer / muted labels
      const BORDER_STD  = '#999999';   // regular cell border lines
      const BORDER_BOLD = '#555555';   // heavier lines for section breaks

      // ============================================================
      // COLUMN LAYOUT
      // ============================================================
      const COL_UACS    = 68;
      const COL_INCOME  = 108;
      const COL_SUBSIDY = 108;
      const COL_AMOUNT  = 108;
      const COL_TITLE   = CONTENT_WIDTH - COL_UACS - COL_INCOME - COL_SUBSIDY - COL_AMOUNT;

      const colX = {
        uacs:    CONTENT_LEFT,
        title:   CONTENT_LEFT + COL_UACS,
        income:  CONTENT_LEFT + COL_UACS + COL_TITLE,
        subsidy: CONTENT_LEFT + COL_UACS + COL_TITLE + COL_INCOME,
        amount:  CONTENT_LEFT + COL_UACS + COL_TITLE + COL_INCOME + COL_SUBSIDY,
      };

      // ============================================================
      // HELPERS
      // ============================================================
      const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
      const requesterLabel = safeStr(req.user?.name || req.user?.UserName || req.user?.id || 'Authorized User');
      const formatPhp = (n) =>
        Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const resolveExisting = (...candidates) => {
        for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
        return null;
      };

      const sealPath = resolveExisting(
        path.join(__dirname, '../assets/Seal.png'),
        path.join(process.cwd(), 'SERVER/assets/Seal.png'),
        path.join(process.cwd(), 'CLIENT/public/Seal.png')
      );
      const nialogoPath = resolveExisting(
        path.join(__dirname, '../assets/logo.png'),
        path.join(process.cwd(), 'SERVER/assets/logo.png'),
        path.join(process.cwd(), 'CLIENT/public/logo.png')
      );
      const bagongPath = resolveExisting(
        path.join(__dirname, '../assets/Bagong_Pilipinas.png'),
        path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'),
        path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png')
      );

      const recipeOptions = {
        version: 1.6,
        author: 'FMIS-BUDGET',
        title: 'Consolidated MOOE Report',
        subject: `MOOE - FY ${fiscalYear || 'All Years'}`,
      };

      const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);
      let curY  = MARGIN;
      let pageNo = 1;
      const generatedAt = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      // ----------------------------------------------------------
      // drawLine — thin horizontal rule helper
      // ----------------------------------------------------------
      const drawHRule = (y, lw = 0.5, color = BORDER_STD) => {
        pdfDoc.rectangle(CONTENT_LEFT, y, CONTENT_WIDTH, lw, { fill: color, stroke: color, lineWidth: 0 });
      };

      // ----------------------------------------------------------
      // drawPageChrome — thin border + faint stamp + footer
      // Called once per page (no colored fills, just lines & text)
      // ----------------------------------------------------------
      const drawPageChrome = () => {
        // Single thin outer border — minimal ink
        pdfDoc.rectangle(MARGIN, MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - MARGIN * 2, {
          stroke: BORDER_BOLD, lineWidth: 0.8
        });

        // Faint confidentiality stamp in center — text only, no box
        const wmX = PAGE_WIDTH / 2;
        const wmY = PAGE_HEIGHT / 2;
        pdfDoc.text('FMIS CONFIDENTIAL', wmX, wmY - 10, {
          color: '#e0e0e0', fontSize: 28, align: 'center'
        });
        pdfDoc.text(requesterLabel, wmX, wmY + 16, {
          color: '#e8e8e8', fontSize: 11, align: 'center'
        });

        // Footer separator line + text
        drawHRule(FOOTER_Y - 2, 0.5, BORDER_STD);
        pdfDoc.text('Annex C (MOOE)', CONTENT_LEFT + 4, FOOTER_Y + 4, { color: LIGHT, fontSize: 7 });
        pdfDoc.text(`Generated: ${generatedAt}`, PAGE_WIDTH / 2, FOOTER_Y + 4, {
          color: LIGHT, fontSize: 7, align: 'center'
        });
        pdfDoc.text(`Page ${pageNo}`, CONTENT_RIGHT - 4, FOOTER_Y + 4, {
          color: LIGHT, fontSize: 7, align: 'right'
        });
      };

      // ----------------------------------------------------------
      // drawFirstPageHeader — logos + centered agency text + title
      // No filled backgrounds — uses bold text and horizontal rules
      // ----------------------------------------------------------
      const drawFirstPageHeader = () => {
        const logoSize = 44;
        const logoY    = MARGIN + 5;

        if (sealPath)    { try { pdfDoc.image(sealPath,    CONTENT_LEFT + 2,            logoY, { width: logoSize, height: logoSize }); } catch (e) {} }
        if (nialogoPath) { try { pdfDoc.image(nialogoPath, CONTENT_LEFT + logoSize + 6, logoY, { width: logoSize, height: logoSize }); } catch (e) {} }
        if (bagongPath)  { try { pdfDoc.image(bagongPath,  CONTENT_RIGHT - logoSize - 2, logoY, { width: logoSize, height: logoSize }); } catch (e) {} }

        const cx = PAGE_WIDTH / 2;
        let hy = logoY + 4;

        pdfDoc.text('Republic of the Philippines', cx, hy, { color: DARK, fontSize: 9, align: 'center' });
        hy += 12;
        pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, { color: DARK, fontSize: 9, bold: true, align: 'center' });
        hy += 12;
        pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, { color: DARK, fontSize: 10, bold: true, align: 'center' });
        hy += 11;

        let regionLabel = regionList && regionList.length ? regionList.join(', ') : 'ALL REGIONS';
        if (department) regionLabel += `  |  Dept: ${department}`;
        if (division)   regionLabel += `  >  Div: ${division}`;
        pdfDoc.text(regionLabel, cx, hy, { color: MID, fontSize: 8, align: 'center' });
        hy += 14;

        // Report title — bold text only, no colored bar
        pdfDoc.text('CONSOLIDATED MOOE REPORT', cx, hy, {
          color: BLACK, fontSize: 13, bold: true, align: 'center'
        });
        hy += 13;
        pdfDoc.text(
          `Fiscal Year: ${safeStr(fiscalYear) || 'All Years'}   |   Budget Type: ${safeStr(budgetType) || 'All'}`,
          cx, hy,
          { color: MID, fontSize: 8, align: 'center' }
        );
        hy += 14;

        // ANNEX C label — top right, plain bold text
        pdfDoc.text('ANNEX C', CONTENT_RIGHT - 4, MARGIN + 6, {
          color: BLACK, fontSize: 10, bold: true, align: 'right'
        });

        curY = hy;
      };

      // ----------------------------------------------------------
      // drawContinuationHeader — compact header for pages 2+
      // ----------------------------------------------------------
      const drawContinuationHeader = () => {
        const cx = PAGE_WIDTH / 2;
        let hy = MARGIN + 6;

        pdfDoc.text('CONSOLIDATED MOOE REPORT (continued)', cx, hy, {
          color: BLACK, fontSize: 9, bold: true, align: 'center'
        });
        hy += 11;
        pdfDoc.text(
          `FY: ${safeStr(fiscalYear) || 'All Years'}   |   Budget Type: ${safeStr(budgetType) || 'All'}`,
          cx, hy,
          { color: MID, fontSize: 7, align: 'center' }
        );
        hy += 12;

        curY = hy;
      };

      // ----------------------------------------------------------
      // drawTableHeader — column header row using lines + bold text
      // No background fill — box drawn with rectangle stroke only
      // ----------------------------------------------------------
      const drawTableHeader = () => {
        const hY = curY;

        // Header box — stroke only, no fill
        pdfDoc.rectangle(CONTENT_LEFT, hY, CONTENT_WIDTH, HDR_ROW_H, {
          stroke: BLACK, lineWidth: 0.8
        });

        // Vertical column dividers inside header
        [colX.title, colX.income, colX.subsidy, colX.amount].forEach(x => {
          pdfDoc.rectangle(x, hY, 0.5, HDR_ROW_H, { fill: BLACK, stroke: BLACK, lineWidth: 0 });
        });

        // Header labels — bold black text
        pdfDoc.text('UACS CODE',                        colX.uacs + 4,                      hY + 5, { color: BLACK, fontSize: 7.5, bold: true });
        pdfDoc.text('ACCOUNTING TITLE / DESCRIPTION',   colX.title + 6,                     hY + 5, { color: BLACK, fontSize: 7.5, bold: true });
        pdfDoc.text('INCOME',  colX.income  + COL_INCOME  - 5, hY + 5, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });
        pdfDoc.text('SUBSIDY', colX.subsidy + COL_SUBSIDY - 5, hY + 5, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });
        pdfDoc.text('AMOUNT',  colX.amount  + COL_AMOUNT  - 5, hY + 5, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });

        curY = hY + HDR_ROW_H;
      };

      // ----------------------------------------------------------
      // startNewPage
      // ----------------------------------------------------------
      const startNewPage = () => {
        pdfDoc.endPage();
        pageNo += 1;
        pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        drawPageChrome();
        drawContinuationHeader();
        drawTableHeader();
      };

      const ensureSpace = (lines = 1, rowHeight = ROW_H) => {
        if (curY + lines * rowHeight > FOOTER_Y - 8) startNewPage();
      };

      // ----------------------------------------------------------
      // drawColSeparators — vertical lines for a given row
      // ----------------------------------------------------------
      const drawColSeparators = (rowY, rowHeight, color = BORDER_STD) => {
        [colX.title, colX.income, colX.subsidy, colX.amount].forEach(x => {
          pdfDoc.rectangle(x, rowY, 0.5, rowHeight, { fill: color, stroke: color, lineWidth: 0 });
        });
      };

      // ============================================================
      // START PDF
      // ============================================================
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      drawPageChrome();
      drawFirstPageHeader();
      drawTableHeader();

      let grandIncome  = 0;
      let grandSubsidy = 0;
      let grandAmount  = 0;

      const regionNames = Object.keys(grouped).sort();

      for (const regionName of regionNames) {
        const categories = grouped[regionName];

        // ---- REGION HEADER ROW ----
        ensureSpace(1, REGION_ROW_H);
        pdfDoc.text(regionName.toUpperCase(), CONTENT_LEFT + 6, curY + 4, {
          color: BLACK, fontSize: 8.5, bold: true
        });
        curY += REGION_ROW_H;

        let regionIncome  = 0;
        let regionSubsidy = 0;
        let regionAmount  = 0;
        const catNames = Object.keys(categories).sort();

        for (const catName of catNames) {
          const rows = categories[catName];
          ensureSpace(2);

          // ---- CATEGORY HEADER ROW ----
          pdfDoc.text(catName, colX.title + 6, curY + 4, {
            color: DARK, fontSize: 7.5, bold: true
          }, { columnWidth: COL_TITLE - 9, overflow: 'truncate' });
          curY += ROW_H;

          let catIncome  = 0;
          let catSubsidy = 0;
          let catAmount  = 0;

          rows.forEach((row, idx) => {
            ensureSpace(1);

            // UACS code — smaller, gray
            if (row.uacsCode) {
              pdfDoc.text(safeStr(row.uacsCode), colX.uacs + 4, curY + 4, {
                color: MID, fontSize: 6.5
              });
            }

            // Accounting title — indented under category
            pdfDoc.text(
              safeStr(row.accountingTitle),
              colX.title + 16, curY + 4,
              { color: DARK, fontSize: 7.5 },
              { columnWidth: COL_TITLE - 20, overflow: 'truncate' }
            );

            pdfDoc.text(formatPhp(row.income),  colX.income  + COL_INCOME  - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });
            pdfDoc.text(formatPhp(row.subsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });
            pdfDoc.text(formatPhp(row.amount),  colX.amount  + COL_AMOUNT  - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });

            curY += ROW_H;

            catIncome  += row.income;
            catSubsidy += row.subsidy;
            catAmount  += row.amount;
          });

          // ---- CATEGORY SUBTOTAL ROW ----
          ensureSpace(1);
          pdfDoc.text(
            `Subtotal — ${catName}`,
            colX.title + 6, curY + 4,
            { color: BLACK, fontSize: 7.5, bold: true },
            { columnWidth: COL_TITLE - 9, overflow: 'truncate' }
          );
          pdfDoc.text(formatPhp(catIncome),  colX.income  + COL_INCOME  - 5, curY + 4, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });
          pdfDoc.text(formatPhp(catSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 4, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });
          pdfDoc.text(formatPhp(catAmount),  colX.amount  + COL_AMOUNT  - 5, curY + 4, { color: BLACK, fontSize: 7.5, bold: true, align: 'right' });
          curY += ROW_H + 2;

          regionIncome  += catIncome;
          regionSubsidy += catSubsidy;
          regionAmount  += catAmount;
        }

        // ---- REGION TOTAL ROW ----
        ensureSpace(1);
        pdfDoc.text(`Region Total: ${regionName}`, CONTENT_LEFT + 6, curY + 5, {
          color: BLACK, fontSize: 8, bold: true
        });
        pdfDoc.text(formatPhp(regionIncome),  colX.income  + COL_INCOME  - 5, curY + 5, { color: BLACK, fontSize: 8, bold: true, align: 'right' });
        pdfDoc.text(formatPhp(regionSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 5, { color: BLACK, fontSize: 8, bold: true, align: 'right' });
        pdfDoc.text(formatPhp(regionAmount),  colX.amount  + COL_AMOUNT  - 5, curY + 5, { color: BLACK, fontSize: 8, bold: true, align: 'right' });
        curY += ROW_H + 2 + 5;

        grandIncome  += regionIncome;
        grandSubsidy += regionSubsidy;
        grandAmount  += regionAmount;
      }

      // ============================================================
      // GRAND TOTAL
      // Heaviest treatment: thick rule top + double rule bottom
      // Very faint gray fill (the only background fill in the document)
      // to make it stand out without wasting much ink
      // ============================================================
      ensureSpace(2, ROW_H + 6);
      const gtH = ROW_H + 6;
      pdfDoc.text('GRAND TOTAL', CONTENT_LEFT + 6, curY + 7, {
        color: BLACK, fontSize: 9.5, bold: true
      });
      pdfDoc.text(formatPhp(grandIncome),  colX.income  + COL_INCOME  - 5, curY + 7, { color: BLACK, fontSize: 9.5, bold: true, align: 'right' });
      pdfDoc.text(formatPhp(grandSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 7, { color: BLACK, fontSize: 9.5, bold: true, align: 'right' });
      pdfDoc.text(formatPhp(grandAmount),  colX.amount  + COL_AMOUNT  - 5, curY + 7, { color: BLACK, fontSize: 9.5, bold: true, align: 'right' });
      curY += gtH + 8;

      // ============================================================
      // SIGNATURE BLOCK
      // Plain lines — no boxes, no fills
      // ============================================================
      ensureSpace(10);
      curY = drawWorkflowSignatureBlock(pdfDoc, signatoriesInfo, curY, MARGIN, CONTENT_WIDTH, tempSignatureImagePaths);
      curY += ROW_H * 2.5 + ROW_H + 20;

      // Confidentiality notice — small gray text
      pdfDoc.text(
        'This document is confidential and intended solely for authorized FMIS users. Unauthorized disclosure is prohibited.',
        PAGE_WIDTH / 2, curY,
        { color: LIGHT, fontSize: 6.5, align: 'center' }
      );

      // ============================================================
      // END PDF
      // ============================================================
      pdfDoc.endPage().endPDF((err) => {
        if (err) {
          if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
          return;
        }
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename=Consolidated_MOOE_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`
        );
        const stream = fs.createReadStream(tmpFilePath);
        stream.on('error', (e) => {
          if (!res.headersSent) res.status(500).json({ message: 'Stream error', error: e.message });
        });
        res.on('finish', () => {
          cleanupTempImages(tempSignatureImagePaths);
          fs.unlink(tmpFilePath, () => {});
        });
        stream.pipe(res);
      });
    } catch (error) {
      console.error('Error generating consolidated MOOE PDF:', error);
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Failed to generate consolidated MOOE PDF', error: error.message });
      }
    }
  },

  exportConsolidatedData: async (req, res) => {
    try {
      const { format = 'json', regions, fiscalYear, budgetType } = req.query;
      req.query = { regions, fiscalYear, budgetType };
      res.status(200).json({
        success: true,
        message: `Export functionality for ${format} format will be implemented`,
        note: 'Use the /consolidated-data endpoint to get the data for now'
      });
    } catch (error) {
      console.error('Error exporting consolidated data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export consolidated data',
        error: error.message
      });
    }
  }
};

module.exports = consolidatedReportsController;