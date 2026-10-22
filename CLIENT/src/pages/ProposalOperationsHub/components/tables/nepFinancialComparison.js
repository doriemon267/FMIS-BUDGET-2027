const valueOf = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const NEP_WORKSPACE_MODULES = Object.freeze([
  { key: 'income', label: 'Corporate Income' },
  { key: 'personnel', label: 'Personnel Services' },
  { key: 'mooe', label: 'MOOE' },
  { key: 'capital', label: 'Capital Outlay' },
]);

const DISPLAY_FIELDS = [
  'categoryName',
  'name',
  'title',
  'label',
  'sublineItem',
  'accountingTitle',
  'particulars',
  'itemName',
  'uacsCode',
  'code',
  'value',
];

export const toDisplayString = (value, fallback = '', seen = new WeakSet()) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return fallback;
    seen.add(value);
    for (const entry of value) {
      const resolved = toDisplayString(entry, '', seen);
      if (resolved) return resolved;
    }
    return fallback;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return fallback;
    seen.add(value);
    for (const field of DISPLAY_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
      const resolved = toDisplayString(value[field], '', seen);
      if (resolved) return resolved;
    }
  }
  return fallback;
};

const normalize = value =>
  toDisplayString(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const getDefinition = (moduleKey, item) => {
  if (moduleKey === 'income') {
    return {
      section: toDisplayString(
        item.category ||
          item.categoryName ||
          item.type ||
          item.incomecategory?.name ||
          item.incomecategory?.incomeCategoryName,
        'Corporate Income'
      ),
      label: toDisplayString(
        item.particulars || item.itemName || item.title,
        'Income item'
      ),
      code: toDisplayString(item.uacsCode),
    };
  }
  if (moduleKey === 'mooe') {
    return {
      section: toDisplayString(item.sublineItem || item.sublimeItem, 'Other Expenses'),
      label: toDisplayString(item.accountingTitle || item.particulars, 'MOOE item'),
      code: toDisplayString(item.uacsCode),
    };
  }
  return {
    section: toDisplayString(item.category || item.sublineItem, 'Capital Outlay'),
    label: toDisplayString(
      item.accountingTitle || item.particulars || item.sublineItem,
      'Capital item'
    ),
    code: toDisplayString(item.uacsCode),
  };
};

export const buildFinancialComparisonSections = ({
  moduleKey,
  initialItems = [],
  currentItems = [],
}) => {
  const getRowIdentity = item => {
    const definition = getDefinition(moduleKey, item);
    const mergeKey = [definition.section, definition.label, definition.code]
      .map(normalize)
      .join('|');
    return { definition, mergeKey };
  };
  const sections = new Map();

  const ensureRow = (definition, mergeKey) => {
    if (!sections.has(definition.section)) sections.set(definition.section, new Map());
    const rows = sections.get(definition.section);
    if (!rows.has(mergeKey)) {
      rows.set(mergeKey, {
        ...definition,
        mergeKey,
        sourceIndices: [],
        initialIncome: 0,
        initialSubsidy: 0,
        nepIncome: 0,
        nepSubsidy: 0,
        initialAmount: 0,
        proposedAmount: 0,
        hasInitialBaseline: false,
        hasDurableBaseline: true,
      });
    }
    return rows.get(mergeKey);
  };

  // Build the locked side from the Initial proposal's own row identity. The
  // generated NEP may merge duplicate Capital Outlay rows, so array positions
  // are not a reliable way to match its rows back to the Initial proposal.
  initialItems.forEach(item => {
    const { definition, mergeKey } = getRowIdentity(item);
    const row = ensureRow(definition, mergeKey);
    row.hasInitialBaseline = true;
    if (moduleKey === 'income') {
      row.initialAmount += valueOf(item.amount);
    } else {
      row.initialIncome += valueOf(item.income);
      row.initialSubsidy += valueOf(item.subsidy);
    }
  });

  currentItems.forEach((item, sourceIndex) => {
    const { definition, mergeKey } = getRowIdentity(item);
    const row = ensureRow(definition, mergeKey);
    row.sourceIndices.push(sourceIndex);
    if (moduleKey === 'income') {
      row.proposedAmount += valueOf(item.amount);
    } else {
      row.nepIncome += valueOf(item.income);
      row.nepSubsidy += valueOf(item.subsidy);
    }
  });

  return Array.from(sections, ([title, rows]) => ({
    title,
    rows: Array.from(rows.values()).map(row => ({
      ...row,
      hasDurableBaseline: row.hasInitialBaseline && row.hasDurableBaseline,
    })),
  }));
};

export const getFinancialComparisonTotals = (moduleKey, sections) =>
  sections.flatMap(section => section.rows).reduce(
    (totals, row) => {
      if (moduleKey === 'income') {
        totals.initial += row.initialAmount;
        totals.proposed += row.proposedAmount;
      } else {
        totals.initialIncome += row.initialIncome;
        totals.initialSubsidy += row.initialSubsidy;
        totals.nepIncome += row.nepIncome;
        totals.nepSubsidy += row.nepSubsidy;
        totals.initial += row.initialIncome + row.initialSubsidy;
        totals.proposed += row.nepIncome + row.nepSubsidy;
      }
      totals.hasDurableBaseline = totals.hasDurableBaseline && row.hasDurableBaseline;
      return totals;
    },
    {
      initial: 0,
      proposed: 0,
      initialIncome: 0,
      initialSubsidy: 0,
      nepIncome: 0,
      nepSubsidy: 0,
      hasDurableBaseline: true,
    }
  );

export const getModuleComparisonTotals = ({ moduleKey, initialItems, currentItems }) => {
  const sections = buildFinancialComparisonSections({ moduleKey, initialItems, currentItems });
  return getFinancialComparisonTotals(moduleKey, sections);
};
