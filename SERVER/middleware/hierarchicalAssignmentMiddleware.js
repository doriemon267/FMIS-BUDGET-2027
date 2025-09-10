/**
 * 🏢 Hierarchical Assignment Middleware
 * 
 * This middleware loads the user's hierarchical assignment and makes it available
 * in req.userHierarchicalAssignment for use in routes and other middleware.
 */

const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

/**
 * Load user's hierarchical assignment and add to request
 */
const loadHierarchicalAssignment = async (req, res, next) => {
  try {
    // Skip if user is not authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    const userId = req.user.id;
    
    // Get the user's hierarchical assignment
    const assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
    
    // Add to request object
    req.userHierarchicalAssignment = assignment;
    
    // Also add convenience flags
    req.hierarchicalFlags = {
      isFullAccess: assignment.assignmentLevel === 'FULL',
      isRegionLevel: assignment.assignmentLevel === 'REGION',
      isDepartmentLevel: assignment.assignmentLevel === 'DEPARTMENT',
      isDivisionLevel: assignment.assignmentLevel === 'DIVISION',
      canCreateProposals: assignment.rolePermissions.canCreateProposals,
      canEditOwnProposals: assignment.rolePermissions.canEditOwnProposals,
      canEditAllProposals: assignment.rolePermissions.canEditAllProposals,
      canDeleteProposals: assignment.rolePermissions.canDeleteProposals,
      canApproveProposals: assignment.rolePermissions.canApproveProposals,
      canViewReports: assignment.rolePermissions.canViewReports,
      canManageUsers: assignment.rolePermissions.canManageUsers,
      canManageSettings: assignment.rolePermissions.canManageSettings
    };

    console.log(`🏢 User ${userId} hierarchical assignment loaded: ${assignment.assignmentLevel}`);
    
    next();
  } catch (error) {
    console.error('Error loading hierarchical assignment:', error);
    
    // Don't fail the request, just continue without assignment
    req.userHierarchicalAssignment = {
      userId: req.user?.id || 'unknown',
      assignmentLevel: 'NONE',
      regions: [],
      departments: [],
      divisions: [],
      rolePermissions: {}
    };
    
    req.hierarchicalFlags = {
      isFullAccess: false,
      isRegionLevel: false,
      isDepartmentLevel: false,
      isDivisionLevel: false,
      canCreateProposals: false,
      canEditOwnProposals: true, // Default to allow editing own proposals
      canEditAllProposals: false,
      canDeleteProposals: false,
      canApproveProposals: false,
      canViewReports: false,
      canManageUsers: false,
      canManageSettings: false
    };
    
    next();
  }
};

/**
 * Helper function to check if user has specific permission
 */
const hasPermission = (req, permission) => {
  return req.hierarchicalFlags && req.hierarchicalFlags[permission];
};

/**
 * Middleware to require specific permission
 */
const requirePermission = (permission, errorMessage = null) => {
  return (req, res, next) => {
    if (!hasPermission(req, permission)) {
      return res.status(403).json({
        success: false,
        message: errorMessage || `Permission denied: ${permission} required`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
    }
    next();
  };
};

/**
 * Middleware to apply hierarchical data filters to database queries
 */
const applyHierarchicalFilters = (req, res, next) => {
  const assignment = req.userHierarchicalAssignment;
  
  if (!assignment || assignment.assignmentLevel === 'NONE') {
    // No assignment - restrict to own data only
    req.hierarchicalFilters = { userId: req.user?.id };
    return next();
  }

  let filters = {};

  switch (assignment.assignmentLevel) {
    case 'DIVISION':
      // Can only see data from their specific division
      if (assignment.regions.length > 0 && assignment.departments.length > 0 && assignment.divisions.length > 0) {
        // Normalize values from populated docs to match Employee collection
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        const departmentName = assignment.departments[0].Department || assignment.departments[0].departmentName || assignment.departments[0].DepartmentName;
        const divisionName = (assignment.divisions[0] || '').trim();
        filters = {
          Region: regionName,
          Department: departmentName,
          // Only include Division filter if non-empty
          ...(divisionName ? { Division: divisionName } : {})
        };
      }
      break;

    case 'DEPARTMENT':
      // Can see all data from their department (all divisions within)
      if (assignment.regions.length > 0 && assignment.departments.length > 0) {
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        const departmentName = assignment.departments[0].Department || assignment.departments[0].departmentName || assignment.departments[0].DepartmentName;
        filters = {
          Region: regionName,
          Department: departmentName
        };
      }
      break;

    case 'REGION':
      // Can see all data from their region (all departments and divisions within)
      if (assignment.regions.length > 0 && (assignment.regions[0].regionName || assignment.regions[0].Region)) {
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        filters = {
          Region: regionName
        };
      }
      break;

    case 'FULL':
      // Full access - no filters
      filters = {};
      break;

    default:
      // Default to own data only
      filters = { userId: req.user?.id };
  }

  req.hierarchicalFilters = filters;
  console.log(`🔍 Applied hierarchical filters for ${assignment.assignmentLevel}:`, filters);
  
  next();
};

module.exports = {
  loadHierarchicalAssignment,
  hasPermission,
  requirePermission,
  applyHierarchicalFilters
};
