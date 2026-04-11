const fs = require('fs');
const os = require('os');
const path = require('path');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Region = require('../models/Region');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}

const consolidatedCapitalOutlayController = {
  // Get consolidated Capital Outlay data for all or specific regions
  getConsolidatedCapitalOutlayData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      
      let regionFilter = {};
      
      if (req.submissionWorkflowFilters) {
        Object.assign(regionFilter, req.submissionWorkflowFilters);
      } else if (req.hierarchicalAccess) {
        const accessInfo = req.hierarchicalAccess;
        
        if (accessInfo?.scope === 'DIVISION') {
          if (accessInfo.accessibleRegions?.[0]?.regionName) {
            regionFilter.region = accessInfo.accessibleRegions[0].regionName;
          }
          if (accessInfo.accessibleDepartments?.[0]?.departmentName) {
            regionFilter.department = accessInfo.accessibleDepartments[0].departmentName;
          }
          if (accessInfo.accessibleDivisions?.[0]) {
            regionFilter.division = accessInfo.accessibleDivisions[0];
          }
        } else if (accessInfo?.scope === 'DEPARTMENT') {
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          const baseDepartment = accessInfo.accessibleDepartments?.[0]?.departmentName;
          
          if (baseRegion && baseDepartment) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                { department: baseDepartment },
                {
                  $or: [
                    { $and: [{ $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }] },
                    {
                      $and: [
                        { division: { $exists: true, $ne: null, $ne: "" } },
                        { status: { $in: ["Submitted", "Approved", "Completed"] } }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        } else if (accessInfo?.scope === 'REGION') {
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          if (baseRegion) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
              ]
            };
          }
        } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
          regionFilter.region = accessInfo.accessibleRegions[0].regionName;
        }
      }
      
      if (regions && !regionFilter.$and) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter.region = { $in: regionList };
      }

      const { department: deptParam, division: divParam } = req.query;
      const coQuery = { ...regionFilter };
      if (fiscalYear) coQuery.fiscalYear = fiscalYear;
      if (budgetType) coQuery.budgetType = budgetType;
      // Allow explicit department/division filter from query (e.g. Tier page)
      if (deptParam && !coQuery.department && !coQuery.$and) {
        coQuery.department = new RegExp(`^${String(deptParam).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      if (divParam && !coQuery.division && !coQuery.$and) {
        coQuery.division = new RegExp(`^${String(divParam).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }

      const coData = await CapitalOutlay.find(coQuery).populate('category', 'categoryName').lean();

      const parentIds = coData.map((c) => c._id);
      const allDetails = await CapitalOutlayDetails.find({ capital_outlay_id: { $in: parentIds } })
        .sort({ createdAt: 1 })
        .lean();

      const detailsByParentId = {};
      allDetails.forEach((d) => {
        // Parentheses added to fix potential ambiguity (though only ?? used here, it's good practice)
        const pid = (d.capital_outlay_id?.toString?.()) ?? d.capital_outlay_id;
        if (!detailsByParentId[pid]) detailsByParentId[pid] = [];
        detailsByParentId[pid].push(d);
      });

      const regionGroups = {};
      let grandTotal = 0;

      coData.forEach((parent) => {
        const regionName = parent.region || 'Unknown Region';
        if (!regionGroups[regionName]) regionGroups[regionName] = [];
        const details = detailsByParentId[parent._id.toString()];
        
        if (Array.isArray(details) && details.length > 0) {
          const categoryGroup = parent.sublineItem || parent.accountingTitle || (parent.category && parent.category.categoryName) || 'Other';
          details.forEach((d) => {
            const incomeAmt = Number(d.income_amount) || 0;
            const subsidyAmt = Number(d.subsidy_amount) || 0;
            const amount = incomeAmt + subsidyAmt;
            const expanded = {
              ...parent,
              _id: d._id,
              particulars: d.particulars || '',
              sublineItem: d.particulars || parent.sublineItem,
              categoryGroup,
              income: incomeAmt,
              subsidy: subsidyAmt,
              cost: amount,
              amount,
              uacsCode: `${parent.uacsCode || parent._id}-${d._id}`,
            };
            regionGroups[regionName].push(expanded);
            grandTotal += amount;
          });
        } else {
          const amount = (Number(parent.amount) ?? (Number(parent.cost) || 0)) || ((Number(parent.income) || 0) + (Number(parent.subsidy) || 0));
          regionGroups[regionName].push({ ...parent, amount });
          grandTotal += amount;
        }
      });

      const formattedData = Object.keys(regionGroups).map((regionName) => {
        const items = regionGroups[regionName];
        // FIX 2: Wrapped ?? and || in parentheses
        const total = items.reduce((sum, item) => sum + (Number(item.amount) ?? (Number(item.cost) || 0)), 0);
        return { region: regionName, items, total, count: items.length };
      });

      const totalEntries = Object.values(regionGroups).reduce((s, arr) => s + arr.length, 0);
      
      return res.status(200).json({
        success: true,
        data: formattedData,
        summary: {
          totalRegions: Object.keys(regionGroups).length,
          totalEntries,
          grandTotal
        },
        filters: {
          fiscalYear,
          budgetType,
          regions: regions || 'All'
        }
      });

    } catch (error) {
      console.error('Error in getConsolidatedCapitalOutlayData:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

// ── PDF Generation ────────────────────────────────────────────────────────────
const getConsolidatedCapitalOutlayPdf = async (req, res) => {
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

    // Reuse existing data-fetching logic ─────────────────────────────────────
    let regionFilter = {};
    if (req.submissionWorkflowFilters) {
      Object.assign(regionFilter, req.submissionWorkflowFilters);
    }
    // Always apply explicit region list from query params (mirrors getConsolidatedCapitalOutlayData logic)
    if (regionList && regionList.length && !regionFilter.$and) {
      regionFilter.region = { $in: regionList };
    }

    const coQuery = { ...regionFilter };
    if (fiscalYear) coQuery.fiscalYear = fiscalYear;
    if (budgetType) coQuery.budgetType = budgetType;
    if (department) coQuery.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (division)   coQuery.division   = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const coData = await CapitalOutlay.find(coQuery).populate('category', 'categoryName').lean();
    const parentIds = coData.map((c) => c._id);
    const allDetails = await CapitalOutlayDetails.find({ capital_outlay_id: { $in: parentIds } }).sort({ createdAt: 1 }).lean();

    // Resolve workflow signatories from the first linked NewProposalWorkflow
    let preparedByName = '';
    let notedByName = '';
    let approvedByName = '';
    const workflowRefId = coData.map((c) => c.workflowRef).filter(Boolean)[0];
    if (workflowRefId) {
      const workflow = await NewProposalWorkflow.findById(workflowRefId)
        .select('createdByName workflowHistory')
        .lean();
      if (workflow) {
        preparedByName = workflow.createdByName || '';
        const notedEntry = (workflow.workflowHistory || [])
          .find((h) => h.toStatus === 'FORWARDED_TO_APPROVER');
        if (notedEntry) notedByName = notedEntry.performedByName || '';
        const approvedEntry = (workflow.workflowHistory || [])
          .find((h) => h.toStatus === 'FINALIZED');
        if (approvedEntry) approvedByName = approvedEntry.performedByName || '';
      }
    }

    const detailsByParentId = {};
    allDetails.forEach((d) => {
      const pid = (d.capital_outlay_id?.toString?.()) ?? d.capital_outlay_id;
      if (!detailsByParentId[pid]) detailsByParentId[pid] = [];
      detailsByParentId[pid].push(d);
    });

    // Build per-region, per-category row list ─────────────────────────────────
    const regionGroups = {};
    coData.forEach((parent) => {
      const regionName = parent.region || 'Unknown Region';
      if (!regionGroups[regionName]) regionGroups[regionName] = {};
      const categoryKey = parent.sublineItem || parent.accountingTitle || (parent.category && parent.category.categoryName) || 'Other';
      if (!regionGroups[regionName][categoryKey]) regionGroups[regionName][categoryKey] = [];

      const details = detailsByParentId[parent._id.toString()];
      if (Array.isArray(details) && details.length > 0) {
        details.forEach((d) => {
          regionGroups[regionName][categoryKey].push({
            particulars: d.particulars || '',
            uacsCode: parent.uacsCode || '',
            income: Number(d.income_amount) || 0,
            subsidy: Number(d.subsidy_amount) || 0,
            cost: (Number(d.income_amount) || 0) + (Number(d.subsidy_amount) || 0),
          });
        });
      } else {
        const cost = Number(parent.amount) || (Number(parent.income) || 0) + (Number(parent.subsidy) || 0);
        regionGroups[regionName][categoryKey].push({
          particulars: parent.sublineItem || parent.accountingTitle || '',
          uacsCode: parent.uacsCode || '',
          income: Number(parent.income) || 0,
          subsidy: Number(parent.subsidy) || 0,
          cost,
        });
      }
    });

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const tmpFilePath = path.join(os.tmpdir(), `co_report_${Date.now()}.pdf`);

    const pdfSecurityEnabled = String(process.env.COMPREHENSIVE_PDF_SECURITY_ENABLED || 'true').toLowerCase() !== 'false';
    const pdfOwnerPassword = process.env.COMPREHENSIVE_PDF_OWNER_PASSWORD || `FMIS-CO-${String(fiscalYear || 'ALL')}`;
    const pdfUserPassword = process.env.COMPREHENSIVE_PDF_USER_PASSWORD || '';
    const userProtectionFlag = Number(process.env.COMPREHENSIVE_PDF_USER_PROTECTION_FLAG || '0');

    const recipeOptions = {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Consolidated Capital Outlay Report',
      subject: `Capital Outlay - FY ${fiscalYear || 'All Years'}`,
    };
    if (pdfSecurityEnabled) {
      recipeOptions.userPassword = pdfUserPassword;
      recipeOptions.ownerPassword = pdfOwnerPassword;
      recipeOptions.userProtectionFlag = Number.isFinite(userProtectionFlag) ? userProtectionFlag : 0;
    }

    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);

    const PAGE_WIDTH  = 595.28; // A4 portrait width (points)
    const PAGE_HEIGHT = 841.89; // A4 portrait height (points)
    const MARGIN      = 36;
    const CONTENT_LEFT  = MARGIN;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
    const LINE_H = 13;

    let curY = MARGIN;
    let pageNo = 1;

    const textOpt = (o = {}) => ({ color: '#000000', ...o });
    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
    const requesterLabel = safeStr(req.user?.name || req.user?.UserName || req.user?.id || 'Authorized User');
    const watermarkText = process.env.COMPREHENSIVE_PDF_WATERMARK_TEXT || `FMIS CONFIDENTIAL • ${requesterLabel}`;
    const formatPhp = (n) => Number(n || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });

    const resolveExisting = (...candidates) => {
      for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
      return null;
    };
    const sealPath        = resolveExisting(path.join(__dirname, '../assets/Seal.png'),            path.join(process.cwd(), 'SERVER/assets/Seal.png'),            path.join(process.cwd(), 'CLIENT/public/Seal.png'));
    const nialogoPath     = resolveExisting(path.join(__dirname, '../assets/logo.png'),            path.join(process.cwd(), 'SERVER/assets/logo.png'),            path.join(process.cwd(), 'CLIENT/public/logo.png'));
    const bagongPath      = resolveExisting(path.join(__dirname, '../assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png'));

    const drawPage = (isFirst) => {
      const cx = PAGE_WIDTH / 2;
      const cy = PAGE_HEIGHT / 2;

      // Border
      pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, { stroke: '#4d4c4c', lineWidth: 1.5 });

      // Watermark
      pdfDoc.text(watermarkText, cx, cy - 18, textOpt({ fontSize: 30, color: '#d9d9d9', align: 'center' }));
      pdfDoc.text(`Generated ${new Date().toLocaleString('en-US')}`, cx, cy + 15, textOpt({ fontSize: 12, color: '#dddddd', align: 'center' }));

      // Footer
      pdfDoc.text('Annex E (Capital Outlay)', CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN - 12, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Page ${pageNo}`, CONTENT_RIGHT - 55, PAGE_HEIGHT - MARGIN - 12, textOpt({ fontSize: 8 }));

      if (!isFirst) return;

      // Logos
      const logoW = 44, logoH = 44, logoY = MARGIN + 2;
      if (sealPath)    { try { pdfDoc.image(sealPath,    CONTENT_LEFT, logoY, { width: logoW, height: logoH }); } catch(e) {} }
      if (nialogoPath) { try { pdfDoc.image(nialogoPath, CONTENT_LEFT + logoW + 5, logoY, { width: logoW, height: logoH }); } catch(e) {} }
      if (bagongPath)  { try { pdfDoc.image(bagongPath,  CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH }); } catch(e) {} }

      // Header text
      let hy = logoY + 6;
      pdfDoc.text('Republic of the Philippines', cx, hy, textOpt({ fontSize: 10, align: 'center' }));
      hy += LINE_H;
      pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
      hy += LINE_H;
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
      hy += LINE_H;
      let regionLabel = regionList && regionList.length ? regionList.join(', ') : 'ALL REGIONS';
      if (department) regionLabel += `  |  Dept: ${department}`;
      if (division)   regionLabel += `  >  Div: ${division}`;
      pdfDoc.text(regionLabel, cx, hy, textOpt({ fontSize: 9, align: 'center' }));

      if (bagongPath) pdfDoc.text('ANNEX E', CONTENT_RIGHT - 62, MARGIN + logoH + 2, textOpt({ fontSize: 13, bold: true }));

      curY = hy + LINE_H * 1.3;

      // Title
      pdfDoc.text('CONSOLIDATED CAPITAL OUTLAY REPORT', cx, curY, textOpt({ fontSize: 15, bold: true, align: 'center' }));
      curY += LINE_H * 1.2;
      pdfDoc.text(`Fiscal Year: ${safeStr(fiscalYear) || 'All Years'}  |  Budget Type: ${safeStr(budgetType) || 'All'}`, cx, curY, textOpt({ fontSize: 10, align: 'center' }));
      curY += LINE_H * 1.8;
    };

    const startNewPage = () => {
      pdfDoc.endPage();
      pageNo++;
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      curY = MARGIN + 20;
      drawPage(false);
    };

    const ensureSpace = (lines = 1) => {
      if (curY + lines * LINE_H > PAGE_HEIGHT - MARGIN - 22) startNewPage();
    };

    // Column widths (portrait)
    const COL_REGION   = 70;
    const COL_UACS     = 65;
    const COL_INCOME   = 75;
    const COL_SUBSIDY  = 75;
    const COL_COST     = 75;
    const COL_TITLE    = CONTENT_RIGHT - CONTENT_LEFT - COL_REGION - COL_UACS - COL_INCOME - COL_SUBSIDY - COL_COST;

    const colX = {
      region:  CONTENT_LEFT,
      uacs:    CONTENT_LEFT + COL_REGION,
      title:   CONTENT_LEFT + COL_REGION + COL_UACS,
      income:  CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE,
      subsidy: CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE + COL_INCOME,
      cost:    CONTENT_LEFT + COL_REGION + COL_UACS + COL_TITLE + COL_INCOME + COL_SUBSIDY,
    };

    const drawTableHeader = () => {
      ensureSpace(2);
      const cellStyle = { fontSize: 8, bold: true, color: '#000000' };
      pdfDoc.rectangle(colX.region, curY - 3, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 4, { stroke: '#4d4c4c', lineWidth: 0.5 });
      pdfDoc.text('REGION',      colX.region  + 3, curY, textOpt(cellStyle));
      pdfDoc.text('UACS CODE',   colX.uacs    + 3, curY, textOpt(cellStyle));
      pdfDoc.text('PROJECT / PARTICULARS', colX.title + 3, curY, textOpt(cellStyle));
      pdfDoc.text('INCOME',      colX.income  + 3, curY, textOpt(cellStyle));
      pdfDoc.text('SUBSIDY',     colX.subsidy + 3, curY, textOpt(cellStyle));
      pdfDoc.text('TOTAL COST',  colX.cost    + 3, curY, textOpt(cellStyle));
      curY += LINE_H + 4;
    };

    // First page
    pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    drawPage(true);
    drawTableHeader();

    let grandIncome = 0, grandSubsidy = 0, grandCost = 0;

    for (const [regionName, categories] of Object.entries(regionGroups)) {
      let regionFirstRow = true;
      for (const [catName, rows] of Object.entries(categories)) {
        // Category header row
        ensureSpace(2);
        pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 2, { stroke: '#c0d0c0', lineWidth: 0.3 });
        pdfDoc.text(regionFirstRow ? regionName : '', colX.region + 3, curY, textOpt({ fontSize: 8, bold: true }));
        pdfDoc.text(catName, colX.uacs + 3, curY, textOpt({ fontSize: 8, bold: true }), { columnWidth: COL_TITLE + COL_UACS - 6, overflow: 'truncate' });
        curY += LINE_H + 2;
        regionFirstRow = false;

        let catIncome = 0, catSubsidy = 0, catCost = 0;
        for (const row of rows) {
          ensureSpace(1);
          pdfDoc.text('', colX.region  + 3, curY, textOpt({ fontSize: 7.5 }));
          pdfDoc.text(safeStr(row.uacsCode),   colX.uacs    + 3, curY, textOpt({ fontSize: 7.5 }));
          pdfDoc.text(safeStr(row.particulars), colX.title   + 3, curY, textOpt({ fontSize: 7.5 }), { columnWidth: COL_TITLE - 6, overflow: 'truncate' });
          pdfDoc.text(formatPhp(row.income),   colX.income  + COL_INCOME  - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
          pdfDoc.text(formatPhp(row.subsidy),  colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
          pdfDoc.text(formatPhp(row.cost),     colX.cost    + COL_COST    - 5, curY, textOpt({ fontSize: 7.5, align: 'right' }));
          curY += LINE_H;
          catIncome += row.income; catSubsidy += row.subsidy; catCost += row.cost;
        }

        // Category subtotal
        ensureSpace(1);
        pdfDoc.rectangle(colX.region, curY - 1, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 1, { stroke: '#9e9e9e', lineWidth: 0.4 });
        pdfDoc.text(`Subtotal: ${catName}`, colX.uacs + 3, curY, textOpt({ fontSize: 7.5, bold: true }));
        pdfDoc.text(formatPhp(catIncome),  colX.income  + COL_INCOME  - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
        pdfDoc.text(formatPhp(catSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
        pdfDoc.text(formatPhp(catCost),    colX.cost    + COL_COST    - 5, curY, textOpt({ fontSize: 7.5, bold: true, align: 'right' }));
        curY += LINE_H + 2;
        grandIncome += catIncome; grandSubsidy += catSubsidy; grandCost += catCost;
      }
      curY += 4; // breathing space between regions
    }

    // Grand Total row
    ensureSpace(2);
    pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 4, { stroke: '#4d4c4c', lineWidth: 0.6 });
    pdfDoc.text('GRAND TOTAL', colX.region + 3, curY, textOpt({ fontSize: 9, bold: true }));
    pdfDoc.text(formatPhp(grandIncome),  colX.income  + COL_INCOME  - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
    pdfDoc.text(formatPhp(grandSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
    pdfDoc.text(formatPhp(grandCost),    colX.cost    + COL_COST    - 5, curY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
    curY += LINE_H + 6;

    // Prepared by / Noted by / Approved by — 3-column signature block
    ensureSpace(8);
    curY += LINE_H * 2;
    const sigLineW  = 140;
    const leftSig   = CONTENT_LEFT + 10;
    const centerSig = (CONTENT_LEFT + CONTENT_RIGHT) / 2 - sigLineW / 2;
    const rightSig  = CONTENT_RIGHT - sigLineW - 10;

    pdfDoc.text('Prepared by:',  leftSig,   curY, textOpt({ fontSize: 8 }));
    pdfDoc.text('Noted by:',     centerSig, curY, textOpt({ fontSize: 8 }));
    pdfDoc.text('Approved by:',  rightSig,  curY, textOpt({ fontSize: 8 }));
    curY += LINE_H * 3;

    pdfDoc.rectangle(leftSig,   curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
    pdfDoc.rectangle(centerSig, curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
    pdfDoc.rectangle(rightSig,  curY, sigLineW, 0.5, { fill: '#000000', stroke: '#000000' });
    curY += LINE_H * 0.6;

    pdfDoc.text(preparedByName  || '________________________', leftSig,   curY, textOpt({ fontSize: 8, bold: !!preparedByName }));
    pdfDoc.text(notedByName     || '________________________', centerSig, curY, textOpt({ fontSize: 8, bold: !!notedByName }));
    pdfDoc.text(approvedByName  || '________________________', rightSig,  curY, textOpt({ fontSize: 8, bold: !!approvedByName }));
    curY += LINE_H;

    pdfDoc.text('Budget Preparer',  leftSig,   curY, textOpt({ fontSize: 7, color: '#666666' }));
    pdfDoc.text('Budget Reviewer',  centerSig, curY, textOpt({ fontSize: 7, color: '#666666' }));
    pdfDoc.text('Budget Approver',  rightSig,  curY, textOpt({ fontSize: 7, color: '#666666' }));
    curY += LINE_H;

    pdfDoc.text(new Date().toLocaleDateString('en-PH'), leftSig, curY, textOpt({ fontSize: 7, color: '#666666' }));

    // Finalize
    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        console.error('Error finalizing Capital Outlay PDF:', err);
        if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
        return;
      }
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Capital_Outlay_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`);
      const stream = fs.createReadStream(tmpFilePath);
      stream.on('error', (e) => { if (!res.headersSent) res.status(500).json({ message: 'Stream error', error: e.message }); });
      res.on('finish', () => fs.unlink(tmpFilePath, () => {}));
      stream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating Capital Outlay PDF:', error);
    if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate Capital Outlay PDF', error: error.message });
  }
};

