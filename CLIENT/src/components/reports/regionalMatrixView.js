export const sumRegionalMatrixRows = (rows, region, columns) => (rows || []).reduce((totals, row) => {
  const values = region ? row.valuesByRegion?.[region] : row.totals;
  columns.forEach(({ key }) => { totals[key] += Number(values?.[key] || 0); });
  return totals;
}, Object.fromEntries(columns.map(({ key }) => [key, 0])));

export const getRegionalMatrixView = (matrix, columns, searchTerm = '') => {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sections = (matrix?.sections || []).map((section) => ({
    ...section,
    rows: (section.rows || []).filter((row) => !normalizedSearch || [section.name, row.particulars]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch))),
  })).filter((section) => section.rows.length > 0);
  const rows = sections.flatMap((section) => section.rows);

  return {
    sections,
    rows,
    regionCount: (matrix?.regions || []).length,
    sectionCount: sections.length,
    rowCount: rows.length,
    totals: sumRegionalMatrixRows(rows, null, columns),
  };
};
