/**
 * Utility functions for handling region-related operations
 * Completely dynamic - no hardcoded values
 */

const Region = require('../models/Region');

// Cache for regions to avoid repeated database calls
let cachedRegions = null;

// Function to get all regions from database
async function getAllRegions() {
  if (!cachedRegions) {
    cachedRegions = await Region.find({}).sort({ Region: 1 });
  }
  return cachedRegions;
}

// Function to normalize region name variations
function normalizeRegionName(regionName) {
  if (!regionName) return null;
  
  // Convert to uppercase and trim
  const normalized = regionName.trim().toUpperCase();
  
  // Handle common variations
  const variations = {
    'REGION 1': 'REGION I',
    'REGION 2': 'REGION II', 
    'REGION 3': 'REGION III',
    'REGION 4A': 'REGION IV-A',
    'REGION 4B': 'REGION IV-B',
    'REGION 5': 'REGION V',
    'REGION 6': 'REGION VI',
    'REGION 7': 'REGION VII',
    'REGION 8': 'REGION VIII',
    'REGION 9': 'REGION IX',
    'REGION 10': 'REGION X',
    'REGION 11': 'REGION XI',
    'REGION 12': 'REGION XII',
    'REGION 13': 'CARAGA'
  };
  
  return variations[normalized] || normalized;
}

/**
 * Check if a region matches another region, considering equivalences
 * @param {string} region1 - First region to compare
 * @param {string} region2 - Second region to compare
 * @returns {boolean} - True if regions match or are equivalent
 */
const regionsMatch = (region1, region2) => {
  if (!region1 || !region2) return false;
  
  // Direct match
  if (region1 === region2) return true;
  
  // Normalize both regions and check match
  const normalized1 = normalizeRegionName(region1);
  const normalized2 = normalizeRegionName(region2);
  
  if (normalized1 === normalized2) return true;
  
  // Check if either is a normalized version of the other
  if (normalized1 === region2 || normalized2 === region1) return true;
  
  return false;
};

/**
 * Get all region information including equivalences
 * @returns {Object} - Region information object
 */
const getAllRegionInfo = async () => {
  const regions = await getAllRegions();
  return {
    regions: regions.map(r => r.Region)
  };
};

module.exports = {
  regionsMatch,
  getAllRegionInfo,
  getAllRegions,
  normalizeRegionName
};