const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const MooeProposal = require('../models/mooeProposals');
const Region = require('../models/Region');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { extractSignatoriesFromWorkflow, drawWorkflowSignatureBlock, cleanupTempImages, enrichSignatoriesWithPositionTitle } = require('../utils/pdfSignatureHelper');
const { getFolioPageSize, isAllRegionsSelection } = require('../utils/reportPageLayout');

let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}

// ─── Workflow-status-based scoping ───────────────────────────────────────────
// Returns the set of NewProposalWorkflow IDs that are visible to the requesting
// user given their role.  When the user is a Super Admin / BRD role the
// function returns null, meaning "no extra filter needed – show everything".
// For all other roles it returns an array of ObjectIds (may be empty).
const VISIBLE_STATUSES_BY_ROLE = {
  BUDGET_PREPARER:         ['DRAFT', 'FORWARDED_TO_REVIEWER','FORWARDED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PREPARER','RETURNED_TO_REVIEWER','RETURNED_TO_APPROVER','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_REVIEWER:         ['FORWARDED_TO_REVIEWER','RETURNED_TO_REVIEWER','FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_APPROVER:         ['FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_PLANNING_ANALYST: ['FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_OFFICER:          null,  // full access
  BUDGET_MANAGER:          null,  // full access
  SUPER_ADMIN:             null,  // full access
  OVERALL_BUDGET_APPROVER: null,  // full access
};

const FULL_ACCESS_ROLES = new Set([
  'SUPER_ADMIN','SUPER ADMIN','BUDGET_MANAGER','BUDGET MANAGER',
  'OVERALL_BUDGET_APPROVER','OVERALL BUDGET APPROVER',
  'BUDGET_ADMIN','BUDGET ADMIN','BUDGET_OFFICER','BUDGET OFFICER'
]);

const normalizeRole = (r) => String(r || '').trim().replace(/\s+/g, '_').toUpperCase();

const getConsolidatedMooeTitle = (budgetType) => {
  const normalizedBudgetType = String(budgetType || 'INITIAL').trim().toUpperCase();
  return `Consolidated MOOE – ${normalizedBudgetType || 'INITIAL'} BUDGET PROPOSAL`;
};

const createFinancialTotals = () => ({ income: 0, subsidy: 0, amount: 0, total: 0 });

const addFinancialValues = (target, values = {}) => {
  const income = Number(values.income || 0);
  const subsidy = Number(values.subsidy || 0);
  const amount = Number(values.amount || 0);
  target.income += income;
  target.subsidy += subsidy;
  target.amount += amount;
  target.total += income + subsidy + amount;
};

const MATRIX_FINANCIAL_COLUMNS = [
  { key: 'income', label: 'INCOME', compactLabel: 'I' },
  { key: 'subsidy', label: 'SUBSIDY', compactLabel: 'S' },
  { key: 'amount', label: 'AMOUNT', compactLabel: 'A' },
];

const getMatrixFinancialColumns = (values = {}) => (
  MATRIX_FINANCIAL_COLUMNS.map((column) => ({
    ...column,
    value: Number(values[column.key] || 0),
  }))
);

const getMooeMatrixPdfSubheaders = (subcolumnWidth) => (
  MATRIX_FINANCIAL_COLUMNS.map((column) => (
    Number(subcolumnWidth || 0) >= 45 ? column.label : column.compactLabel
  ))
);

const sumFinancialValues = (values = []) => {
  const totals = createFinancialTotals();
  values.forEach((entry) => addFinancialValues(totals, entry));
  return totals;
};

const MATRIX_PDF_PARTICULARS_TARGET_WIDTH = 300;
const MATRIX_PDF_MIN_SUBCOLUMN_WIDTH = 50;
const MATRIX_PDF_DETAIL_BASE_HEIGHT = 17;
const MATRIX_PDF_DETAIL_LINE_HEIGHT = 7.4;
const MATRIX_PDF_DETAIL_VERTICAL_ALLOWANCE = 6;

const getMooeMatrixPdfDetailHeight = (wrappedLineCount) => Math.max(
  MATRIX_PDF_DETAIL_BASE_HEIGHT,
  MATRIX_PDF_DETAIL_VERTICAL_ALLOWANCE +
    (Math.max(1, Number(wrappedLineCount || 0)) * MATRIX_PDF_DETAIL_LINE_HEIGHT)
);

const chunkMooeMatrixRegions = (regions = [], capacity = 1) => {
  const safeCapacity = Math.max(1, Math.floor(Number(capacity || 1)));
  const safeRegions = Array.isArray(regions) ? regions : [];
  const chunks = [];
  for (let index = 0; index < safeRegions.length; index += safeCapacity) {
    chunks.push(safeRegions.slice(index, index + safeCapacity));
  }
  return chunks;
};

const getMooeMatrixPdfLayout = ({ contentLeft = 0, contentWidth, regionCount }) => {
  const safeContentWidth = Math.max(1, Number(contentWidth || 0));
  const safeRegionCount = Math.max(1, Number(regionCount || 0));
  const particularsWidth = Math.min(
    MATRIX_PDF_PARTICULARS_TARGET_WIDTH,
    safeContentWidth * 0.45
  );
  const financialGroupWidth = (safeContentWidth - particularsWidth) / (safeRegionCount + 1);
  const subcolumnWidth = financialGroupWidth / MATRIX_FINANCIAL_COLUMNS.length;
  const regionXs = Array.from(
    { length: safeRegionCount },
    (_, index) => contentLeft + particularsWidth + (index * financialGroupWidth)
  );
  const totalX = contentLeft + particularsWidth + (safeRegionCount * financialGroupWidth);

  return {
    particularsX: contentLeft,
    particularsWidth,
    financialGroupWidth,
    subcolumnWidth,
    regionXs,
    totalX,
    right: contentLeft + safeContentWidth,
  };
};

const getMooeMatrixRegionsPerPage = (contentWidth) => {
  const safeContentWidth = Math.max(1, Number(contentWidth || 0));
  const particularsWidth = Math.min(
    MATRIX_PDF_PARTICULARS_TARGET_WIDTH,
    safeContentWidth * 0.45
  );
  return Math.max(
    1,
    Math.floor(
      (safeContentWidth - particularsWidth) /
      (MATRIX_PDF_MIN_SUBCOLUMN_WIDTH * MATRIX_FINANCIAL_COLUMNS.length)
    ) - 1
  );
};

const buildMooeRegionMatrix = (groups = []) => {
  const rowMap = new Map();
  const totalsByRegion = {};
  const regionalTotal = createFinancialTotals();

  (groups || []).forEach((group) => {
    const regionName = String(group?.region || '').trim();
    if (!regionName) return;
    const category = String(group?.category || 'Uncategorized').trim() || 'Uncategorized';

    (group?.items || []).forEach((item) => {
      const uacsCode = String(item?.uacsCode || '').trim();
      const accountingTitle = String(item?.accountingTitle || item?.name || '').trim();
      const values = {
        income: Number(item?.income || 0),
        subsidy: Number(item?.subsidy || 0),
        amount: Number(item?.amount || 0),
      };
      if (values.income === 0 && values.subsidy === 0 && values.amount === 0) return;
      if (!totalsByRegion[regionName]) totalsByRegion[regionName] = createFinancialTotals();

      const identity = `${category}\u001f${uacsCode}\u001f${accountingTitle}`;
      if (!rowMap.has(identity)) {
        rowMap.set(identity, {
          id: identity,
          category,
          uacsCode,
          accountingTitle,
          valuesByRegion: {},
          totals: createFinancialTotals(),
        });
      }

      const row = rowMap.get(identity);
      if (!row.valuesByRegion[regionName]) row.valuesByRegion[regionName] = createFinancialTotals();
      addFinancialValues(row.valuesByRegion[regionName], values);
      addFinancialValues(row.totals, values);
      addFinancialValues(totalsByRegion[regionName], values);
      addFinancialValues(regionalTotal, values);
    });
  });

  const rows = [...rowMap.values()].sort((a, b) => {
    const aUacs = String(a.uacsCode || '').padStart(20, '0');
    const bUacs = String(b.uacsCode || '').padStart(20, '0');
    const uacsOrder = aUacs.localeCompare(bUacs);
    if (uacsOrder !== 0) return uacsOrder;
    const categoryOrder = a.category.localeCompare(b.category, 'en', { sensitivity: 'base' });
    if (categoryOrder !== 0) return categoryOrder;
    return a.accountingTitle.localeCompare(b.accountingTitle, 'en', { sensitivity: 'base' });
  });
  const regionNames = Object.keys(totalsByRegion)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const orderedTotalsByRegion = Object.fromEntries(
    regionNames.map((regionName) => [regionName, totalsByRegion[regionName]])
  );

  return { regions: regionNames, rows, totalsByRegion: orderedTotalsByRegion, regionalTotal };
};

const getVisibleWorkflowIds = async (req, { fiscalYear, budgetType, regions } = {}) => {
  const userRoles = (req.user?.Roles || req.user?.roles || []).map(normalizeRole);

  // Super admins / BRD full access – no additional filter
  if (userRoles.some(r => FULL_ACCESS_ROLES.has(r))) return null;

  // Determine the most-permissive visible-statuses set for this user
  let visibleStatuses = null;
  for (const [roleKey, statuses] of Object.entries(VISIBLE_STATUSES_BY_ROLE)) {
    if (userRoles.includes(roleKey)) {
      if (statuses === null) return null; // full access
      if (!visibleStatuses) {
        visibleStatuses = new Set(statuses);
      } else {
        statuses.forEach(s => visibleStatuses.add(s));
      }
    }
  }

  // If the user has no recognized role, default to PREPARER-level visibility
  if (!visibleStatuses) {
    visibleStatuses = new Set(VISIBLE_STATUSES_BY_ROLE.BUDGET_PREPARER);
  }

  // Draft proposals remain private to the Budget Preparer who created them.
  // Other statuses continue to follow the role and organizational visibility rules.
  visibleStatuses.delete('DRAFT');
  const requesterId = String(req.user?.id || req.user?.userId || req.user?._id || '').trim();
  const canSeeOwnDraft = userRoles.includes('BUDGET_PREPARER') && requesterId;

  // --- OPSYON A FIX: Get all active/released consolidated proposals to find their merged source IDs ---
  const activeConsolidatedQuery = {
    isConsolidated: true,
    status: { $in: [...visibleStatuses] }
  };
  if (fiscalYear) activeConsolidatedQuery.fiscalYear = Number(fiscalYear) || parseInt(fiscalYear, 10);
  if (budgetType) {
    const typeMap = { NEP: 'NEP', GAA: 'GAA' };
    activeConsolidatedQuery.modelType = typeMap[String(budgetType).toUpperCase()] || 'Initial';
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    if (regionDocs.length) activeConsolidatedQuery.region = { $in: regionDocs.map(r => r._id) };
  }

  const activeConsolidatedDocs = await NewProposalWorkflow.find(activeConsolidatedQuery).select('mergedFrom').lean();
  const allowedMergedIds = [];
  activeConsolidatedDocs.forEach(doc => {
    if (Array.isArray(doc.mergedFrom)) {
      allowedMergedIds.push(...doc.mergedFrom);
    }
  });

  // Build the main query using an $and array to safely mix $or conditions without key collision
  const npwQuery = {
    $and: [
      {
        $or: [
          { status: { $in: [...visibleStatuses] } },
          { _id: { $in: allowedMergedIds } },
          ...(canSeeOwnDraft ? [{ status: 'DRAFT', createdBy: requesterId }] : [])
        ]
      }
    ]
  };

  if (fiscalYear) npwQuery.$and.push({ fiscalYear: Number(fiscalYear) || parseInt(fiscalYear, 10) });
  if (budgetType) {
    const typeMap = { NEP: 'NEP', GAA: 'GAA' };
    npwQuery.$and.push({ modelType: typeMap[String(budgetType).toUpperCase()] || 'Initial' });
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    if (regionDocs.length) npwQuery.$and.push({ region: { $in: regionDocs.map(r => r._id) } });
  }

  // For PREPARER / REVIEWER / APPROVER, also restrict to their own department/division
  const isPreparerReviewer = userRoles.some(r => ['BUDGET_PREPARER','BUDGET_REVIEWER','BUDGET_APPROVER'].includes(r));
  if (isPreparerReviewer) {
    const userId = String(req.user?.id || req.user?.userId || '');
    if (userId) {
      try {
        const hua = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName')
          .lean();
        if (hua) {
          const dept = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName;
          const div  = hua.divisionName || '';
          const level = String(hua.assignmentLevel || '').toUpperCase();
          if (dept && !['BUDGET_AND_REVENUE_DIVISION','REGION','FULL'].includes(level)) {
            npwQuery.$and.push({ department: dept });
            if (div && level === 'DIVISION') npwQuery.$and.push({ division: div });
          }
        }
      } catch (_) {}
    }
  }

  const docs = await NewProposalWorkflow.find(npwQuery).select('_id').lean();
  return docs.map(d => d._id);
};
// ─────────────────────────────────────────────────────────────────────────────

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

      // ── Workflow-status scope filter ─────────────────────────────────────
      // Only show MOOE data whose parent workflow has been submitted/forwarded
      // to (or past) the requesting user's role.  Proposals still in DRAFT are
      // invisible to everyone except the preparer who owns them.
      const visibleWorkflowIds = await getVisibleWorkflowIds(req, { fiscalYear, budgetType, regions });
      if (visibleWorkflowIds !== null) {
        // null  → full access (super-admin / BRD roles); skip extra filter
        if (visibleWorkflowIds.length === 0) {
          // User has a scoped role but no visible workflows yet
          return res.status(200).json({
            success: true,
            data: [],
            matrix: buildMooeRegionMatrix([]),
            summary: { totalRegions: 0, totalCategories: 0, totalEntries: 0, grandTotal: 0 }
          });
        }
        // Merge into existing query — keep the $and structure if already present
        const wfFilter = { workflowRef: { $in: visibleWorkflowIds } };
        if (mooeQuery.$and) {
          mooeQuery.$and.push(wfFilter);
        } else {
          mooeQuery.workflowRef = { $in: visibleWorkflowIds };
        }
      }
      // ────────────────────────────────────────────────────────────────────

      const mooeData = await MooeProposal.find(mooeQuery).lean();
      
      if (!Array.isArray(mooeData) || mooeData.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          matrix: buildMooeRegionMatrix([]),
          summary: { totalRegions: 0, totalCategories: 0, totalEntries: 0, grandTotal: 0 }
        });
      }

      const grouped = {};
      let grandTotal = 0;
      let regionSet = new Set();
      let categorySet = new Set();
      let validEntriesCount = 0;

      mooeData.forEach((item) => {
        const total =
          Number(item.income || 0) + Number(item.subsidy || 0) + Number(item.amount || 0) +
          Number(item.nis || 0) + Number(item.cis || 0);
        
        // Skip rows with no financial value (0 or null)
        if (total <= 0) return;

        const region = item.region || 'Unspecified';
        const category = item.sublineItem || 'Uncategorized';
        regionSet.add(region);
        categorySet.add(category);
        validEntriesCount++;

        const key = `${region}||${category}`;
        if (!grouped[key]) {
          grouped[key] = { region, category, items: [], total: 0 };
        }
        
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
      }).sort((a, b) => {
        // Sort groups by the minimum UACS code of their items, then by category name
        const aMinUacs = (a.items && a.items.length > 0)
          ? a.items.reduce((min, item) => {
              const u = (item.uacsCode || '').toString();
              return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
            }, '')
          : '';
        const bMinUacs = (b.items && b.items.length > 0)
          ? b.items.reduce((min, item) => {
              const u = (item.uacsCode || '').toString();
              return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
            }, '')
          : '';
        const uacsCompare = aMinUacs.padStart(20, '0').localeCompare(bMinUacs.padStart(20, '0'));
        if (uacsCompare !== 0) return uacsCompare;
        return a.category.localeCompare(b.category);
      });
      const safeResult = Array.isArray(result)
        ? result.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] }))
        : [];
      const matrix = buildMooeRegionMatrix(safeResult);
      res.status(200).json({
        success: true,
        data: Array.isArray(safeResult) ? safeResult.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] })) : [],
        matrix,
        summary: {
          totalRegions: regionSet.size,
          totalCategories: categorySet.size,
          totalEntries: validEntriesCount,
          grandTotal
        }
      });
    } catch (error) {
      console.error('Error fetching consolidated MOOE data:', error);
      res.status(200).json({
        success: false,
        data: [],
        matrix: buildMooeRegionMatrix([]),
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
      const regionDetails = await Region.find({ Region: { $in: allRegions } }).lean();
      
      // Return both the region details (if any) and the raw region strings as a fallback
      // The frontend can handle both objects and raw strings.
      const returnedRegions = regionDetails.length > 0 ? regionDetails : allRegions;
      
      res.status(200).json({ success: true, regions: returnedRegions, availableRegions: allRegions });
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
    const documentId = 'MOOE-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    if (!MuhammaraRecipe) {
      return res.status(500).json({ message: 'PDF generation library (muhammara) is not installed on the server.' });
    }

    const requesterId = String(req.user?.id || '').trim();
    if (!requesterId) {
      return res.status(401).json({ message: 'Authentication is required to generate PDF reports.' });
    }

    try {
      const { regions, region, fiscalYear, budgetType, consolidationType } = req.query;
      let { department, division } = req.query;

      // --- SECURITY OVERRIDE: Enforce scope based on user roles and assignments ---
      const userId = req.user?.id || req.user?.userId || req.user?._id || req.user?.UserId;
      const userRoles = req.user?.roles || req.user?.Roles || [];

      // Region-wide roles (Super Admins + BRD roles)
      const REGION_WIDE_ROLES = [
        'SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER',
        'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST',
        'BUDGET_OFFICER', 'BUDGET OFFICER',
        'OVERALL_BUDGET_APPROVER', 'OVERALL BUDGET APPROVER',
        'BUDGET_ADMIN', 'BUDGET ADMIN',
      ];
      let isSuperAdmin = userRoles.some(r => REGION_WIDE_ROLES.includes(r));

      if (!isSuperAdmin) {
        let assignedDept = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName
          || req.submissionWorkflowFilters?.department;
        let assignedDiv = req.hierarchicalAccess?.accessibleDivisions?.[0]
          || req.submissionWorkflowFilters?.division;

        // Emergency DB lookup if middleware didn't provide dept
        if (userId && !assignedDept) {
          try {
            const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
            const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
              .populate('departmentId').lean();
            if (assignment) {
              const level = assignment.assignmentLevel || '';
              const isRegionLevel = ['BUDGET_AND_REVENUE_DIVISION', 'REGION', 'FULL'].includes(level);
              if (isRegionLevel) {
                isSuperAdmin = true;
              } else if (!assignedDept) {
                assignedDept = assignment.departmentId?.departmentName
                  || assignment.departmentId?.Department
                  || assignment.departmentId?.DepartmentName;
                assignedDiv = assignedDiv || assignment.divisionName || assignment.division;
              }
            }
          } catch (_) {}
        }

        if (!isSuperAdmin) {
          if (!assignedDept) {
            return res.status(403).json({
              message: 'Cannot generate PDF: your organizational scope could not be determined.'
            });
          }
          // Override query params with scoped values
          department = assignedDept;
          if (assignedDiv) division = assignedDiv;
        }
      }

      const regionList = regions ? (Array.isArray(regions) ? regions : [regions]) : (region ? [region] : null);

      let regionFilter = {};
      if (regionList && regionList.length) {
        regionFilter.region = { $in: regionList };
      }

      const accessScope = req.hierarchicalAccess?.scope || req.hierarchicalAccessInfo?.scope;
      const accessibleRegionName = (req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName) || (req.hierarchicalAccessInfo?.accessibleRegions?.[0]?.regionName);
      
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName && !regionFilter.region) {
        regionFilter.region = accessibleRegionName;
      }

      const mooeQuery = { ...regionFilter };
      if (fiscalYear) mooeQuery.fiscalYear = fiscalYear;
      if (budgetType) mooeQuery.budgetType = budgetType;
      if (department) mooeQuery.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      if (division)   mooeQuery.division   = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      const visibleWorkflowIds = await getVisibleWorkflowIds(req, { fiscalYear, budgetType, regions: regionList });
      if (visibleWorkflowIds !== null) {
        if (visibleWorkflowIds.length === 0) {
          return res.status(404).json({ message: 'No budget proposals found for the selected filters.' });
        }
        mooeQuery.workflowRef = { $in: visibleWorkflowIds };
      }

      const mooeData = await MooeProposal.find(mooeQuery).lean();

      // --- Resolve signatories from workflow ---
      let signatoriesInfo = extractSignatoriesFromWorkflow(null, req.user);
      const workflowRefId = mooeData.map((m) => m.workflowRef).filter(Boolean)[0];
      if (workflowRefId) {
        const workflow = await NewProposalWorkflow.findById(workflowRefId)
          .select('createdByName createdByTitle workflowHistory consolidatedByName')
          .lean();
        if (workflow) {
          signatoriesInfo = extractSignatoriesFromWorkflow(workflow, req.user);
        }
      }

      // --- Group data by Responsibility Center > category ---
      const grouped = {};
      mooeData.forEach((item) => {
        const income = Number(item.income || 0);
        const subsidy = Number(item.subsidy || 0);
        const amount = Number(item.amount || 0);

        // Skip rows with no financial value (0 or null)
        if (income === 0 && subsidy === 0 && amount === 0) return;

        const isMultiRegion = !regionList || regionList.length > 1;
        let rcName;
        if (isMultiRegion || !department) {
          rcName = item.region || 'Unknown Region';
        } else if (!division) {
          let deptName = item.department;
          if (deptName === 'IRRIGATION MANAGEMENT OFFICE') deptName = 'IMO';
          rcName = deptName || item.region || 'Unknown Responsibility Center';
        } else {
          let deptName = item.department;
          if (deptName === 'IRRIGATION MANAGEMENT OFFICE') deptName = 'IMO';
          rcName = `${deptName} / ${item.division}`;
        }
        const categoryName = item.sublineItem || 'Uncategorized';
        const uacs = item.uacsCode || '';
        const title = item.accountingTitle || '';

        if (!grouped[rcName]) grouped[rcName] = {};
        if (!grouped[rcName][categoryName]) grouped[rcName][categoryName] = {};
        
        const rowKey = `${uacs}_${title}`;
        if (!grouped[rcName][categoryName][rowKey]) {
          grouped[rcName][categoryName][rowKey] = {
            uacsCode: uacs,
            accountingTitle: title,
            income: 0,
            subsidy: 0,
            amount: 0,
          };
        }
        
        grouped[rcName][categoryName][rowKey].income += income;
        grouped[rcName][categoryName][rowKey].subsidy += subsidy;
        grouped[rcName][categoryName][rowKey].amount += amount;
      });

      // Convert objects back to sorted arrays
      for (const rcName of Object.keys(grouped)) {
        for (const catName of Object.keys(grouped[rcName])) {
          const rows = Object.values(grouped[rcName][catName]);
          rows.sort((a, b) => {
            const aUacs = (a.uacsCode || '').toString();
            const bUacs = (b.uacsCode || '').toString();
            if (/^\d[\d\-]*$/.test(aUacs) && /^\d[\d\-]*$/.test(bUacs)) {
              return aUacs.padStart(20, '0').localeCompare(bUacs.padStart(20, '0'));
            }
            return aUacs.localeCompare(bUacs);
          });
          grouped[rcName][catName] = rows;
        }
      }

      const pdfMatrixGroups = Object.entries(grouped).flatMap(([regionName, categories]) => (
        Object.entries(categories).map(([category, items]) => ({ region: regionName, category, items }))
      ));
      const regionMatrix = buildMooeRegionMatrix(pdfMatrixGroups);

      // ============================================================
      // PAGE SETUP
      // ============================================================
      const tmpFilePath = path.join(os.tmpdir(), `consolidated_mooe_${Date.now()}.pdf`);
      const tempSignatureImagePaths = [];

      const useLandscape = isAllRegionsSelection({ consolidationType, regions: regionList });
      const useRegionMatrix = useLandscape && regionMatrix.regions.length > 0;
      const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = getFolioPageSize(useLandscape);
      const MARGIN      = 18;
      const CONTENT_LEFT  = MARGIN;
      const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
      const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
      const FOOTER_Y      = PAGE_HEIGHT - 14;

      // Row heights
      const ROW_H        = 14;   // standard data row
      const HDR_ROW_H    = 16;   // column header row
      const RC_ROW_H     = 15;   // RC label row

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
      const COL_RC      = 100;
      const COL_INCOME  = 108;
      const COL_SUBSIDY = 108;
      const COL_AMOUNT  = 108;
      const COL_TITLE   = CONTENT_WIDTH - COL_RC - COL_INCOME - COL_SUBSIDY - COL_AMOUNT;

      const colX = {
        rc:      CONTENT_LEFT,
        title:   CONTENT_LEFT + COL_RC,
        income:  CONTENT_LEFT + COL_RC + COL_TITLE,
        subsidy: CONTENT_LEFT + COL_RC + COL_TITLE + COL_INCOME,
        amount:  CONTENT_LEFT + COL_RC + COL_TITLE + COL_INCOME + COL_SUBSIDY,
      };

      // ============================================================
      // HELPERS
      // ============================================================
      const safeStr = (v) => (v != null && v !== '') ? String(v) : '';

      const wrapText = (text, maxWidth, fontSize, font) => {
        const words = String(text || '').split(/\s+/);
        const lines = [];
        let currentLine = '';
        const getWidth = (t) => {
          try { 
            const opts = { fontSize };
            if (font) opts.font = font;
            return pdfDoc.calculateTextDimensions(t, opts).width; 
          }
          catch (e) { return t.length * (fontSize * 0.55); }
        };
        words.forEach(word => {
          if (!word) return;
          let testLine = currentLine ? `${currentLine} ${word}` : word;
          if (getWidth(testLine) > maxWidth) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
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

      const reportTitle = getConsolidatedMooeTitle(budgetType);
      const recipeOptions = {
        version: 1.6,
        author: 'FMIS-BUDGET',
        title: reportTitle,
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
        // Border disabled as requested

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
        pdfDoc.text(`Annex C (MOOE)  |  Doc ID: ${documentId}`, CONTENT_LEFT + 4, FOOTER_Y + 4, { color: LIGHT, fontSize: 7 });
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

        // Report title — bold text only, no colored bar
        pdfDoc.text(reportTitle, cx, hy, {
          color: BLACK, fontSize: 11.5, bold: true, align: 'center'
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

        pdfDoc.text(`${reportTitle} (continued)`, cx, hy, {
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
        pdfDoc.text('RESPONSIBILITY CENTER',            colX.rc + 4,                        hY + 5, { color: BLACK, fontSize: 6.5, bold: true });
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
      if (useRegionMatrix) {
        const MATRIX_GROUP_HEADER_H = 16;
        const MATRIX_SUBHEADER_H = 12;
        const MATRIX_HEADER_H = MATRIX_GROUP_HEADER_H + MATRIX_SUBHEADER_H;
        const MATRIX_CATEGORY_H = 14;
        const MATRIX_TOTAL_H = 19;
        const matrixRegionsPerPage = getMooeMatrixRegionsPerPage(CONTENT_WIDTH);
        const regionChunks = chunkMooeMatrixRegions(regionMatrix.regions, matrixRegionsPerPage);
        const matrixCategories = new Map();
        regionMatrix.rows.forEach((row) => {
          if (!matrixCategories.has(row.category)) matrixCategories.set(row.category, []);
          matrixCategories.get(row.category).push(row);
        });

        const drawMatrixFinancialValues = (values, x, y, rowHeight, subcolumnWidth, options = {}) => {
          const fontSize = options.bold ? 6.2 : 6;
          const valueY = y + Math.max(4, (rowHeight - fontSize) / 2);
          getMatrixFinancialColumns(values).forEach(({ value }, subcolumnIndex) => {
            pdfDoc.text(
              formatPhp(value),
              x + ((subcolumnIndex + 1) * subcolumnWidth) - 3,
              valueY,
              { color: BLACK, fontSize, bold: options.bold, align: 'right' }
            );
          });
        };

        const getMatrixColumns = (chunk) => {
          const layout = getMooeMatrixPdfLayout({
            contentLeft: CONTENT_LEFT,
            contentWidth: CONTENT_WIDTH,
            regionCount: chunk.length,
          });
          return {
            particulars: layout.particularsX,
            particularsWidth: layout.particularsWidth,
            financialGroupWidth: layout.financialGroupWidth,
            subcolumnWidth: layout.subcolumnWidth,
            regions: chunk.map((regionName, index) => ({
              regionName,
              x: layout.regionXs[index],
            })),
            total: layout.totalX,
            right: layout.right,
          };
        };

        const getMatrixFinancialBoundaries = (columns) => (
          [...columns.regions.map((column) => column.x), columns.total].flatMap((groupX) => ([
            groupX,
            groupX + columns.subcolumnWidth,
            groupX + (columns.subcolumnWidth * 2),
          ]))
        );

        const drawMatrixHeader = (chunk) => {
          const columns = getMatrixColumns(chunk);
          const y = curY;
          pdfDoc.rectangle(CONTENT_LEFT, y, columns.right - CONTENT_LEFT, MATRIX_HEADER_H, {
            stroke: BLACK, lineWidth: 0.8,
          });
          [...columns.regions.map((column) => column.x), columns.total]
            .forEach((x) => pdfDoc.rectangle(x, y, 0.5, MATRIX_HEADER_H, { fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0 }));
          [...columns.regions.map((column) => column.x), columns.total].forEach((groupX) => {
            [groupX + columns.subcolumnWidth, groupX + (columns.subcolumnWidth * 2)]
              .forEach((x) => pdfDoc.rectangle(x, y + MATRIX_GROUP_HEADER_H, 0.35, MATRIX_SUBHEADER_H, {
                fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0,
              }));
          });
          const firstFinancialX = columns.regions[0]?.x || columns.total;
          pdfDoc.rectangle(firstFinancialX, y + MATRIX_GROUP_HEADER_H, columns.right - firstFinancialX, 0.5, {
            fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0,
          });
          pdfDoc.text('PARTICULARS', columns.particulars + 5, y + 6, { color: BLACK, fontSize: 6.3, bold: true });
          columns.regions.forEach(({ regionName, x }) => {
            const lines = wrapText(regionName, columns.financialGroupWidth - 8, 5.8).slice(0, 2);
            lines.forEach((line, lineIndex) => {
              pdfDoc.text(line, x + (columns.financialGroupWidth / 2), y + 4 + (lineIndex * 7), {
                color: BLACK, fontSize: 5.8, bold: true, align: 'center',
              });
            });
            getMooeMatrixPdfSubheaders(columns.subcolumnWidth).forEach((label, subcolumnIndex) => {
              pdfDoc.text(label, x + ((subcolumnIndex + 0.5) * columns.subcolumnWidth), y + MATRIX_GROUP_HEADER_H + 4, {
                color: MID, fontSize: 5.1, bold: true, align: 'center',
              });
            });
          });
          pdfDoc.text(regionChunks.length > 1 ? 'CHUNK TOTAL' : 'REGIONAL TOTAL', columns.total + (columns.financialGroupWidth / 2), y + 5, {
            color: BLACK, fontSize: 5.8, bold: true, align: 'center',
          });
          getMooeMatrixPdfSubheaders(columns.subcolumnWidth).forEach((label, subcolumnIndex) => {
            pdfDoc.text(label, columns.total + ((subcolumnIndex + 0.5) * columns.subcolumnWidth), y + MATRIX_GROUP_HEADER_H + 4, {
              color: MID, fontSize: 5.1, bold: true, align: 'center',
            });
          });
          curY += MATRIX_HEADER_H;
          return columns;
        };

        const startMatrixPage = (chunk, firstPage = false) => {
          if (pageNo > 0 && !firstPage) pdfDoc.endPage();
          if (!firstPage) pageNo += 1;
          pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
          drawPageChrome();
          if (firstPage) drawFirstPageHeader();
          else drawContinuationHeader();
          pdfDoc.text('Financial subcolumns: I = Income   |   S = Subsidy   |   A = Amount', CONTENT_LEFT, curY + 1, {
            color: MID, fontSize: 6.2,
          });
          curY += 10;
          return drawMatrixHeader(chunk);
        };

        let isFirstMatrixPage = true;
        let activeColumns = null;
        const ensureMatrixSpace = (height, chunk) => {
          if (curY + height <= FOOTER_Y - 8) return;
          activeColumns = startMatrixPage(chunk, false);
        };

        for (let chunkIndex = 0; chunkIndex < regionChunks.length; chunkIndex += 1) {
          const chunk = regionChunks[chunkIndex];
          const isFinalChunk = chunkIndex === regionChunks.length - 1;
          activeColumns = startMatrixPage(chunk, isFirstMatrixPage);
          isFirstMatrixPage = false;

          for (const [categoryName, rows] of matrixCategories.entries()) {
            const firstTitleLines = rows[0]
              ? wrapText(rows[0].accountingTitle, activeColumns.particularsWidth - 18, 6.5)
              : [];
            ensureMatrixSpace(
              MATRIX_CATEGORY_H + getMooeMatrixPdfDetailHeight(firstTitleLines.length),
              chunk
            );
            const categoryY = curY;
            pdfDoc.rectangle(CONTENT_LEFT, categoryY, activeColumns.right - CONTENT_LEFT, MATRIX_CATEGORY_H, {
              fill: '#f2f2f2', stroke: BORDER_BOLD, lineWidth: 0.5,
            });
            pdfDoc.text(categoryName, CONTENT_LEFT + 5, categoryY + 5, {
              color: BLACK, fontSize: 6.8, bold: true,
            });
            curY += MATRIX_CATEGORY_H;

            for (const row of rows) {
              const titleLines = wrapText(row.accountingTitle, activeColumns.particularsWidth - 18, 6.5);
              const detailRowHeight = getMooeMatrixPdfDetailHeight(titleLines.length);
              ensureMatrixSpace(detailRowHeight, chunk);
              const rowY = curY;
              pdfDoc.rectangle(CONTENT_LEFT, rowY, activeColumns.right - CONTENT_LEFT, detailRowHeight, {
                stroke: BORDER_STD, lineWidth: 0.35,
              });
              getMatrixFinancialBoundaries(activeColumns)
                .forEach((x) => pdfDoc.rectangle(x, rowY, 0.35, detailRowHeight, { fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0 }));

              titleLines.forEach((line, lineIndex) => pdfDoc.text(line, activeColumns.particulars + 10, rowY + 4 + (lineIndex * MATRIX_PDF_DETAIL_LINE_HEIGHT), {
                color: DARK, fontSize: 6.5,
              }));
              activeColumns.regions.forEach(({ regionName, x }) => {
                drawMatrixFinancialValues(row.valuesByRegion?.[regionName], x, rowY, detailRowHeight, activeColumns.subcolumnWidth);
              });
              const chunkRowTotal = sumFinancialValues(
                chunk.map((regionName) => row.valuesByRegion?.[regionName])
              );
              drawMatrixFinancialValues(chunkRowTotal, activeColumns.total, rowY, detailRowHeight, activeColumns.subcolumnWidth, { bold: true });
              curY += detailRowHeight;
            }
          }

          ensureMatrixSpace(MATRIX_TOTAL_H, chunk);
          const totalY = curY;
          pdfDoc.rectangle(CONTENT_LEFT, totalY, activeColumns.right - CONTENT_LEFT, MATRIX_TOTAL_H, {
            fill: '#ededed', stroke: BLACK, lineWidth: 0.9,
          });
          getMatrixFinancialBoundaries(activeColumns)
            .forEach((x) => pdfDoc.rectangle(x, totalY, 0.5, MATRIX_TOTAL_H, { fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0 }));
          pdfDoc.text(regionChunks.length > 1 ? 'CHUNK REGIONAL TOTAL' : 'REGIONAL TOTAL', CONTENT_LEFT + 5, totalY + 5, {
            color: BLACK, fontSize: 7.4, bold: true,
          });
          activeColumns.regions.forEach(({ regionName, x }) => {
            drawMatrixFinancialValues(regionMatrix.totalsByRegion[regionName], x, totalY, MATRIX_TOTAL_H, activeColumns.subcolumnWidth, { bold: true });
          });
          const chunkTotal = sumFinancialValues(
            chunk.map((regionName) => regionMatrix.totalsByRegion[regionName])
          );
          drawMatrixFinancialValues(chunkTotal, activeColumns.total, totalY, MATRIX_TOTAL_H, activeColumns.subcolumnWidth, { bold: true });
          curY += MATRIX_TOTAL_H + 6;

          if (regionChunks.length > 1 && isFinalChunk) {
            ensureMatrixSpace(MATRIX_TOTAL_H, chunk);
            const allRegionTotalY = curY;
            pdfDoc.rectangle(CONTENT_LEFT, allRegionTotalY, activeColumns.right - CONTENT_LEFT, MATRIX_TOTAL_H, {
              fill: '#dfe8df', stroke: BLACK, lineWidth: 1,
            });
            getMatrixFinancialBoundaries(activeColumns)
              .forEach((x) => pdfDoc.rectangle(x, allRegionTotalY, 0.5, MATRIX_TOTAL_H, {
                fill: BORDER_STD, stroke: BORDER_STD, lineWidth: 0,
              }));
            pdfDoc.text('ALL-REGION TOTAL', CONTENT_LEFT + 5, allRegionTotalY + 5, {
              color: BLACK, fontSize: 8, bold: true,
            });
            drawMatrixFinancialValues(regionMatrix.regionalTotal, activeColumns.total, allRegionTotalY, MATRIX_TOTAL_H, activeColumns.subcolumnWidth, { bold: true });
            curY += MATRIX_TOTAL_H + 6;
          }
        }
      } else {
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      drawPageChrome();
      drawFirstPageHeader();
      drawTableHeader();

      let regionalIncome = 0;
      let regionalSubsidy = 0;
      let regionalAmount = 0;
      const regionNames = Object.keys(grouped).sort();

      for (const rcName of regionNames) {
        const categories = grouped[rcName];

        // ---- RC HEADER ROW ----
        ensureSpace(2, RC_ROW_H);
        
        const rcLines = wrapText(rcName, COL_RC - 8, 7);
        rcLines.forEach((line, idx) => {
          pdfDoc.text(line, colX.rc + 4, curY + 4 + (idx * ROW_H), {
            color: BLACK, fontSize: 7, bold: true
          });
        });
        
        let rcRowHeight = Math.max(RC_ROW_H, rcLines.length * ROW_H);
        // curY += rcRowHeight; // No, we want to align with category name if it's the first row

        let regionIncome  = 0;
        let regionSubsidy = 0;
        let regionAmount  = 0;
        // Sort categories by their minimum UACS code instead of alphabetically
        const catNames = Object.keys(categories).sort((a, b) => {
          const aItems = categories[a] || [];
          const bItems = categories[b] || [];
          const aMinUacs = aItems.reduce((min, item) => {
            const u = (item.uacsCode || '').toString();
            return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
          }, '');
          const bMinUacs = bItems.reduce((min, item) => {
            const u = (item.uacsCode || '').toString();
            return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
          }, '');
          const uacsCompare = aMinUacs.padStart(20, '0').localeCompare(bMinUacs.padStart(20, '0'));
          if (uacsCompare !== 0) return uacsCompare;
          return a.localeCompare(b);
        });

        for (const catName of catNames) {
          const rows = categories[catName];
          const categoryLines = wrapText(catName, COL_TITLE - 12, 7.5);
          const categoryRowHeight = Math.max(ROW_H, categoryLines.length * ROW_H);
          ensureSpace(1, categoryRowHeight + ROW_H);

          // ---- CATEGORY HEADER ROW ----
          categoryLines.forEach((line, lineIdx) => {
            pdfDoc.text(line, colX.title + 6, curY + 4 + (lineIdx * ROW_H), {
              color: DARK, fontSize: 7.5, bold: true
            });
          });
          curY += categoryRowHeight;
          let catIncome  = 0;
          let catSubsidy = 0;
          let catAmount  = 0;

          rows.forEach((row, idx) => {
            const titleLines = wrapText(safeStr(row.accountingTitle), COL_TITLE - 20, 7.5);
            ensureSpace(titleLines.length);

            // Accounting title — indented under category
            titleLines.forEach((line, lineIdx) => {
              pdfDoc.text(
                line,
                colX.title + 16, curY + 4 + (lineIdx * ROW_H),
                { color: DARK, fontSize: 7.5 }
              );
            });

            pdfDoc.text(formatPhp(row.income),  colX.income  + COL_INCOME  - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });
            pdfDoc.text(formatPhp(row.subsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });
            pdfDoc.text(formatPhp(row.amount),  colX.amount  + COL_AMOUNT  - 5, curY + 4, { color: DARK, fontSize: 7.5, align: 'right' });

            curY += (titleLines.length * ROW_H);

            catIncome  += row.income;
            catSubsidy += row.subsidy;
            catAmount  += row.amount;
          });

          regionIncome  += catIncome;
          regionSubsidy += catSubsidy;
          regionAmount  += catAmount;
        }

        regionalIncome += regionIncome;
        regionalSubsidy += regionSubsidy;
        regionalAmount += regionAmount;
      }

      // Single aggregate row for every visible region/responsibility center.
      ensureSpace(1, ROW_H + 4);
      drawHRule(curY, 1.2, BLACK);
      pdfDoc.text('REGIONAL TOTAL', CONTENT_LEFT + 6, curY + 6, {
        color: BLACK, fontSize: 9, bold: true
      });
      pdfDoc.text(formatPhp(regionalIncome),  colX.income  + COL_INCOME  - 5, curY + 6, { color: BLACK, fontSize: 9, bold: true, align: 'right' });
      pdfDoc.text(formatPhp(regionalSubsidy), colX.subsidy + COL_SUBSIDY - 5, curY + 6, { color: BLACK, fontSize: 9, bold: true, align: 'right' });
      pdfDoc.text(formatPhp(regionalAmount),  colX.amount  + COL_AMOUNT  - 5, curY + 6, { color: BLACK, fontSize: 9, bold: true, align: 'right' });
      curY += ROW_H + 9;
      }

      // ============================================================
      // SIGNATURE BLOCK
      // Plain lines — no boxes, no fills
      // ============================================================
      if (useRegionMatrix && curY + (ROW_H * 10) > FOOTER_Y - 8) {
        pdfDoc.endPage();
        pageNo += 1;
        pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        drawPageChrome();
        drawContinuationHeader();
      } else if (!useRegionMatrix) {
        ensureSpace(10);
      }
      signatoriesInfo = await enrichSignatoriesWithPositionTitle(signatoriesInfo);
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
        const filename = `Consolidated_MOOE_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`;
        res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('X-Document-ID', documentId);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Document-ID');
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
      const format = String(req.query.format || 'xlsx').toLowerCase();
      if (!['xlsx', 'excel'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Use xlsx.'
        });
      }

      let reportPayload;
      let reportStatusCode = 200;
      const captureResponse = {
        status(code) {
          reportStatusCode = code;
          return this;
        },
        json(payload) {
          reportPayload = payload;
          return this;
        }
      };

      await consolidatedReportsController.getConsolidatedData(req, captureResponse);
      if (reportStatusCode >= 400 || !reportPayload?.success) {
        throw new Error(reportPayload?.message || 'Unable to load budget proposals for export.');
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'FMIS-BUDGET';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Budget Proposals', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
        }
      });

      worksheet.columns = [
        { key: 'region', width: 22 },
        { key: 'category', width: 34 },
        { key: 'uacsCode', width: 18 },
        { key: 'accountingTitle', width: 52 },
        { key: 'income', width: 18 },
        { key: 'subsidy', width: 18 },
        { key: 'amount', width: 18 },
        { key: 'total', width: 18 }
      ];

      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = getConsolidatedMooeTitle(req.query.budgetType);
      titleCell.font = { bold: true, size: 15, color: { argb: 'FF1F4D2E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 26;

      const selectedRegions = req.query.regions
        ? (Array.isArray(req.query.regions) ? req.query.regions : [req.query.regions]).join(', ')
        : 'All accessible regions';
      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = `Fiscal Year: ${req.query.fiscalYear || 'All Years'} | Budget Type: ${req.query.budgetType || 'All'} | Region: ${selectedRegions}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      worksheet.getCell('A2').font = { size: 10, color: { argb: 'FF475569' } };

      const organizationParts = [req.query.department, req.query.division].filter(Boolean);
      worksheet.mergeCells('A3:H3');
      worksheet.getCell('A3').value = organizationParts.length > 0
        ? organizationParts.join(' / ')
        : `Generated: ${new Date().toLocaleString('en-PH')}`;
      worksheet.getCell('A3').alignment = { horizontal: 'center' };
      worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

      const headerRow = worksheet.getRow(5);
      headerRow.values = ['Region', 'Category', 'UACS Code', 'Accounting Title / Line Item', 'Income', 'Subsidy', 'Amount', 'Total'];
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF375E38' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF27452A' } },
          left: { style: 'thin', color: { argb: 'FF27452A' } },
          bottom: { style: 'thin', color: { argb: 'FF27452A' } },
          right: { style: 'thin', color: { argb: 'FF27452A' } }
        };
      });
      worksheet.autoFilter = 'A5:H5';

      const currencyFormat = '₱#,##0.00;[Red]-₱#,##0.00';
      const regionalTotals = { income: 0, subsidy: 0, amount: 0, total: 0 };
      (reportPayload.data || []).forEach((group) => {
        (group.items || []).forEach((item) => {
          const income = Number(item.income || 0);
          const subsidy = Number(item.subsidy || 0);
          const amount = Number(item.amount || 0);
          const total = income + subsidy + amount;
          const row = worksheet.addRow({
            region: group.region,
            category: group.category,
            uacsCode: item.uacsCode,
            accountingTitle: item.accountingTitle,
            income,
            subsidy,
            amount,
            total
          });
          row.alignment = { vertical: 'top', wrapText: true };
          [5, 6, 7, 8].forEach((columnNumber) => {
            row.getCell(columnNumber).numFmt = currencyFormat;
            row.getCell(columnNumber).alignment = { horizontal: 'right', vertical: 'top' };
          });

          regionalTotals.income += income;
          regionalTotals.subsidy += subsidy;
          regionalTotals.amount += amount;
          regionalTotals.total += total;
        });
      });

      if ((reportPayload.data || []).length === 0) {
        worksheet.mergeCells('A6:H6');
        worksheet.getCell('A6').value = 'No budget proposals found for the selected filters.';
        worksheet.getCell('A6').alignment = { horizontal: 'center' };
        worksheet.getCell('A6').font = { italic: true, color: { argb: 'FF64748B' } };
      } else {
        const totalRow = worksheet.addRow([
          'REGIONAL TOTAL', '', '', '', regionalTotals.income, regionalTotals.subsidy, regionalTotals.amount, regionalTotals.total
        ]);
        totalRow.font = { bold: true, color: { argb: 'FF1F2937' } };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1E9' } };
        totalRow.eachCell((cell) => {
          cell.border = { top: { style: 'medium', color: { argb: 'FF375E38' } } };
        });
        [5, 6, 7, 8].forEach((columnNumber) => {
          totalRow.getCell(columnNumber).numFmt = currencyFormat;
          totalRow.getCell(columnNumber).alignment = { horizontal: 'right' };
        });
      }

      worksheet.getColumn(3).numFmt = '@';
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 5) row.height = Math.max(row.height || 15, 18);
      });
      worksheet.headerFooter.oddFooter = '&LFMIS-BUDGET&CPage &P of &N&R&D';

      const safeFiscalYear = String(req.query.fiscalYear || 'ALL').replace(/[^A-Za-z0-9_-]/g, '_');
      const safeBudgetType = String(req.query.budgetType || 'ALL').replace(/[^A-Za-z0-9_-]/g, '_');
      const filename = `Consolidated_MOOE_${safeFiscalYear}_${safeBudgetType}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return res.status(200).send(Buffer.from(buffer));
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

consolidatedReportsController._private = {
  buildMooeRegionMatrix,
  chunkMooeMatrixRegions,
  getConsolidatedMooeTitle,
  getMatrixFinancialColumns,
  getMooeMatrixPdfDetailHeight,
  getMooeMatrixPdfLayout,
  getMooeMatrixRegionsPerPage,
  getMooeMatrixPdfSubheaders,
  sumFinancialValues,
};

module.exports = consolidatedReportsController;
