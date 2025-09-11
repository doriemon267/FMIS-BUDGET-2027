/**
 * 🔒 Region-Based Access Control (RBAC) Middleware
 * 
 * This middleware enforces strict region-based access control where users can only
 * transact (create, read, update, delete) in regions they are explicitly assigned to.
 * 
 * Features:
 * - Enforces user-region assignments from UserOrganizationalAssignment model
 * - Blocks transactions outside assigned regions
 * - Applies automatic filters for read operations
 * - Provides bypass for SUPER_ADMIN and BUDGET_MANAGER roles
 * - Logs access attempts for security audit
 */
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const { hasFullAccess } = require('./securityMiddleware');
/**
 * Main RBAC middleware factory
 * @param {string} operation - The operation type: 'create', 'read', 'update', 'delete'
 * @param {object} options - Additional options
 * @param {boolean} options.strictMode - If true, denies access when no region assignments exist
 * @param {boolean} options.logAccess - If true, logs all access attempts
 * @returns {Function} Express middleware function
 */
const regionBasedAccessControl = (operation = 'read', options = {}) => {
  const { strictMode = true, logAccess = true } = options;
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      const userName = req.user.username || req.user.name || userId;
      // Log access attempt if enabled
      if (logAccess) {
        attempting ${operation} operation`);
      }
      // BYPASS: Full access roles (SUPER_ADMIN, BUDGET_MANAGER) have unrestricted access
      if (hasFullAccess(userRoles)) {
        if (logAccess) {
          `);
        }
        return next();
      }
      // Get user's organizational assignments
      const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
      // Extract region from request (body, query, or params)
      const targetRegion = extractRegionFromRequest(req);
      // Handle different operations
      switch (operation) {
        case 'read':
          return handleReadOperation(req, res, next, assignment, targetRegion, { logAccess, userName });
        case 'create':
        case 'update':
        case 'delete':
          return handleWriteOperation(req, res, next, assignment, targetRegion, operation, { strictMode, logAccess, userName });
        default:
          return res.status(400).json({ 
            message: 'Invalid operation type for RBAC middleware',
            code: 'RBAC_INVALID_OPERATION'
          });
      }
    } catch (error) {
      console.error('🚨 RBAC Middleware Error:', error);
      return res.status(500).json({ 
        message: 'Internal server error in access control',
        code: 'RBAC_INTERNAL_ERROR'
      });
    }
  };
};
/**
 * Extract region information from various parts of the request
 * @param {object} req - Express request object
 * @returns {string|null} The target region or null if not found
 */
const extractRegionFromRequest = (req) => {
  // Check in multiple locations: body, query, params
  return req.body.region || 
         req.query.region || 
         req.params.region || 
         req.body.targetRegion || 
         req.query.targetRegion ||
         null;
};
/**
 * Handle read operations with region filtering
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 * @param {object} assignment - User's organizational assignment
 * @param {string} targetRegion - Target region for the operation
 * @param {object} options - Options object
 */
const handleReadOperation = async (req, res, next, assignment, targetRegion, options) => {
  const { logAccess, userName } = options;
  // If no specific region requested, apply general filters
  if (!targetRegion) {
    const regionFilters = buildRegionFilters(assignment);
    req.regionFilters = regionFilters;
    req.accessibleRegions = assignment.regions || [];
    if (logAccess) {
      }
    return next();
  }
  // If specific region requested, check access
  const hasAccess = await checkRegionAccess(assignment, targetRegion);
  if (!hasAccess) {
    if (logAccess) {
      }
    return res.status(403).json({
      message: `Access denied. You don't have permission to view data from region: ${targetRegion}`,
      code: 'RBAC_REGION_ACCESS_DENIED',
      allowedRegions: assignment.regions?.map(r => r.Region || r) || []
    });
  }
  if (logAccess) {
    }
  next();
};
/**
 * Handle write operations (create, update, delete) with strict region checking
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 * @param {object} assignment - User's organizational assignment
 * @param {string} targetRegion - Target region for the operation
 * @param {string} operation - The specific operation type
 * @param {object} options - Options object
 */