consolidatedCapitalOutlayController.getConsolidatedCapitalOutlayPdf = getConsolidatedCapitalOutlayPdf;

const getAvailableDepartments = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (region)     query.region = region;
    const departments = await CapitalOutlay.distinct('department', { ...query, department: { $exists: true, $nin: [null, ''] } });
    return res.json({ departments: departments.filter(Boolean).sort() });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch departments', error: err.message });
  }
};

const getAvailableDivisions = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region, department } = req.query;
    const query = {};
    if (fiscalYear)  query.fiscalYear = fiscalYear;
    if (budgetType)  query.budgetType = budgetType;
    if (region)      query.region = region;
    if (department)  query.department = department;
    const divisions = await CapitalOutlay.distinct('division', { ...query, division: { $exists: true, $nin: [null, ''] } });
    return res.json({ divisions: divisions.filter(Boolean).sort() });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch divisions', error: err.message });
  }
};

consolidatedCapitalOutlayController.getAvailableDepartments = getAvailableDepartments;
consolidatedCapitalOutlayController.getAvailableDivisions = getAvailableDivisions;

const getAvailableRegionsCapitalOutlay = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    const regions = await CapitalOutlay.distinct('region', { ...query, region: { $exists: true, $nin: [null, ''] } });
    return res.json({ regions: regions.filter(Boolean).sort() });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch regions', error: err.message });
  }
};
consolidatedCapitalOutlayController.getAvailableRegionsCapitalOutlay = getAvailableRegionsCapitalOutlay;

module.exports = consolidatedCapitalOutlayController;