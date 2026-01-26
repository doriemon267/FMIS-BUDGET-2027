/**
 * 🔍 Budget Planning Analyst Access Control Middleware
 * 
 * This middleware implements region-based filtering specifically for Budget Planning Analyst users.
 * 
 * Features:
 * - Filters proposals based on assigned regions or NIA-Wide access
 * - If NIA-Wide: User can access proposals from all regions
 * - If specific regions: User can only access proposals from those regions
 * - Routes incoming proposals to the correct analyst based on submitter's region
 * 
 * Implementation:
 * - NIA-Wide (isNIAWide=true): No region restrictions
 * - Specific Regions (isNIAWide=false): Filter by assignedRegions array
 */

const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { hasFullAccess } = require('./securityMiddleware');

/**
 * Middleware to filter proposals for Budget Planning Analyst users
 * @param {string} operation - 'read' to filter accessible proposals
 * @returns {Function} Express middleware function
 */
const budgetPlanningAnalystAccessControl = (operation = 'read') => {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.Roles || [];
      
      // Skip for non-Budget Planning Analyst users
      const isBudgetPlanningAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST');
      if (!isBudgetPlanningAnalyst) {
        return next();
      }

      // Full access bypass
      if (hasFullAccess(userRoles)) {
        return next();
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Get user's assignment to check region configuration
      const assignment = await HierarchicalUserAssignment.findOne({ 
        userId, 
        isActive: true,
        userRole: 'BUDGET_PLANNING_ANALYST'
      }).populate('assignedRegions', 'Region regionName RegionName _id');

      if (!assignment) {
        // No assignment found, but allow user to access system
        // Frontend will show notification to create assignment
        console.warn(`⚠️ Budget Planning Analyst ${userId} has no active assignment - needs setup`);
        req.analystAccessControl = {
          isNIAWide: false,
          assignedRegions: [],
          restrictionType: 'NO_ASSIGNMENT',
          needsAssignment: true,
          message: 'Budget Planning Analyst assignment not found. Please contact an administrator to set up your region assignment.'
        };
        return next();
      }

      // Apply region filtering for read operations
      if (operation === 'read') {
        if (assignment.isNIAWide) {
          // NIA-Wide: No region restrictions - can access all proposals
          console.log(`✅ Budget Planning Analyst ${userId} has NIA-Wide access`);
          req.analystAccessControl = {
            isNIAWide: true,
            assignedRegions: [],
            restrictionType: 'NONE'
          };
          return next();
        } else if (assignment.assignedRegions && assignment.assignedRegions.length > 0) {
          // Specific regions: Filter by assigned regions
          const assignedRegionIds = assignment.assignedRegions.map(r => r._id || r);
          const assignedRegionNames = assignment.assignedRegions.map(r => r.Region || r.regionName);
          
          console.log(`✅ Budget Planning Analyst ${userId} restricted to regions:`, assignedRegionNames);
          
          // Add filter for region-based queries
          req.regionFilters = {
            $or: [
              { region: { $in: assignedRegionNames } },
              { submitterRegion: { $in: assignedRegionNames } },
              { 'createdBy.region': { $in: assignedRegionNames } }
            ]
          };

          req.analystAccessControl = {
            isNIAWide: false,
            assignedRegions: assignedRegionIds,
            assignedRegionNames: assignedRegionNames,
            restrictionType: 'SPECIFIC_REGIONS'
          };
          return next();
        } else {
          // No region assignment and not NIA-Wide - allow access but flag that regions need to be assigned
          console.warn(`⚠️ Budget Planning Analyst ${userId} has no region assignments - all proposals hidden`);
          req.analystAccessControl = {
            isNIAWide: false,
            assignedRegions: [],
            restrictionType: 'NO_REGIONS',
            needsRegions: true,
            message: 'You have no region assignments. Please contact an administrator to assign your regions.'
          };
          // Still return next() to allow access to dashboard/UI
          return next();
        }
      }

      // For other operations, allow to pass through to controller
      req.analystAccessControl = {
        isNIAWide: assignment.isNIAWide,
        assignedRegions: assignment.assignedRegions,
        restrictionType: assignment.isNIAWide ? 'NONE' : 'SPECIFIC_REGIONS'
      };
      
      return next();

    } catch (error) {
      console.error('❌ Error in Budget Planning Analyst access control:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking Budget Planning Analyst access',
        error: error.message
      });
    }
  };
};

/**
 * Helper function to check if a proposal should be routed to a specific analyst
 * Based on submitter's region and analyst's assigned regions
 * 
 * @param {string} submitterRegion - Region of the proposal submitter
 * @param {Object} analystAssignment - Budget Planning Analyst's assignment record
 * @returns {boolean} - True if proposal should be routed to this analyst
 */
const shouldRouteToAnalyst = (submitterRegion, analystAssignment) => {
  if (!submitterRegion || !analystAssignment) {
    return false;
  }

  // If analyst has NIA-Wide access, route all proposals
  if (analystAssignment.isNIAWide) {
    console.log(`✅ Proposal from ${submitterRegion} routed to NIA-Wide analyst ${analystAssignment.userId}`);
    return true;
  }

  // If analyst has specific regions, check if submitter's region is in the list
  if (analystAssignment.assignedRegions && analystAssignment.assignedRegions.length > 0) {
    const regionNames = analystAssignment.assignedRegions.map(r => 
      typeof r === 'string' ? r : (r.Region || r.regionName)
    );
    
    const shouldRoute = regionNames.includes(submitterRegion);
    if (shouldRoute) {
      console.log(`✅ Proposal from ${submitterRegion} routed to analyst ${analystAssignment.userId} (assigned to region)`);
    } else {
      console.log(`❌ Proposal from ${submitterRegion} NOT routed to analyst ${analystAssignment.userId} (different region)`);
    }
    return shouldRoute;
  }

  console.log(`❌ Analyst ${analystAssignment.userId} has no region assignments`);
  return false;
};

/**
 * Helper function to find appropriate Budget Planning Analysts for a proposal
 * 
 * @param {string} submitterRegion - Region of the proposal submitter
 * @returns {Promise<Array>} - Array of analyst assignments that should receive this proposal
 */
const findAppropriateAnalysts = async (submitterRegion) => {
  try {
    if (!submitterRegion) {
      console.warn('⚠️ No submitter region provided');
      return [];
    }

    // Get all active Budget Planning Analyst assignments
    const analysts = await HierarchicalUserAssignment.find({
      isActive: true,
      userRole: 'BUDGET_PLANNING_ANALYST'
    }).populate('assignedRegions', 'Region regionName RegionName _id');

    // Filter analysts that should receive this proposal
    const appropriateAnalysts = analysts.filter(analyst => 
      shouldRouteToAnalyst(submitterRegion, analyst)
    );

    console.log(`Found ${appropriateAnalysts.length} analyst(s) for region ${submitterRegion}`);
    return appropriateAnalysts;
  } catch (error) {
    console.error('❌ Error finding appropriate analysts:', error);
    return [];
  }
};

module.exports = {
  budgetPlanningAnalystAccessControl,
  shouldRouteToAnalyst,
  findAppropriateAnalysts
};
