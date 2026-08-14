const normalizeValue = (value) => Number(value || 0);

const createValues = (columns) => Object.fromEntries(columns.map((column) => [column, 0]));

const addValues = (target, source, columns) => {
  columns.forEach((column) => {
    target[column] += normalizeValue(source?.[column]);
  });
};

const hasValues = (values, columns) => columns.some((column) => normalizeValue(values?.[column]) !== 0);

const buildRegionalReportMatrix = (records = [], columns = ['amount']) => {
  const safeColumns = [...new Set(columns.filter(Boolean))];
  const rowMap = new Map();
  const totalsByRegion = {};
  const regionalTotal = createValues(safeColumns);

  (records || []).forEach((record) => {
    const region = String(record?.region || '').trim();
    const section = String(record?.section || 'Uncategorized').trim() || 'Uncategorized';
    const particulars = String(record?.particulars || '').trim();
    const values = Object.fromEntries(safeColumns.map((column) => [column, normalizeValue(record?.values?.[column])]));
    if (!region || !particulars || !hasValues(values, safeColumns)) return;

    if (!totalsByRegion[region]) totalsByRegion[region] = createValues(safeColumns);
    const identity = `${section}\u001f${particulars}`;
    if (!rowMap.has(identity)) {
      rowMap.set(identity, {
        id: identity,
        section,
        particulars,
        valuesByRegion: {},
        totals: createValues(safeColumns),
      });
    }

    const row = rowMap.get(identity);
    if (!row.valuesByRegion[region]) row.valuesByRegion[region] = createValues(safeColumns);
    addValues(row.valuesByRegion[region], values, safeColumns);
    addValues(row.totals, values, safeColumns);
    addValues(totalsByRegion[region], values, safeColumns);
    addValues(regionalTotal, values, safeColumns);
  });

  const regions = Object.keys(totalsByRegion).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const sectionMap = new Map();
  [...rowMap.values()]
    .sort((a, b) => a.section.localeCompare(b.section, 'en', { sensitivity: 'base' }) || a.particulars.localeCompare(b.particulars, 'en', { sensitivity: 'base' }))
    .forEach((row) => {
      if (!sectionMap.has(row.section)) sectionMap.set(row.section, []);
      sectionMap.get(row.section).push(row);
    });

  return {
    columns: safeColumns,
    regions,
    sections: [...sectionMap.entries()].map(([name, rows]) => ({ id: name, name, rows })),
    totalsByRegion: Object.fromEntries(regions.map((region) => [region, totalsByRegion[region]])),
    regionalTotal,
  };
};

const chunkRegionalMatrixRegions = (regions = [], capacity = 1) => {
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safeCapacity = Math.max(1, Math.floor(Number(capacity || 1)));
  return Array.from(
    { length: Math.ceil(safeRegions.length / safeCapacity) },
    (_, index) => safeRegions.slice(index * safeCapacity, (index + 1) * safeCapacity)
  );
};

const needsCleanMatrixSignaturePage = ({
  currentY,
  requiredHeight,
  pageHeight,
  margin,
  footerClearance = 22,
}) => Number(currentY || 0) + Number(requiredHeight || 0)
  > Number(pageHeight || 0) - Number(margin || 0) - Number(footerClearance || 0);

module.exports = {
  buildRegionalReportMatrix,
  chunkRegionalMatrixRegions,
  needsCleanMatrixSignaturePage,
};