const handleWriteOperation = async (req, res, next, assignment, targetRegion, operation, options) => {
  const { strictMode, logAccess, userName } = options;
  // Require region for write operations
  if (!targetRegion) {
    if (logAccess) {
      }
    return res.status(400).json({
      message: `Region is required for ${operation} operations`,
      code: 'RBAC_REGION_REQUIRED',
      allowedRegions: assignment.regions?.map(r => r.Region || r) || []
    });
  }
  // Check if user has access to the target region
  const hasAccess = await checkRegionAccess(assignment, targetRegion);
  if (!hasAccess) {
    if (logAccess) {
      }
    return res.status(403).json({
      message: `Access denied. You cannot ${operation} data in region: ${targetRegion}`,
      code: 'RBAC_REGION_WRITE_DENIED',
      operation,
      targetRegion,
      allowedRegions: assignment.regions?.map(r => r.Region || r) || []
    });
  }
  // Check role permissions for the specific operation
  const canPerformOperation = checkOperationPermission(assignment, operation);
  if (!canPerformOperation) {
    if (logAccess) {
      }
    return res.status(403).json({
      message: `Access denied. You don't have permission to perform ${operation} operations`,
      code: 'RBAC_OPERATION_DENIED',
      operation,
      requiredPermissions: getRequiredPermissionsForOperation(operation)
    });
  }
  if (logAccess) {
    }
  // Add region validation to request for downstream use
  req.validatedRegion = targetRegion;
  req.userRegionAccess = {
    hasAccess: true,
    region: targetRegion,
    operation,
    userId: req.user.id
  };
  next();
};
/**
 * Check if user has access to a specific region
 * @param {object} assignment - User's organizational assignment
 * @param {string} targetRegion - Target region to check
 * @returns {Promise<boolean>} True if user has access, false otherwise
 */
const checkRegionAccess = async (assignment, targetRegion) => {
  // If user has full access scope, allow all regions
  if (assignment.accessScope === 'FULL') {
    return true;
  }
  // If user has no region assignments and access scope is not FULL, deny access
  if (!assignment.regions || assignment.regions.length === 0) {
    return false;
  }
  // Check if target region is in user's assigned regions
  return assignment.regions.some(region => {
    if (typeof region === 'string') {
      return region === targetRegion;
    }
    return region.Region === targetRegion || region._id?.toString() === targetRegion;
  });
};
/**
 * Build MongoDB query filters for region-based access
 * @param {object} assignment - User's organizational assignment
 * @returns {object} MongoDB filter object
 */
const buildRegionFilters = (assignment) => {
  // Full access - no filters
  if (assignment.accessScope === 'FULL') {
    return {};
  }
  // No region assignments - return filter that matches nothing
  if (!assignment.regions || assignment.regions.length === 0) {
    return { region: { $in: [] } }; // Empty array means no results
  }
  // Build region filter
  const regionNames = assignment.regions.map(region => {
    if (typeof region === 'string') {
      return region;
    }
    return region.Region || region._id?.toString();
  }).filter(Boolean);
  return {
    region: { $in: regionNames }
  };
};
/**
 * Check if user has permission to perform a specific operation
 * @param {object} assignment - User's organizational assignment
 * @param {string} operation - The operation to check
 * @returns {boolean} True if user can perform operation, false otherwise
 */
const checkOperationPermission = (assignment, operation) => {
  const permissions = assignment.rolePermissions || {};
  switch (operation) {
    case 'create':
      return permissions.canCreateProposals !== false; // Default true
    case 'update':
      return permissions.canEditOwnProposals !== false || permissions.canEditAllProposals === true;
    case 'delete':
      return permissions.canDeleteProposals === true; // Default false
    default:
      return true;
  }
};
/**
 * Get required permissions for an operation (for error messages)
 * @param {string} operation - The operation
 * @returns {array} Array of required permission names
 */
const getRequiredPermissionsForOperation = (operation) => {
  switch (operation) {
    case 'create':
      return ['canCreateProposals'];
    case 'update':
      return ['canEditOwnProposals', 'canEditAllProposals'];
    case 'delete':
      return ['canDeleteProposals'];
    default:
      return [];
  }
};
/**
 * Middleware to enforce strict region-based transaction control
 * This is a convenience wrapper for the most common use case
 */
const strictRegionControl = (operation) => {
  return regionBasedAccessControl(operation, { strictMode: true, logAccess: true });
};
/**
 * Middleware to get user's accessible regions (for frontend use)
 */
const getUserAccessibleRegions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.Roles;
    // Full access roles can access all regions
    if (hasFullAccess(userRoles)) {
      req.accessibleRegions = 'ALL';
      return next();
    }
    // Get user's specific region assignments
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    const accessibleRegions = assignment.regions?.map(region => {
      if (typeof region === 'string') {
        return region;
      }
      return {
        id: region._id,
        name: region.Region,
        code: region.RegionCode || region.Region
      };
    }) || [];
    req.accessibleRegions = accessibleRegions;
    req.accessScope = assignment.accessScope;
    next();
  } catch (error) {
    console.error('Error getting accessible regions:', error);
    req.accessibleRegions = [];
    req.accessScope = 'OWN_ONLY';
    next();
  }
};
module.exports = {
  regionBasedAccessControl,
  strictRegionControl,
  getUserAccessibleRegions,
  extractRegionFromRequest,
  checkRegionAccess,
  buildRegionFilters,
  checkOperationPermission
};