const fs = require('fs');
const os = require('os');
const path = require('path');
const MooeProposal = require('../models/mooeProposals');
const Region = require('../models/Region');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}
const consolidatedReportsController = {
  // Get consolidated MOOE data for all or specific regions
  getConsolidatedData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType, department, division } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      // Apply sophisticated hierarchical filtering based on user access scope
      const accessScope = req.hierarchicalAccess?.scope;
      const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
      // Add region filter based on access scope
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        regionFilter.region = accessibleRegionName;
      }
      // Add finer filters based on access scope
      if (accessScope === 'DIVISION') {
        // Division users: only their division within their department and region
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
        if (deptName) regionFilter.department = deptName;
        if (divName) regionFilter.division = divName;
      } else if (accessScope === 'DEPARTMENT') {
        // Department users: all divisions within their department in the region
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        if (deptName) regionFilter.department = deptName;
      } else if (accessScope === 'REGION') {
        // Region-level users should ONLY see:
        // 1. Records that don't have department field (already consolidated to region level)
        // 2. Department records that are properly submitted/approved ONLY
        // BUT NOT current working drafts of departments
        regionFilter.$and = [
          { region: accessibleRegionName }, // Must be in their region
          {
            $or: [
              // Option 1: Consolidated records (no department info)
              { department: { $exists: false } },
              { department: null },
              { department: "" },
              // Option 2: Department records that are submitted/approved ONLY
              { 
                $and: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
                ]
              }
            ]
          }
        ];
      }
      // Override with explicit regions parameter if provided
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
      // Fetch all MOOE proposals matching the query
      const mooeData = await MooeProposal.find(mooeQuery).lean();
      if (!Array.isArray(mooeData) || mooeData.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          summary: {
            totalRegions: 0,
            totalCategories: 0,
            totalEntries: 0,
            grandTotal: 0
          }
        });
      }
      // Group by region and category
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
          grouped[key] = {
            region,
            category,
            items: [],
            total: 0
          };
        }
        // Defensive: always use numbers
        const total =
          Number(item.income || 0) +
          Number(item.subsidy || 0) +
          Number(item.amount || 0) +
          Number(item.nis || 0) +
          Number(item.cis || 0);
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
      // Prepare result for UI: array of { region, category, total, items }
      const result = Object.values(grouped).map(g => {
        // Sort items by uacsCode ascending (copy first to avoid in-place sort issues)
        const sortedItems = Array.isArray(g.items)
          ? [...g.items].sort((a, b) => {
              const aUacs = (a.uacsCode || '').toString();
              const bUacs = (b.uacsCode || '').toString();
              // Pad with zeros for consistent sorting if numeric
              if (/^\d[\d\-]*$/.test(aUacs) && /^\d[\d\-]*$/.test(bUacs)) {
                return aUacs.padStart(20, '0').localeCompare(bUacs.padStart(20, '0'));
              }
              return aUacs.localeCompare(bUacs);
            })
          : [];
        return {
          region: g.region,
          category: g.category,
          total: g.total,
          items: sortedItems
        };
      }).sort((a, b) => a.region.localeCompare(b.region) || a.category.localeCompare(b.category));
      // Defensive: ensure every group has items as array
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
        summary: {
          totalRegions: 0,
          totalCategories: 0,
          totalEntries: 0,
          grandTotal: 0
        },
        message: 'Failed to fetch consolidated MOOE data',
        error: error.message
      });
    }
  },
  // Get consolidated MOOE summary statistics
  getConsolidatedSummary: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      // Apply hierarchical filters if present
      if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
        regionFilter.region = req.hierarchicalFilters.region;
      }
      // Build query filters for MOOE only
      const mooeQuery = { ...regionFilter };
      if (fiscalYear) {
        mooeQuery.fiscalYear = fiscalYear;
      }
      if (budgetType) {
        mooeQuery.budgetType = budgetType;
      }
      // Aggregate MOOE totals only
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
        mooe: {
          totalAmount: mooeTotals.totalAmount,
          entryCount: mooeTotals.entryCount
        },
        grandTotals: {
          totalAmount: mooeTotals.totalAmount
        }
      };
      res.status(200).json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Error fetching consolidated summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch consolidated summary',
        error: error.message
      });
    }
  },
  // Get available regions for consolidation
  getAvailableRegions: async (req, res) => {
    try {
      // Build query to filter regions based on hierarchical access
      const query = {};
      if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
        query.region = req.hierarchicalFilters.region;
      }
      // Get regions that have MOOE data only
      const mooeRegions = await MooeProposal.distinct('region', query);
      // Filter out null/undefined regions
      const allRegions = mooeRegions.filter(Boolean);
      // Get region details
      const regionDetails = await Region.find({ name: { $in: allRegions } }).lean();
      res.status(200).json({
        success: true,
        regions: regionDetails,
        availableRegions: allRegions
      });
    } catch (error) {
      console.error('Error fetching available regions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available regions',
        error: error.message
      });
    }
  },
  // Generate consolidated MOOE PDF report (inline preview)
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

      let preparedByName = '';
      let notedByName = '';
      let approvedByName = '';
      const workflowRefId = mooeData.map((m) => m.workflowRef).filter(Boolean)[0];
      if (workflowRefId) {
        const workflow = await NewProposalWorkflow.findById(workflowRefId)
          .select('createdByName workflowHistory')
          .lean();
        if (workflow) {
          preparedByName = workflow.createdByName || '';
          const notedEntry = (workflow.workflowHistory || []).find((h) => h.toStatus === 'FORWARDED_TO_APPROVER');
          if (notedEntry) notedByName = notedEntry.performedByName || '';
          const approvedEntry = (workflow.workflowHistory || []).find((h) => h.toStatus === 'FINALIZED');
          if (approvedEntry) approvedByName = approvedEntry.performedByName || '';
        }
      }

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

      const tmpFilePath = path.join(os.tmpdir(), `mooe_report_${Date.now()}.pdf`);
      const recipeOptions = {
        version: 1.6,
        author: 'FMIS-BUDGET',
        title: 'Consolidated MOOE Report',
        subject: `MOOE - FY ${fiscalYear || 'All Years'}`,
      };

      const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);
      const PAGE_WIDTH = 595.28;
      const PAGE_HEIGHT = 841.89;
      const MARGIN = 36;
      const CONTENT_LEFT = MARGIN;
      const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
      const LINE_H = 13;
      let curY = MARGIN;
      let pageNo = 1;

      const textOpt = (o = {}) => ({ color: '#000000', ...o });
      const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
      const requesterLabel = safeStr(req.user?.name || req.user?.UserName || req.user?.id || 'Authorized User');
      const watermarkText = `FMIS CONFIDENTIAL • ${requesterLabel}`;
      const formatPhp = (n) => Number(n || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
      const resolveExisting = (...candidates) => {
        for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
        return null;
      };
      const sealPath = resolveExisting(path.join(__dirname, '../assets/Seal.png'), path.join(process.cwd(), 'SERVER/assets/Seal.png'), path.join(process.cwd(), 'CLIENT/public/Seal.png'));
      const nialogoPath = resolveExisting(path.join(__dirname, '../assets/logo.png'), path.join(process.cwd(), 'SERVER/assets/logo.png'), path.join(process.cwd(), 'CLIENT/public/logo.png'));
      const bagongPath = resolveExisting(path.join(__dirname, '../assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png'));

      const drawPage = (isFirst) => {
        const cx = PAGE_WIDTH / 2;
        const cy = PAGE_HEIGHT / 2;
        pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, { stroke: '#4d4c4c', lineWidth: 1.5 });
        pdfDoc.text(watermarkText, cx, cy - 18, textOpt({ fontSize: 30, color: '#d9d9d9', align: 'center' }));
        pdfDoc.text(`Generated ${new Date().toLocaleString('en-US')}`, cx, cy + 15, textOpt({ fontSize: 12, color: '#dddddd', align: 'center' }));
        pdfDoc.text('Annex C (MOOE)', CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN - 12, textOpt({ fontSize: 8 }));
        pdfDoc.text(`Page ${pageNo}`, CONTENT_RIGHT - 55, PAGE_HEIGHT - MARGIN - 12, textOpt({ fontSize: 8 }));
        if (!isFirst) return;

        const logoW = 44, logoH = 44, logoY = MARGIN + 2;
        if (sealPath) { try { pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoW, height: logoH }); } catch (e) {} }
        if (nialogoPath) { try { pdfDoc.image(nialogoPath, CONTENT_LEFT + logoW + 5, logoY, { width: logoW, height: logoH }); } catch (e) {} }
        if (bagongPath) { try { pdfDoc.image(bagongPath, CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH }); } catch (e) {} }

        let hy = logoY + 6;
        pdfDoc.text('Republic of the Philippines', cx, hy, textOpt({ fontSize: 10, align: 'center' }));
        hy += LINE_H;
        pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
        hy += LINE_H;
        pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
        hy += LINE_H;
        let regionLabel = regionList && regionList.length ? regionList.join(', ') : 'ALL REGIONS';
        if (department) regionLabel += `  |  Dept: ${department}`;
        if (division) regionLabel += `  >  Div: ${division}`;
        pdfDoc.text(regionLabel, cx, hy, textOpt({ fontSize: 9, align: 'center' }));
        if (bagongPath) pdfDoc.text('ANNEX C', CONTENT_RIGHT - 62, MARGIN + logoH + 2, textOpt({ fontSize: 13, bold: true }));

        curY = hy + LINE_H * 1.3;
        pdfDoc.text('CONSOLIDATED MOOE REPORT', cx, curY, textOpt({ fontSize: 15, bold: true, align: 'center' }));
        curY += LINE_H * 1.2;
        pdfDoc.text(`Fiscal Year: ${safeStr(fiscalYear) || 'All Years'}  |  Budget Type: ${safeStr(budgetType) || 'All'}`, cx, curY, textOpt({ fontSize: 10, align: 'center' }));
        curY += LINE_H * 1.8;
      };

      const startNewPage = () => {
        pdfDoc.endPage();
        pageNo += 1;
        pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        curY = MARGIN + 20;
        drawPage(false);
      };
      const ensureSpace = (lines = 1) => {
        if (curY + lines * LINE_H > PAGE_HEIGHT - MARGIN - 22) startNewPage();
      };

      const COL_REGION = 70;
      const COL_UACS = 65;
      const COL_INCOME = 75;
      const COL_SUBSIDY = 75;
      const COL_AMOUNT = 75;
      const COL_TITLE = CONTENT_RIGHT - CONTENT_LEFT - COL_REGION - COL_UACS - COL_INCOME - COL_SUBSIDY - COL_AMOUNT;
      const colX = {
        region: CONTENT_LEFT,
        uacs: CONTENT_LEFT + COL_REGION,
        title: CONTENT_LEFT + COL_REGION + COL_UACS,
        income: CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE,
        subsidy: CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE + COL_INCOME,
        amount: CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE + COL_INCOME + COL_SUBSIDY,
      };

      const drawTableHeader = () => {
        ensureSpace(2);
        pdfDoc.rectangle(colX.region, curY - 3, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 4, { stroke: '#4d4c4c', lineWidth: 0.5 });
        pdfDoc.text('REGION', colX.region + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text('UACS CODE', colX.uacs + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text('ACCOUNTING TITLE', colX.title + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text('INCOME', colX.income + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text('SUBSIDY', colX.subsidy + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text('AMOUNT', colX.amount + 3, curY, textOpt({ fontSize: 8, bold: true }));
        curY += LINE_H + 4;
      };

      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      drawPage(true);
      drawTableHeader();

      let grandIncome = 0;
      let grandSubsidy = 0;
      let grandAmount = 0;
      for (const [regionName, categories] of Object.entries(grouped)) {
        let regionFirstRow = true;
        for (const [catName, rows] of Object.entries(categories)) {
          ensureSpace(2);
          pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 2, { stroke: '#c0d0c0', lineWidth: 0.3 });
          pdfDoc.text(regionFirstRow ? regionName : '', colX.region + 3, curY, textOpt({ fontSize: 8, bold: true }));
          pdfDoc.text(catName, colX.uacs + 3, curY, textOpt({ fontSize: 8, bold: true }), { columnWidth: COL_TITLE + COL_UACS - 6, overflow: 'truncate' });
          curY += LINE_H + 2;
          regionFirstRow = false;

          let catIncome = 0;
          let catSubsidy = 0;
          let catAmount = 0;
          for (const row of rows) {
            ensureSpace(1);
            pdfDoc.text(safeStr(row.uacsCode), colX.uacs + 3, curY, textOpt({ fontSize: 7.5 }));
            pdfDoc.text(safeStr(row.accountingTitle), colX.title + 3, curY, textOpt({ fontSize: 7.5 }), { columnWidth: COL_TITLE - 6, overflow: 'truncate' });
            pdfDoc.text(formatPhp(row.income), colX.income + COL_INCOME - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
            pdfDoc.text(formatPhp(row.subsidy), colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
            pdfDoc.text(formatPhp(row.amount), colX.amount + COL_AMOUNT - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
            curY += LINE_H;
            catIncome += row.income;
            catSubsidy += row.subsidy;
            catAmount += row.amount;
          }

          ensureSpace(1);
          pdfDoc.rectangle(colX.region, curY - 1, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 1, { stroke: '#9e9e9e', lineWidth: 0.4 });
          pdfDoc.text(`Subtotal: ${catName}`, colX.uacs + 3, curY, textOpt({ fontSize: 7.5, bold: true }));
          pdfDoc.text(formatPhp(catIncome), colX.income + COL_INCOME - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
          pdfDoc.text(formatPhp(catSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
          pdfDoc.text(formatPhp(catAmount), colX.amount + COL_AMOUNT - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
          curY += LINE_H + 2;

          grandIncome += catIncome;
          grandSubsidy += catSubsidy;
          grandAmount += catAmount;
        }
        curY += 4;
      }

      ensureSpace(2);
      pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 4, { stroke: '#4d4c4c', lineWidth: 0.6 });
      pdfDoc.text('GRAND TOTAL', colX.region + 3, curY, textOpt({ fontSize: 9, bold: true }));
      pdfDoc.text(formatPhp(grandIncome), colX.income + COL_INCOME - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
      pdfDoc.text(formatPhp(grandSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
      pdfDoc.text(formatPhp(grandAmount), colX.amount + COL_AMOUNT - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
      curY += LINE_H + 6;

      ensureSpace(8);
      curY += LINE_H * 2;
      const sigLineW = 140;
      const leftSig = CONTENT_LEFT + 10;
      const centerSig = (CONTENT_LEFT + CONTENT_RIGHT) / 2 - sigLineW / 2;
      const rightSig = CONTENT_RIGHT - sigLineW - 10;

      pdfDoc.text('Prepared by:', leftSig, curY, textOpt({ fontSize: 8 }));
      pdfDoc.text('Noted by:', centerSig, curY, textOpt({ fontSize: 8 }));
      pdfDoc.text('Approved by:', rightSig, curY, textOpt({ fontSize: 8 }));
      curY += LINE_H * 3;
      pdfDoc.rectangle(leftSig, curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
      pdfDoc.rectangle(centerSig, curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
      pdfDoc.rectangle(rightSig, curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
      curY += LINE_H * 0.6;
      pdfDoc.text(preparedByName || '________________________', leftSig, curY, textOpt({ fontSize: 8, bold: !!preparedByName }));
      pdfDoc.text(notedByName || '________________________', centerSig, curY, textOpt({ fontSize: 8, bold: !!notedByName }));
      pdfDoc.text(approvedByName || '________________________', rightSig, curY, textOpt({ fontSize: 8, bold: !!approvedByName }));
      curY += LINE_H;
      pdfDoc.text('Budget Preparer', leftSig, curY, textOpt({ fontSize: 7 }));
      pdfDoc.text('Budget Reviewer', centerSig, curY, textOpt({ fontSize: 7 }));
      pdfDoc.text('Budget Approver', rightSig, curY, textOpt({ fontSize: 7 }));

      pdfDoc.endPage().endPDF((err) => {
        if (err) {
          if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
          return;
        }
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Consolidated_MOOE_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`);
        const stream = fs.createReadStream(tmpFilePath);
        stream.on('error', (e) => { if (!res.headersSent) res.status(500).json({ message: 'Stream error', error: e.message }); });
        res.on('finish', () => fs.unlink(tmpFilePath, () => {}));
        stream.pipe(res);
      });
    } catch (error) {
      console.error('Error generating consolidated MOOE PDF:', error);
      if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate consolidated MOOE PDF', error: error.message });
    }
  },
  // Export consolidated data (placeholder for future implementation)
  exportConsolidatedData: async (req, res) => {
    try {
      const { format = 'json', regions, fiscalYear, budgetType } = req.query;
      // For now, just return the data - can be extended to generate Excel/PDF
      const consolidatedController = require('./consolidatedReportsController');
      // Reuse the getConsolidatedData logic
      req.query = { regions, fiscalYear, budgetType };
      // This is a simplified approach - in production, you'd want to generate actual files
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