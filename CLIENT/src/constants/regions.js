// Region and organizational constants
export const REGIONS = {
  CENTRAL_OFFICE: "Central Office",
  DEFAULT_REGION: "Central Office"
};

// Utility functions for region handling
export const getItemRegion = (item) => {
  return item.region || REGIONS.DEFAULT_REGION;
};

export const doesItemBelongToRegion = (item, targetRegion) => {
  const normalize = (value) => {
    if (!value) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const aliasMap = {
    'central office': 'central office',
    'region central office': 'central office',
    'co': 'central office',
    'ria central office': 'central office'
  };

  const normalizeWithAlias = (value) => {
    const norm = normalize(value);
    return aliasMap[norm] || norm;
  };

  const itemRegionRaw = item.region || item.Region || item.meta?.region || item.meta?.Region || REGIONS.DEFAULT_REGION;
  const itemRegion = normalizeWithAlias(itemRegionRaw);
  const target = normalizeWithAlias(targetRegion || REGIONS.DEFAULT_REGION);

  // Treat empty target as match-all
  if (!target) return true;
  return itemRegion === target;
};

export const getRegionErrorMessage = (region, error) => {
  return `${region || REGIONS.DEFAULT_REGION} error: ${error.response?.data?.error || error.message}`;
};

export const getDefaultRegionForSave = (regionFilter) => {
  return regionFilter || REGIONS.DEFAULT_REGION;
};