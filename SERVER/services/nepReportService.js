const { buildNepCeilingComplianceReport } = require('./nepCeilingService');
const { getNepReportStatus } = require('../utils/nepReportStatus');

const MONEY_TOLERANCE = 0.009;

const finiteMoney = (value, field) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${field} must be a finite, non-negative amount`);
    error.statusCode = 400;
    throw error;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const normalizeCategory = value => {
  const category = String(value || '').trim().toUpperCase();
  if (category === 'PERSONNEL' || category === 'PERSONNEL SERVICES') {
    return { key: 'personnelServices', modelValue: 'Personnel', label: 'Personnel Services' };
  }
  if (category === 'MOOE' || category === 'MAINTENANCE AND OTHER OPERATING EXPENSES') {
    return { key: 'mooe', modelValue: 'MOOE', label: 'Maintenance and Other Operating Expenses' };
  }
  if (category === 'CAPITAL OUTLAY') {
    return { key: 'capitalOutlay', modelValue: 'Capital Outlay', label: 'Capital Outlay' };
  }
  const error = new Error(`Unsupported NEP report category: ${value || 'blank'}`);
  error.statusCode = 400;
  throw error;
};

const normalizeScopeValue = value => String(value || '').trim().toUpperCase();

const nepReportScopesMatch = (expected, requested) =>
  ['fiscalYear', 'region', 'department', 'division'].every(
    field => normalizeScopeValue(expected?.[field]) === normalizeScopeValue(requested?.[field])
  );

const getTierReportLineItemLabel = (item, isNepAlignment = false) => {
  if (isNepAlignment && normalizeCategory(item?.category).key === 'mooe') {
    const lineItemId = String(item?.lineItemId || '');
    const parentPrefix = 'Maintenance and Other Operating Expenses-parent-';
    if (lineItemId.startsWith(parentPrefix)) {
      return lineItemId.slice(parentPrefix.length).trim() || '—';
    }
    return String(item?.subCategory || item?.description || item?.lineItemId || '—').trim();
  }
  return String(item?.description || item?.subCategory || item?.lineItemId || '—').trim();
};

const assertNepReportAccess = (context, user) => {
  const userId = String(user?.id || user?._id || user?.UserId || '');
  const rawRoles = Array.isArray(user?.Roles) ? user.Roles : [user?.Roles].filter(Boolean);
  const roles = rawRoles.map(role => String(role).toUpperCase().trim().replace(/\s+/g, '_'));
  const privileged = roles.some(role => [
    'PREPARER',
    'BUDGET_PREPARER',
    'BUDGET_REVIEWER',
    'BUDGET_APPROVER',
    'BUDGET_PLANNING_ANALYST',
    'BUDGET_OFFICER',
    'BUDGET_MANAGER',
    'OVERALL_BUDGET_APPROVER',
    'SUPER_ADMIN'
  ].includes(role));
  const assigned = (context?.proposal?.assignedPreparerUserIds || [])
    .some(assignedId => String(assignedId) === userId);
  const creator = String(context?.proposal?.createdBy || '') === userId;
  if (!privileged && !assigned && !creator) {
    const error = new Error('Access denied for this NEP ceiling allocation');
    error.statusCode = 403;
    throw error;
  }
};

const distributeCategoryIncome = (rows, categoryIncome) => {
  const totalWeight = rows.reduce((sum, row) => sum + row.tier1 + row.tier2, 0);
  let allocated = 0;
  return rows.map((row, index) => {
    const isLast = index === rows.length - 1;
    const share = isLast
      ? categoryIncome - allocated
      : totalWeight > 0
        ? Math.round(((row.tier1 + row.tier2) / totalWeight * categoryIncome + Number.EPSILON) * 100) / 100
        : index === 0
          ? categoryIncome
          : 0;
    allocated += share;
    return { ...row, corporateIncome: share, proposedBudget: row.total + share };
  });
};

const buildAuthoritativeNepSummary = ({ reportSummary, categoryIncome = {} }) => {
  if (!Array.isArray(reportSummary?.lineItems)) {
    const error = new Error('NEP report line items are required');
    error.statusCode = 400;
    throw error;
  }

  const categoryRows = { personnelServices: [], mooe: [], capitalOutlay: [] };
  reportSummary.lineItems.forEach((item, index) => {
    const category = normalizeCategory(item?.category);
    const tier1 = finiteMoney(item?.tier1, `lineItems[${index}].tier1`);
    const tier2 = finiteMoney(item?.tier2, `lineItems[${index}].tier2`);
    categoryRows[category.key].push({
      lineItemId: String(item?.lineItemId || ''),
      category: category.label,
      subCategory: String(item?.subCategory || ''),
      description: getTierReportLineItemLabel(item, true),
      referenceNote: String(item?.referenceNote || ''),
      tier1,
      tier2,
      total: tier1 + tier2,
    });
  });

  const canonicalIncome = {
    personnelServices: finiteMoney(categoryIncome.personnelServices, 'Personnel Services income'),
    mooe: finiteMoney(categoryIncome.mooe, 'MOOE income'),
    capitalOutlay: finiteMoney(categoryIncome.capitalOutlay, 'Capital Outlay income'),
  };
  const lineItems = [];
  Object.entries(categoryRows).forEach(([key, rows]) => {
    lineItems.push(...distributeCategoryIncome(rows, canonicalIncome[key]));
  });

  const tierTotals = lineItems.reduce((totals, row) => {
    const key = normalizeCategory(row.category).key;
    totals.tier1 += row.tier1;
    totals.tier2 += row.tier2;
    totals[key].tier1 += row.tier1;
    totals[key].tier2 += row.tier2;
    totals[key].total += row.total;
    return totals;
  }, {
    tier1: 0,
    tier2: 0,
    personnelServices: { tier1: 0, tier2: 0, total: 0 },
    mooe: { tier1: 0, tier2: 0, total: 0 },
    capitalOutlay: { tier1: 0, tier2: 0, total: 0 },
  });
  const corporateIncome = Object.values(canonicalIncome).reduce((sum, value) => sum + value, 0);
  const subsidy = tierTotals.tier1 + tierTotals.tier2;
  const proposedBudget = corporateIncome + subsidy;

  const usesOfFunds = {
    'Personnel Services': tierTotals.personnelServices,
    'Maintenance and Other Operating Expenses': tierTotals.mooe,
    'Capital Outlay': tierTotals.capitalOutlay,
    tier1: tierTotals.tier1,
    tier2: tierTotals.tier2,
    total: subsidy,
    proposedBudget,
  };
  return {
    lineItems,
    usesCorporateIncome: {
      'Personnel Services': canonicalIncome.personnelServices,
      'Maintenance and Other Operating Expenses': canonicalIncome.mooe,
      'Capital Outlay': canonicalIncome.capitalOutlay,
    },
    usesOfFunds,
    sourcesOfFunds: {
      corporateIncome,
      budgetarySupport: { tier1: tierTotals.tier1, tier2: tierTotals.tier2, total: subsidy },
      total: proposedBudget,
      proposedBudget,
    },
    surplusDeficit: 0,
  };
};

const liveRowsMatchSavedTier = (lineItems, savedTier) => {
  if (!savedTier || !Array.isArray(savedTier.items)) return false;
  const saved = new Map(savedTier.items.map(item => [String(item.lineItemId || ''), item]));
  const live = new Map(lineItems.map(item => [String(item.lineItemId || ''), item]));
  if (lineItems.some(item => !item.lineItemId)) return false;

  const amountsMatch = (left, right) =>
    Math.abs(Number(left || 0) - Number(right || 0)) <= MONEY_TOLERANCE;
  for (const [id, item] of live) {
    const savedItem = saved.get(id);
    if (!savedItem || !amountsMatch(item.tier1, savedItem.tier1) || !amountsMatch(item.tier2, savedItem.tier2)) {
      return false;
    }
  }
  for (const [id, item] of saved) {
    if (Number(item.tier1 || 0) + Number(item.tier2 || 0) > MONEY_TOLERANCE && !live.has(id)) {
      return false;
    }
  }
  return true;
};

const buildAuthoritativeNepReport = ({
  reportSummary,
  allocation,
  serializedContext,
  categoryIncome,
  savedTier,
  clientClaimsDirty = false,
}) => {
  const authoritativeSummary = buildAuthoritativeNepSummary({ reportSummary, categoryIncome });
  const sources = authoritativeSummary.sourcesOfFunds;
  const uses = authoritativeSummary.usesOfFunds;
  const income = authoritativeSummary.usesCorporateIncome;
  const totals = {
    expenses: sources.proposedBudget,
    proposedBudget: sources.proposedBudget,
    subsidies: sources.budgetarySupport.total,
    personnel: uses['Personnel Services'].total + income['Personnel Services'],
    mooe: uses['Maintenance and Other Operating Expenses'].total + income['Maintenance and Other Operating Expenses'],
    capitalOutlay: uses['Capital Outlay'].total + income['Capital Outlay'],
  };
  const compliance = buildNepCeilingComplianceReport({ totals, allocation });
  const hasUnsavedChanges = Boolean(clientClaimsDirty) ||
    !liveRowsMatchSavedTier(authoritativeSummary.lineItems, savedTier);
  const status = getNepReportStatus({ compliance, hasUnsavedChanges });

  return {
    reportSummary: authoritativeSummary,
    reportContext: {
      ...serializedContext,
      compliance,
    },
    hasUnsavedChanges,
    status,
  };
};

module.exports = {
  MONEY_TOLERANCE,
  assertNepReportAccess,
  buildAuthoritativeNepReport,
  buildAuthoritativeNepSummary,
  getTierReportLineItemLabel,
  liveRowsMatchSavedTier,
  nepReportScopesMatch,
};
