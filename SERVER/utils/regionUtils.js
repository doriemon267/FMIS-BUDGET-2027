/**
 * Utility functions for handling region-related operations
 * Completely dynamic - no hardcoded values
 */
const mongoose = require('mongoose');
const Region = require('../models/Region');

/**
 * Resolve region param (name like "CENTRAL OFFICE" or ObjectId string) to MongoDB ObjectId.
 * Use when querying models that store region as ObjectId (e.g. NewProposalWorkflow).
 * @param {string|mongoose.Types.ObjectId} region - Region name or 24-char hex ObjectId string
 * @returns {Promise<mongoose.Types.ObjectId|null>} - ObjectId or null if not found/invalid
 */
async function resolveRegionToObjectId(region) {
  if (!region || (typeof region !== 'string' && !(region instanceof mongoose.Types.ObjectId))) return null;
  const str = String(region).trim();
  if (!str) return null;
  if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) {
    return new mongoose.Types.ObjectId(str);
  }
  const doc = await Region.findOne({
    $or: [
      { Region: new RegExp(`^${str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { regionName: new RegExp(`^${str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { name: new RegExp(`^${str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  }).select('_id').lean();
  return doc ? doc._id : null;
}
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
/**
 * Clean up query: ensure 'region' field only contains valid ObjectIds or arrays of ObjectIds
 * to prevent Mongoose CastError when searching models that store region as ObjectId (e.g. NewProposalWorkflow).
 * @param {Object} q - MongoDB query object
 * @returns {Promise<Object>} - Sanitized query object
 */
async function sanitizeWorkflowQuery(q) {
  if (!q || typeof q !== 'object') return q;
  
  const sanitized = Array.isArray(q) ? [] : {};
  for (const [key, value] of Object.entries(q)) {
    if (key === 'region') {
      if (typeof value === 'string' && value.length > 0) {
        // If it's already a valid ObjectId string, Mongoose handles it. 
        // If it's a region name (e.g. "REGION IV-A"), resolve it.
        if (!/^[0-9a-fA-F]{24}$/.test(value)) {
          const resolved = await resolveRegionToObjectId(value);
          sanitized[key] = resolved || new mongoose.Types.ObjectId(); // Use dummy if not found to ensure empty results instead of CastError
        } else {
          sanitized[key] = value;
        }
      } else if (Array.isArray(value)) {
        const resolvedIds = await Promise.all(
          value.map(async (v) => {
            if (typeof v === 'string' && v.length > 0 && !/^[0-9a-fA-F]{24}$/.test(v)) {
              return await resolveRegionToObjectId(v);
            }
            return v;
          })
        );
        const filteredIds = resolvedIds.filter(id => id != null);
        if (filteredIds.length > 0) {
           sanitized[key] = { $in: filteredIds };
        } else {
           sanitized[key] = new mongoose.Types.ObjectId(); // Dummy if none found
        }
      } else if (value && typeof value === 'object' && value.$in && Array.isArray(value.$in)) {
        const resolvedIds = await Promise.all(
          value.$in.map(async (v) => {
            if (typeof v === 'string' && v.length > 0 && !/^[0-9a-fA-F]{24}$/.test(v)) {
              return await resolveRegionToObjectId(v);
            }
            return v;
          })
        );
        sanitized[key] = { $in: resolvedIds.filter(id => id != null) };
      } else {
        sanitized[key] = value;
      }
    } else if (key === '$or' || key === '$and' || key === '$nor') {
      sanitized[key] = await Promise.all(value.map(item => sanitizeWorkflowQuery(item)));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

module.exports = {
  regionsMatch,
  getAllRegionInfo,
  getAllRegions,
  normalizeRegionName,
  resolveRegionToObjectId,
  sanitizeWorkflowQuery,
};