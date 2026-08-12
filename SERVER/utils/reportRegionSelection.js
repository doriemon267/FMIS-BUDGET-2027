const getRegionsWithReportEntries = (entries = []) => {
  const regionNames = new Map();

  entries.forEach((entry) => {
    const regionName = String(entry?.region || '').trim();
    if (!regionName) return;

    const normalizedName = regionName.toLowerCase();
    if (!regionNames.has(normalizedName)) {
      regionNames.set(normalizedName, regionName);
    }
  });

  return Array.from(regionNames.values())
    .sort((a, b) => a.localeCompare(b))
    .map((Region) => ({ Region }));
};

module.exports = { getRegionsWithReportEntries };
