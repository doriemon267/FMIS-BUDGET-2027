const FOLIO_PORTRAIT = Object.freeze({ width: 612, height: 936 });
const FOLIO_LANDSCAPE = Object.freeze({ width: 936, height: 612 });

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toRegionValues = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toRegionValues(entry));
  }

  if (value === undefined || value === null) return [];
  return [String(value).trim()].filter(Boolean);
};

const normalizeRegionSelection = ({
  consolidationType,
  region,
  regions,
  selectedRegions,
} = {}) => {
  const isAll = (value) => String(value || '').trim().toLowerCase() === 'all';
  const explicitValues = regions !== undefined
    ? toRegionValues(regions)
    : selectedRegions !== undefined
      ? toRegionValues(selectedRegions)
      : toRegionValues(region);

  if (isAll(consolidationType) || explicitValues.some(isAll) || isAll(region)) {
    return { isAll: true, regions: [] };
  }

  const seen = new Set();
  const normalizedRegions = [];
  explicitValues.forEach((value) => {
    const normalizedKey = value.toLowerCase();
    if (seen.has(normalizedKey)) return;
    seen.add(normalizedKey);
    normalizedRegions.push(value);
  });

  return { isAll: false, regions: normalizedRegions };
};

const buildExactRegionMongoFilter = (regions) => {
  const normalized = normalizeRegionSelection({ regions }).regions;
  if (normalized.length === 0) return null;

  const exactPatterns = normalized.map(
    (regionName) => new RegExp(`^${escapeRegExp(regionName)}$`, 'i')
  );
  return exactPatterns.length === 1
    ? { $regex: exactPatterns[0] }
    : { $in: exactPatterns };
};

const getRegionalCoverageLabel = ({ isAll = false, regions = [] } = {}) => {
  const selection = normalizeRegionSelection({ regions });
  if (isAll || selection.isAll) return 'All Regions';
  if (selection.regions.length === 0) return 'No Region Selected';
  if (selection.regions.length === 1) return selection.regions[0];
  return `${selection.regions.length} Selected Regions`;
};

const isAllRegionsSelection = ({ consolidationType, selectedRegions, regions } = {}) => {
  const isAll = (value) => String(value || '').trim().toLowerCase() === 'all';

  if (isAll(consolidationType) || isAll(selectedRegions) || isAll(regions)) {
    return true;
  }

  return [regions, selectedRegions].some(
    (value) => Array.isArray(value) && value.filter(Boolean).length > 1
  );
};

const getFolioPageSize = (landscape) => (
  landscape ? FOLIO_LANDSCAPE : FOLIO_PORTRAIT
);

module.exports = {
  buildExactRegionMongoFilter,
  getFolioPageSize,
  getRegionalCoverageLabel,
  isAllRegionsSelection,
  normalizeRegionSelection,
};
