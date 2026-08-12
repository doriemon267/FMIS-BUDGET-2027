const FOLIO_PORTRAIT = Object.freeze({ width: 612, height: 936 });
const FOLIO_LANDSCAPE = Object.freeze({ width: 936, height: 612 });

const isAllRegionsSelection = ({ consolidationType, selectedRegions, regions } = {}) => {
  const isAll = (value) => String(value || '').trim().toLowerCase() === 'all';

  if (isAll(consolidationType) || isAll(selectedRegions) || isAll(regions)) {
    return true;
  }

  return Array.isArray(regions) && regions.filter(Boolean).length > 1;
};

const getFolioPageSize = (landscape) => (
  landscape ? FOLIO_LANDSCAPE : FOLIO_PORTRAIT
);

module.exports = {
  getFolioPageSize,
  isAllRegionsSelection
};
