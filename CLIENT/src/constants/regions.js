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
  const itemRegion = getItemRegion(item);
  return itemRegion === targetRegion;
};

export const getRegionErrorMessage = (region, error) => {
  return `${region || REGIONS.DEFAULT_REGION} error: ${error.response?.data?.error || error.message}`;
};

export const getDefaultRegionForSave = (regionFilter) => {
  return regionFilter || REGIONS.DEFAULT_REGION;
};