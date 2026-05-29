const fs = require('fs');
const os = require('os');
const path = require('path');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
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

// ─── Workflow-status-based scoping ───────────────────────────────────────────
const VISIBLE_STATUSES_BY_ROLE_CO = {
  BUDGET_PREPARER:         ['DRAFT', 'FORWARDED_TO_REVIEWER','FORWARDED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PREPARER','RETURNED_TO_REVIEWER','RETURNED_TO_APPROVER','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_REVIEWER:         ['FORWARDED_TO_REVIEWER','RETURNED_TO_REVIEWER','FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_APPROVER:         ['FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_PLANNING_ANALYST: ['FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_OFFICER:          ['FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_OFFICER'],
  BUDGET_MANAGER:          null,
  SUPER_ADMIN:             null,
  OVERALL_BUDGET_APPROVER: null,
};
const FULL_ACCESS_ROLES_CO = new Set([
  'SUPER_ADMIN','SUPER ADMIN','BUDGET_MANAGER','BUDGET MANAGER',
  'OVERALL_BUDGET_APPROVER','OVERALL BUDGET APPROVER',
  'BUDGET_ADMIN','BUDGET ADMIN',
]);
const normalizeRoleCO = (r) => String(r || '').trim().replace(/\s+/g, '_').toUpperCase();

const getVisibleWorkflowIdsCO = async (req, { fiscalYear, budgetType, regions } = {}) => {
  const userRoles = (req.user?.Roles || req.user?.roles || []).map(normalizeRoleCO);
  if (userRoles.some(r => FULL_ACCESS_ROLES_CO.has(r))) return null;

  let visibleStatuses = null;
  for (const [roleKey, statuses] of Object.entries(VISIBLE_STATUSES_BY_ROLE_CO)) {
    if (userRoles.includes(roleKey)) {
      if (statuses === null) return null;
      if (!visibleStatuses) {
        visibleStatuses = new Set(statuses);
      } else {
        statuses.forEach(s => visibleStatuses.add(s));
      }
    }
  }
  if (!visibleStatuses) visibleStatuses = new Set(VISIBLE_STATUSES_BY_ROLE_CO.BUDGET_PREPARER);

  const npwQuery = { status: { $in: [...visibleStatuses] } };
  if (fiscalYear) npwQuery.fiscalYear = Number(fiscalYear) || parseInt(fiscalYear, 10);
  if (budgetType) {
    const typeMap = { NEP: 'NEP', GAA: 'GAA' };
    npwQuery.modelType = typeMap[String(budgetType).toUpperCase()] || 'Initial';
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    if (regionDocs.length) npwQuery.region = { $in: regionDocs.map(r => r._id) };
  }

  const isPreparerReviewer = userRoles.some(r => ['BUDGET_PREPARER','BUDGET_REVIEWER','BUDGET_APPROVER'].includes(r));
  if (isPreparerReviewer) {
    const userId = String(req.user?.id || req.user?.userId || '');
    if (userId) {
      try {
        const hua = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName').lean();
        if (hua) {
          const dept = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName;
          const div  = hua.divisionName || '';
          const level = String(hua.assignmentLevel || '').toUpperCase();
          if (dept && !['BUDGET_AND_REVENUE_DIVISION','REGION','FULL'].includes(level)) {
            npwQuery.department = dept;
            if (div && level === 'DIVISION') npwQuery.division = div;
          }
        }
      } catch (_) {}
    }
  }

  const docs = await NewProposalWorkflow.find(npwQuery).select('_id').lean();
  return docs.map(d => d._id);
};
// ─────────────────────────────────────────────────────────────────────────────

const consolidatedCapitalOutlayController = {
  // Get consolidated Capital Outlay data for all or specific regions
  getConsolidatedCapitalOutlayData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;

      // --- ENHANCED USER & ORG DETECTION ---
      const user = req.user || {};
      const userId = user.id || user.userId || user._id || user.UserId;
      const userRoles = user.roles || user.Roles || [];
      const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));

      let forcedDept = req.query.department || req.submissionWorkflowData?.department || req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;

      // Emergency DB lookup if department scope is missing
      if (!isSuperAdmin && !forcedDept && userId) {
        try {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
            .populate('departmentId').lean();
          if (assignment) {
            forcedDept = assignment.departmentId?.departmentName || assignment.departmentId?.Department || assignment.departmentId?.DepartmentName;
            console.log(`[CO_REPORT] Emergency lookup User=${userId}: Dept=${forcedDept}`);
          }
        } catch (_) {}
      }

      let regionFilter = {};
      if (req.submissionWorkflowFilters) {
        Object.assign(regionFilter, req.submissionWorkflowFilters);
      } else if (req.hierarchicalAccess) {
        const accessInfo = req.hierarchicalAccess;
        if (accessInfo?.accessibleRegions?.[0]?.regionName) {
          regionFilter.region = accessInfo.accessibleRegions[0].regionName;
        }
      }

      if (regions && !regionFilter.$and) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter.region = { $in: regionList };
      }

      const coQuery = { ...regionFilter };
      if (fiscalYear) coQuery.fiscalYear = fiscalYear;
      if (budgetType) coQuery.budgetType = budgetType;

      // STRICT department filter for non-admins
      if (forcedDept && !isSuperAdmin) {
        coQuery.department = new RegExp(`^${String(forcedDept).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      } else if (req.query.division) {
        coQuery.division = new RegExp(`^${String(req.query.division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }

      // ── Workflow-status scope filter ────────────────────────────────────
      const visibleWorkflowIds = await getVisibleWorkflowIdsCO(req, { fiscalYear, budgetType, regions });
      if (visibleWorkflowIds !== null) {
        if (visibleWorkflowIds.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            summary: { totalCategories: 0, totalEntries: 0, grandTotal: 0 },
            filters: { fiscalYear, budgetType, regions: regions || 'All', department: forcedDept }
          });
        }
        coQuery.workflowRef = { $in: visibleWorkflowIds };
      }
      // ────────────────────────────────────────────────────────────────────

      console.log(`[CO_REPORT_DATA] ForcedDept=${forcedDept} Query=`, JSON.stringify(coQuery));

      const coData = await CapitalOutlay.find(coQuery).populate('category', 'categoryName').lean();

      const parentIds = coData.map((c) => c._id);
      const allDetails = await CapitalOutlayDetails.find({ capital_outlay_id: { $in: parentIds } })
        .sort({ createdAt: 1 })
        .lean();

      const detailsByParentId = {};
      allDetails.forEach((d) => {
        const pid = (d.capital_outlay_id?.toString?.()) ?? d.capital_outlay_id;
        if (!detailsByParentId[pid]) detailsByParentId[pid] = [];
        detailsByParentId[pid].push(d);
      });

      // GROUP BY TITLE (category header like "ACQUISITION OF FURNITURE & FIXTURES AND BOOKS")
      const titleGroups = {};
      let grandTotal = 0;

      coData.forEach((parent) => {
        // GROUP BY categoryName from the Category collection (e.g., "ACQUISITION OF FURNITURE & FIXTURES AND BOOKS")
        const titleKey = (parent.category?.categoryName) || parent.accountingTitle || parent.sublineItem || 'Other';
        if (!titleGroups[titleKey]) titleGroups[titleKey] = [];

        const details = detailsByParentId[parent._id.toString()];
        if (Array.isArray(details) && details.length > 0) {
          details.forEach((d) => {
            const incomeAmt = Number(d.income_amount) || 0;
            const subsidyAmt = Number(d.subsidy_amount) || 0;
            const amount = incomeAmt + subsidyAmt;
            
            // Skip items with zero total
            if (amount <= 0) return;

            if (!titleGroups[titleKey]) titleGroups[titleKey] = [];
            titleGroups[titleKey].push({
              _id: d._id,
              particulars: d.particulars || '',
              department: parent.department || '',
              division: parent.division || '',
              region: parent.region || '',
              uacsCode: parent.uacsCode || '',
              income: incomeAmt,
              subsidy: subsidyAmt,
              cost: amount,
              amount,
            });
            grandTotal += amount;
          });
        } else {
          const incomeAmt = Number(parent.income) || 0;
          const subsidyAmt = Number(parent.subsidy) || 0;
          const amount = (Number(parent.amount) || 0) || (incomeAmt + subsidyAmt);

          // Skip items with zero total
          if (amount <= 0) return;

          if (!titleGroups[titleKey]) titleGroups[titleKey] = [];
          titleGroups[titleKey].push({
            _id: parent._id,
            particulars: parent.sublineItem || parent.accountingTitle || titleKey,
            department: parent.department || '',
            division: parent.division || '',
            region: parent.region || '',
            uacsCode: parent.uacsCode || '',
            income: incomeAmt,
            subsidy: subsidyAmt || amount,
            cost: amount,
            amount,
          });
          grandTotal += amount;
        }
      });

      const formattedData = Object.keys(titleGroups).map((titleName) => {
        const items = titleGroups[titleName];
        const total = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
        return { category: titleName, region: items[0]?.region || '', items, total, count: items.length };
      });

      const totalEntries = Object.values(titleGroups).reduce((s, arr) => s + arr.length, 0);

      return res.status(200).json({
        success: true,
        data: formattedData,
        summary: {
          totalCategories: Object.keys(titleGroups).length,
          totalEntries,
          grandTotal
        },
        filters: { fiscalYear, budgetType, regions: regions || 'All', department: forcedDept }
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
    const generateDocumentId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `CCO-${timestamp}-${random}`.toUpperCase();
    };
    const documentId = generateDocumentId();

    const { regions, fiscalYear, budgetType } = req.query;
    let { department, division } = req.query;
    
    // --- SECURITY OVERRIDE FOR PDF: enforce dept scope same as data endpoint ---
    const userId   = req.user?.id || req.user?.userId || req.user?._id || req.user?.UserId;
    const userRoles = req.user?.roles || req.user?.Roles || [];

    // Region-wide roles: Super Admins + Budget & Revenue Division (BRD) roles
    const REGION_WIDE_ROLES = [
      'SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER',
      'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST',
      'BUDGET_OFFICER', 'BUDGET OFFICER',
      'OVERALL_BUDGET_APPROVER', 'OVERALL BUDGET APPROVER',
      'BUDGET_ADMIN', 'BUDGET ADMIN',
    ];
    let isSuperAdmin = userRoles.some(r => REGION_WIDE_ROLES.includes(r));

    if (!isSuperAdmin) {
      // Try middleware first
      let assignedDept = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName
        || req.submissionWorkflowData?.department
        || req.submissionWorkflowFilters?.department;
      let assignedDiv = req.hierarchicalAccess?.accessibleDivisions?.[0]
        || req.submissionWorkflowData?.division;

      // Emergency DB lookup if middleware didn't provide dept
      if (userId) {
        try {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
            .populate('departmentId').lean();
          if (assignment) {
            const level = assignment.assignmentLevel || '';
            // BRD / Region-level → treat same as super admin (full region, no dept filter)
            const isRegionLevel = ['BUDGET_AND_REVENUE_DIVISION', 'REGION', 'FULL'].includes(level);
            if (isRegionLevel) {
              isSuperAdmin = true;
              console.log(`[CO_PDF] BRD/Region-level user=${userId} level=${level} → region-wide access`);
            } else if (!assignedDept) {
              assignedDept = assignment.departmentId?.departmentName
                || assignment.departmentId?.Department
                || assignment.departmentId?.DepartmentName;
              assignedDiv  = assignedDiv || assignment.divisionName || assignment.division;
              console.log(`[CO_PDF] Emergency lookup User=${userId}: Dept=${assignedDept} Level=${level}`);
            }
          }
        } catch (_) {}
      }

      if (!isSuperAdmin) {
        // Hard block: non-admin with no dept = 403
        if (!assignedDept) {
          return res.status(403).json({
            message: 'Cannot generate PDF: your organizational scope could not be determined. Please contact your administrator.'
          });
        }
        // Override any query params with the scoped values
        department = assignedDept;
        if (assignedDiv) division = assignedDiv;
      }
    }

    // Track what to SHOW in the PDF header (only explicitly scoped values)
    // Super admins generating a full-region report should NOT show dept/div in header
    const headerDept = isSuperAdmin ? null : department;
    const headerDiv  = isSuperAdmin ? null : division;

    const regionList = regions ? (Array.isArray(regions) ? regions : [regions]) : null;

    let regionFilter = {};
    if (req.submissionWorkflowFilters) {
      Object.assign(regionFilter, req.submissionWorkflowFilters);
    }
    if (regionList && regionList.length && !regionFilter.$and) {
      regionFilter.region = { $in: regionList };
    }

    const coQuery = { ...regionFilter };
    if (fiscalYear)  coQuery.fiscalYear  = fiscalYear;
    if (budgetType)  coQuery.budgetType  = budgetType;
    if (department)  coQuery.department  = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (division)    coQuery.division    = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    console.log(`[CO_PDF] User=${userId} isSuperAdmin=${isSuperAdmin} Dept=${department} Div=${division} Query=`, JSON.stringify(coQuery));

    const coData = await CapitalOutlay.find(coQuery).populate('category', 'categoryName').lean();

    // Fallback labels for query only (NOT shown in header for super admins)
    const _fallbackDept = (!department && coData.length > 0) ? coData[0].department : department;
    const _fallbackDiv  = (!division   && coData.length > 0) ? coData[0].division   : division;

    const parentIds = coData.map((c) => c._id);
    const allDetails = await CapitalOutlayDetails.find({ capital_outlay_id: { $in: parentIds } }).sort({ createdAt: 1 }).lean();

    // Resolve workflow signatories
    let signatoriesInfo = extractSignatoriesFromWorkflow(null);
    const workflowRefId = coData.map((c) => c.workflowRef).filter(Boolean)[0];
    if (workflowRefId) {
      const workflow = await NewProposalWorkflow.findById(workflowRefId)
        .select('createdByName workflowHistory')
        .lean();
      if (workflow) {
        signatoriesInfo = extractSignatoriesFromWorkflow(workflow);
      }
    }

    // Fallback: if no workflow (bulk-uploaded data), use username_process or req.user
    if (!signatoriesInfo.preparer?.name) {
      const uploaderName = coData.find(c => c.username_process)?.username_process
        || req.user?.name || req.user?.UserName || req.user?.username || '';
      if (uploaderName && signatoriesInfo.preparer) {
        signatoriesInfo.preparer.name = uploaderName;
      }
    }

    // --- OVERRIDE LABELS ---
    if (signatoriesInfo) {
      if (signatoriesInfo.preparer) signatoriesInfo.preparer.label = "Prepared by:";
      if (signatoriesInfo.reviewer) signatoriesInfo.reviewer.label = "Reviewed by:";
      if (signatoriesInfo.approver) signatoriesInfo.approver.label = "Approved by:";
    }

    const detailsByParentId = {};
    allDetails.forEach((d) => {
      const pid = (d.capital_outlay_id?.toString?.()) ?? d.capital_outlay_id;
      if (!detailsByParentId[pid]) detailsByParentId[pid] = [];
      detailsByParentId[pid].push(d);
    });

    // GROUP BY categoryName (Excel layout: category header → RC rows)
    const catGroups = {};
    coData.forEach((parent) => {
      const catKey = (parent.category?.categoryName) || parent.accountingTitle || parent.sublineItem || 'Other';
      const rcName = parent.department || parent.division || parent.region || '';
      const details = detailsByParentId[parent._id.toString()];

      if (Array.isArray(details) && details.length > 0) {
        details.forEach((d) => {
          const amt = (Number(d.income_amount) || 0) + (Number(d.subsidy_amount) || 0);
          if (amt > 0) {
            if (!catGroups[catKey]) catGroups[catKey] = {};
            const particulars = d.particulars || '';
            const rowKey = `${rcName}_${particulars}`;
            
            if (!catGroups[catKey][rowKey]) {
              catGroups[catKey][rowKey] = { rc: rcName, particulars: particulars, amount: 0 };
            }
            catGroups[catKey][rowKey].amount += amt;
          }
        });
      } else {
        const amt = (Number(parent.income) || 0) + (Number(parent.subsidy) || 0);
        if (amt > 0) {
          if (!catGroups[catKey]) catGroups[catKey] = {};
          const particulars = parent.sublineItem || parent.accountingTitle || '';
          const rowKey = `${rcName}_${particulars}`;
          
          if (!catGroups[catKey][rowKey]) {
            catGroups[catKey][rowKey] = { rc: rcName, particulars: particulars, amount: 0 };
          }
          catGroups[catKey][rowKey].amount += amt;
        }
      }
    });

    // Convert to arrays
    for (const catKey of Object.keys(catGroups)) {
      catGroups[catKey] = Object.values(catGroups[catKey]);
    }

    const tmpFilePath = path.join(os.tmpdir(), `co_report_${Date.now()}.pdf`);
    const tempSignatureImagePaths = [];

    const pdfSecurityEnabled = String(process.env.COMPREHENSIVE_PDF_SECURITY_ENABLED || 'true').toLowerCase() !== 'false';
    const pdfOwnerPassword = process.env.COMPREHENSIVE_PDF_OWNER_PASSWORD || `FMIS-CO-${String(fiscalYear || 'ALL')}`;
    const pdfUserPassword = process.env.COMPREHENSIVE_PDF_USER_PASSWORD || '';
    const userProtectionFlag = Number(process.env.COMPREHENSIVE_PDF_USER_PROTECTION_FLAG || '0');

    const recipeOptions = {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'CAPITAL OUTLAY',
      subject: `Capital Outlay - FY ${fiscalYear || 'All Years'}`,
    };
    if (pdfSecurityEnabled) {
      recipeOptions.userPassword = pdfUserPassword;
      recipeOptions.ownerPassword = pdfOwnerPassword;
      recipeOptions.userProtectionFlag = Number.isFinite(userProtectionFlag) ? userProtectionFlag : 0;
    }

    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);

    const PAGE_WIDTH  = 595.28; 
    const PAGE_HEIGHT = 841.89; 
    const MARGIN        = 18;   // reduced — closer to paper edge
    const CONTENT_LEFT  = MARGIN;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
    const LINE_H = 13;

    let curY = MARGIN;
    let pageNo = 1;

    const textOpt = (o = {}) => ({ color: '#000000', ...o });
    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';

    const wrapText = (text, maxWidth, fontSize) => {
      const words = String(text || '').split(' ');
      const lines = [];
      let currentLine = '';
      
      const getWidth = (t) => {
        try { return pdfDoc.calculateTextDimensions(t, { fontSize }).width; }
        catch (e) { return t.length * (fontSize * 0.55); }
      };

      words.forEach(word => {
        let testLine = currentLine ? `${currentLine} ${word}` : word;
        if (getWidth(testLine) > maxWidth) {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Very long single word - character level split
            let part = '';
            for (let char of word) {
              if (getWidth(part + char) > maxWidth) {
                lines.push(part);
                part = char;
              } else {
                part += char;
              }
            }
            currentLine = part;
          }
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const requesterLabel = safeStr(req.user?.name || req.user?.UserName || req.user?.id || 'Authorized User');
    const watermarkText = process.env.COMPREHENSIVE_PDF_WATERMARK_TEXT || `FMIS CONFIDENTIAL • ${requesterLabel}`;
    const formatPhp = (n) => Number(n || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });

    const resolveExisting = (...candidates) => {
      for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
      return null;
    };
    const sealPath      = resolveExisting(path.join(__dirname, '../assets/Seal.png'),            path.join(process.cwd(), 'SERVER/assets/Seal.png'),            path.join(process.cwd(), 'CLIENT/public/Seal.png'));
    const nialogoPath   = resolveExisting(path.join(__dirname, '../assets/logo.png'),            path.join(process.cwd(), 'SERVER/assets/logo.png'),            path.join(process.cwd(), 'CLIENT/public/logo.png'));
    const bagongPath    = resolveExisting(path.join(__dirname, '../assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png'));

    // ── Font resolution: Cambria & Trajan Pro (Windows fonts) ────────────────
    const F_CAMBRIA      = resolveExisting('C:/Windows/Fonts/cambria.ttc',  'C:/Windows/Fonts/CAMBRIA.TTC')  || 'Times-Roman';
    const F_CAMBRIA_B    = resolveExisting('C:/Windows/Fonts/cambriab.ttf', 'C:/Windows/Fonts/CAMBRIAB.TTF') || 'Times-Bold';
    const F_TRAJAN       = resolveExisting(
      'C:/Windows/Fonts/TrajanPro3Regular.otf',
      'C:/Windows/Fonts/TrajanPro-Regular.otf',
      'C:/Windows/Fonts/trajan.ttf',
      'C:/Program Files/Adobe/Acrobat DC/Resource/Font/TrajanPro3-Regular.otf',
      'C:/Program Files (x86)/Common Files/Adobe/Fonts/TrajanPro3-Regular.otf'
    ) || 'Times-Bold';
    const F_TRAJAN_B     = resolveExisting(
      'C:/Windows/Fonts/TrajanPro3Bold.otf',
      'C:/Windows/Fonts/TrajanPro-Bold.otf'
    ) || 'Times-Bold';
    console.log(`[CO_PDF] Fonts: Cambria=${F_CAMBRIA} CambriaBold=${F_CAMBRIA_B} Trajan=${F_TRAJAN}`);

    const drawPage = (isFirst) => {
      const cx = PAGE_WIDTH / 2;

      // Footer — near the very bottom edge of the paper
      pdfDoc.text('Annex E (Capital Outlay)', CONTENT_LEFT, PAGE_HEIGHT - 20, textOpt({ fontSize: 7, font: F_CAMBRIA }));
      pdfDoc.text(`Doc ID: ${documentId}`, CONTENT_LEFT, PAGE_HEIGHT - 10, textOpt({ fontSize: 7, font: F_CAMBRIA }));
      pdfDoc.text(`Page ${pageNo}`, CONTENT_RIGHT - 40, PAGE_HEIGHT - 10, textOpt({ fontSize: 7, align: 'right', font: F_CAMBRIA }));

      if (!isFirst) return;

      const logoW = 44, logoH = 44, logoY = MARGIN + 2;
      if (sealPath)    { try { pdfDoc.image(sealPath,    CONTENT_LEFT, logoY, { width: logoW, height: logoH }); } catch(e) {} }
      if (nialogoPath) { try { pdfDoc.image(nialogoPath, CONTENT_LEFT + logoW + 5, logoY, { width: logoW, height: logoH }); } catch(e) {} }
      if (bagongPath)  { try { pdfDoc.image(bagongPath,  CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH }); } catch(e) {} }

      let hy = logoY + 6;
      // "Republic of the Philippines" → BOLD (highlighted)
      pdfDoc.text('Republic of the Philippines', cx, hy, textOpt({ fontSize: 11, bold: true, align: 'center', font: F_CAMBRIA_B }));
      hy += LINE_H;
      // "OFFICE OF THE PRESIDENT" → regular (not highlighted)
      pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, textOpt({ fontSize: 11, align: 'center', font: F_CAMBRIA }));
      hy += LINE_H;
      // "NATIONAL IRRIGATION ADMINISTRATION" → BOLD (highlighted), Trajan Pro
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, textOpt({ fontSize: 11, bold: true, align: 'center', font: F_TRAJAN_B }));
      hy += LINE_H;

      let rcHeader = regionList && regionList.length ? regionList.join(', ') : 'ALL REGIONS';
      if (headerDept || headerDiv) {
        let subHeader = '';
        if (headerDept) subHeader += headerDept;
        if (headerDiv) subHeader += (subHeader ? '\n' : '') + headerDiv;
        // Region/dept/div lines → regular weight, Trajan Pro, size 11
        pdfDoc.text(rcHeader,  cx, hy, textOpt({ fontSize: 11, align: 'center', font: F_TRAJAN }));
        hy += LINE_H;
        pdfDoc.text(subHeader, cx, hy, textOpt({ fontSize: 11, align: 'center', font: F_TRAJAN }));
      } else {
        pdfDoc.text(rcHeader,  cx, hy, textOpt({ fontSize: 11, align: 'center', font: F_TRAJAN }));
      }

      if (bagongPath) pdfDoc.text('ANNEX E', CONTENT_RIGHT - 62, MARGIN + logoH + 2, textOpt({ fontSize: 13, bold: true, font: F_CAMBRIA_B }));

      // ── Title block ────────────────────────────────────────────────────────
      curY = hy + LINE_H * 1.5;
      // CORPORATE OPERATING BUDGET → bold, size 12
      pdfDoc.text('CORPORATE OPERATING BUDGET', cx, curY, textOpt({ fontSize: 12, bold: true, align: 'center', font: F_CAMBRIA_B }));
      curY += LINE_H + 1;
      // FISCAL YEAR → bold, size 12
      pdfDoc.text(`FISCAL YEAR ${safeStr(fiscalYear) || 'ALL YEARS'}`, cx, curY, textOpt({ fontSize: 12, bold: true, align: 'center', font: F_CAMBRIA_B }));
      curY += LINE_H + 5;
      // thin separator line (full table width)
      pdfDoc.rectangle(CONTENT_LEFT, curY, CONTENT_RIGHT - CONTENT_LEFT, 0.7, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      curY += 7;
      // CAPITAL OUTLAY → bold, size 14
      pdfDoc.text('CAPITAL OUTLAY', cx, curY, textOpt({ fontSize: 14, bold: true, align: 'center', font: F_CAMBRIA_B }));
      curY += LINE_H * 2;

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

    // ── Column layout: 3 columns matching Excel ─────────────────────────
    const TBL_W   = CONTENT_RIGHT - CONTENT_LEFT;
    const COL_RC  = 130;  // Responsibility Center
    const COL_AMT = 90;   // Amount (right-aligned)
    const COL_PAR = TBL_W - COL_RC - COL_AMT; // Particulars

    const xRC  = CONTENT_LEFT;
    const xPar = CONTENT_LEFT + COL_RC;
    const xAmt = CONTENT_RIGHT - COL_AMT;

    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    const ROW_H = 18;   // row height — more breathing room
    const PAD_V = 4;    // vertical text padding inside row

    pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    drawPage(true);

    let grandTotal = 0;
    const catEntries = Object.entries(catGroups);

    catEntries.forEach(([catName, rows], catIdx) => {
      // ── Category Header: bold text + bottom border, no fill ─────────────
      ensureSpace(3);
      const catLabel = `${ROMAN[catIdx] || (catIdx + 1)}.  ${catName}`;
      const catLines = wrapText(catLabel, TBL_W - 10, 8.5);
      catLines.forEach((line, i) => {
        pdfDoc.text(line, CONTENT_LEFT + 3, curY + PAD_V + (i * LINE_H), textOpt({ fontSize: 8.5, bold: true, color: '#000000' }));
      });
      curY += catLines.length * LINE_H + PAD_V * 2;
      // bottom border under category header
      pdfDoc.rectangle(CONTENT_LEFT, curY, TBL_W, 0.8, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      curY += 4;

      // ── Sub-header row ────────────────────────────────────────────────────
      ensureSpace(2);
      pdfDoc.rectangle(CONTENT_LEFT, curY, TBL_W, ROW_H, { stroke: '#000000', lineWidth: 0.5 });
      pdfDoc.text('RESPONSIBILITY CENTER', xRC  + 4, curY + PAD_V, textOpt({ fontSize: 7, bold: true }));
      pdfDoc.text('PARTICULARS',           xPar + 4, curY + PAD_V, textOpt({ fontSize: 7, bold: true }));
      pdfDoc.text('AMOUNT', xAmt + COL_AMT - 4, curY + PAD_V, textOpt({ fontSize: 7, bold: true, align: 'right' }));
      pdfDoc.rectangle(xPar, curY, 0.4, ROW_H, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      pdfDoc.rectangle(xAmt, curY, 0.4, ROW_H, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      curY += ROW_H;

      // ── Data rows ─────────────────────────────────────────────────────────
      let catTotal = 0;
      rows.forEach((row) => {
        const parLines = wrapText(safeStr(row.particulars), COL_PAR - 10, 8);
        const rcLines  = wrapText(safeStr(row.rc),          COL_RC  - 8,  8);
        const rowLines = Math.max(parLines.length, rcLines.length, 1);
        const rowH     = rowLines * LINE_H + PAD_V * 2;
        ensureSpace(rowLines + 1);

        pdfDoc.rectangle(CONTENT_LEFT, curY, TBL_W, rowH, { stroke: '#aaaaaa', lineWidth: 0.3 });
        pdfDoc.rectangle(xPar, curY, 0.3, rowH, { fill: '#aaaaaa', stroke: '#aaaaaa', lineWidth: 0 });
        pdfDoc.rectangle(xAmt, curY, 0.3, rowH, { fill: '#aaaaaa', stroke: '#aaaaaa', lineWidth: 0 });

        rcLines.forEach( (l, i) => pdfDoc.text(l, xRC  + 4, curY + PAD_V + i * LINE_H, textOpt({ fontSize: 8 })));
        parLines.forEach((l, i) => pdfDoc.text(l, xPar + 4, curY + PAD_V + i * LINE_H, textOpt({ fontSize: 8 })));
        pdfDoc.text(formatPhp(row.amount), xAmt + COL_AMT - 4, curY + PAD_V, textOpt({ fontSize: 8, align: 'right' }));

        curY += rowH;
        catTotal += row.amount;
      });

      // ── Category TOTAL row ────────────────────────────────────────────────
      ensureSpace(2);
      pdfDoc.rectangle(CONTENT_LEFT, curY, TBL_W, ROW_H, { stroke: '#000000', lineWidth: 0.5 });
      pdfDoc.rectangle(xPar, curY, 0.4, ROW_H, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      pdfDoc.rectangle(xAmt, curY, 0.4, ROW_H, { fill: '#000000', stroke: '#000000', lineWidth: 0 });
      pdfDoc.text('TOTAL', xPar + 4, curY + PAD_V, textOpt({ fontSize: 8, bold: true }));
      pdfDoc.text(formatPhp(catTotal), xAmt + COL_AMT - 4, curY + PAD_V, textOpt({ fontSize: 8, bold: true, align: 'right' }));
      curY += ROW_H + 10;
      grandTotal += catTotal;
    });

    // ── TOTAL CAPITAL OUTLAY ──────────────────────────────────────────────────
    ensureSpace(2);
    pdfDoc.rectangle(CONTENT_LEFT, curY, TBL_W, ROW_H + 2, { stroke: '#000000', lineWidth: 1 });
    pdfDoc.text('TOTAL CAPITAL OUTLAY', xRC + 4, curY + PAD_V + 1, textOpt({ fontSize: 9, bold: true }));
    pdfDoc.text(formatPhp(grandTotal), xAmt + COL_AMT - 4, curY + PAD_V + 1, textOpt({ fontSize: 9, bold: true, align: 'right' }));
    curY += ROW_H + 16;


    // Drawing signature block — keep on same page if possible
    ensureSpace(4);
    curY += LINE_H;
    curY = drawWorkflowSignatureBlock(pdfDoc, signatoriesInfo, curY, MARGIN, PAGE_WIDTH - (MARGIN * 2), tempSignatureImagePaths);

    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        console.error('Error finalizing Capital Outlay PDF:', err);
        if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
        return;
      }
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Capital_Outlay_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`);
      res.setHeader('X-Document-ID', documentId);
      const stream = fs.createReadStream(tmpFilePath);
      stream.on('error', (e) => { if (!res.headersSent) res.status(500).json({ message: 'Stream error', error: e.message }); });
      res.on('finish', () => {
        cleanupTempImages(tempSignatureImagePaths);
        fs.unlink(tmpFilePath, () => {});
      });
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
    const user = req.user || {};
    const userId = user.id || user.userId || user._id || user.UserId;
    const userRoles = user.roles || user.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));

    let assignedDept = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || req.submissionWorkflowData?.department;

    // Emergency Lookup
    if (!isSuperAdmin && !assignedDept && userId) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) }).populate('departmentId').lean();
        if (assignment) {
          assignedDept = assignment.departmentId?.departmentName || assignment.departmentId?.Department || assignment.departmentId?.DepartmentName;
        }
      } catch (_) {}
    }

    if (!isSuperAdmin && assignedDept) {
      return res.json({ departments: [assignedDept] });
    }

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
    const user = req.user || {};
    const userId = user.id || user.userId || user._id || user.UserId;
    const userRoles = user.roles || user.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));

    let assignedDiv = req.hierarchicalAccess?.accessibleDivisions?.[0] || req.submissionWorkflowData?.division;

    // Emergency Lookup
    if (!isSuperAdmin && !assignedDiv && userId) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) }).lean();
        if (assignment) {
          assignedDiv = assignment.divisionName;
        }
      } catch (_) {}
    }

    if (!isSuperAdmin && assignedDiv) {
      return res.json({ divisions: [assignedDiv] });
    }

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