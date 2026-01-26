const checkToken = require('./checkToken');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const checkDueDate = require('./checkDueDate');
const checkRegionAccess = require('./checkRegionAccess');
const { checkUserRegionAccess } = require('./checkRegionAccess');
// Permission levels constants (6-step workflow hierarchy)
const PERMISSION_LEVELS = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  BUDGET_ADMIN: 'BUDGET_ADMIN',
  BUDGET_PREPARER: 'BUDGET_PREPARER',                                // STEP 1: Proposal creation
  BUDGET_REVIEWER: 'BUDGET_REVIEWER',                                // STEP 2: Division review
  BUDGET_APPROVER: 'BUDGET_APPROVER',                                // STEP 3: Division/Office approval
  BUDGET_ANALYST: 'BUDGET_ANALYST',                                  // STEP 4: Technical review
  BUDGET_PLANNING_ANALYST: 'BUDGET_PLANNING_ANALYST',                // STEP 4: Technical review (variant)
  BUDGET_OFFICER: 'BUDGET_OFFICER',                                  // STEP 5: Operational approval
  BUDGET_MANAGER: 'BUDGET_MANAGER',                                  // Legacy: replaced by OVERALL_BUDGET_APPROVER
  OVERALL_BUDGET_APPROVER: 'OVERALL_BUDGET_APPROVER'                 // STEP 6: Executive approval
};
// Access scope constants
const ACCESS_SCOPE = {
  FULL: 'FULL',           // Full system access
  REGION: 'REGION',       // Region-based access
  DEPARTMENT: 'DEPARTMENT', // Department-based access
  DIVISION: 'DIVISION',   // Division-based access
  // OWN_ONLY: 'OWN_ONLY'   // Own records only
};
// Role checking helper function
const hasRequiredRole = (userRoles, requiredRoles) => {
  if (!userRoles) return false;
  // Handle both array and string roles
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.some(role => required.includes(role));
};
// Check if user has full system access
// Note: Full access does NOT imply "FULL" hierarchical scope in UI; it only bypasses certain checks
const DEBUG = process.env.DEBUG_LOGS === 'true';

const hasFullAccess = (userRoles) => {
  const requiredRoles = [
    PERMISSION_LEVELS.SUPER_ADMIN,
    'SUPER ADMIN',  // Support both 'SUPER_ADMIN' and 'SUPER ADMIN' (with space) from database
    PERMISSION_LEVELS.ADMIN,
    'ADMIN',        // Support both variants
    PERMISSION_LEVELS.BUDGET_ADMIN,
    PERMISSION_LEVELS.BUDGET_PREPARER,         // STEP 1: Proposal creation
    PERMISSION_LEVELS.BUDGET_REVIEWER,         // STEP 2: Division review
    'BUDGET REVIEWER',                          // Support display format
    PERMISSION_LEVELS.BUDGET_APPROVER,         // STEP 3: Division/Office approval
    'BUDGET APPROVER',                          // Support display format
    PERMISSION_LEVELS.BUDGET_ANALYST,          // STEP 4: Technical review
    PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST, // STEP 4: Technical review (variant)
    'BUDGET PLANNING ANALYST',                 // Support display format from database
    PERMISSION_LEVELS.BUDGET_OFFICER,          // STEP 5: Operational approval
    'BUDGET OFFICER',                           // Support display format
    PERMISSION_LEVELS.BUDGET_MANAGER,          // STEP 6: Budget Manager (legacy)
    'BUDGET MANAGER',                           // Support display format
    PERMISSION_LEVELS.OVERALL_BUDGET_APPROVER  // STEP 6: Executive approval
  ];
  const result = hasRequiredRole(userRoles, requiredRoles);
  
  // 🔍 DEBUG for workflow roles
  if (DEBUG && Array.isArray(userRoles) && (userRoles.includes('BUDGET_OFFICER') || userRoles.includes('BUDGET REVIEWER') || userRoles.includes('APPROVER') || userRoles.includes('OVERALL_BUDGET_APPROVER') || userRoles.includes('BUDGET PLANNING ANALYST') || userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET MANAGER'))) {
    console.debug('🔍 hasFullAccess check for 6-step workflow role:', {
      userRoles,
      result,
      hasRequiredRoleDebug: userRoles.some(role => requiredRoles.includes(role))
    });
  }
  
  return result;
};
// Check organizational unit access with Budget Manager flexibility
const checkOrganizationalAccess = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    const userId = req.user.id;
    const userRoles = req.user.Roles;
    
    // SUPER ADMIN has unrestricted access to all organizational units
    if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
      const { region, department, division } = req.body;
      const queryRegion = req.query.region;
      const queryDepartment = req.query.department;
      const queryDivision = req.query.division;
      req.selectedOrgContext = {
        region: region || queryRegion,
        department: department || queryDepartment,
        division: division || queryDivision,
        selectedBy: userId,
        userRole: userRoles,
        isSuperAdmin: true
      };
      return next();
    }
    
    // Full access roles (BUDGET_MANAGER, BUDGET_ADMIN) can choose any organizational unit
    if (hasFullAccess(userRoles)) {
      // For Budget Managers, allow them to specify which org unit to transact with
      const { region, department, division } = req.body;
      const queryRegion = req.query.region;
      const queryDepartment = req.query.department;
      const queryDivision = req.query.division;
      // Add selected organizational context to request for logging/tracking
      req.selectedOrgContext = {
        region: region || queryRegion,
        department: department || queryDepartment,
        division: division || queryDivision,
        selectedBy: userId,
        userRole: userRoles
      };
      return next();
    }
    // For non-admin users, check their assigned organizational units
    const { region, department, division } = req.body;
    const queryRegion = req.query.region;
    const queryDepartment = req.query.department;
    const queryDivision = req.query.division;
    // Check region access if region is specified
    const targetRegion = region || queryRegion;
    if (targetRegion) {
      const hasRegionAccess = await checkUserRegionAccess(userId, targetRegion);
      if (!hasRegionAccess) {
        return res.status(403).json({
          message: "You don't have permission to access this region"
        });
      }
    }
    // TODO: Add department and division access checks when models are ready
    next();
  } catch (error) {
    console.error('Error in organizational access check:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Basic authentication middleware
const authenticatedRoute = () => {
  return [tokenMiddleware];
};
// Admin-only access middleware
const adminRoute = () => {
  return [
    tokenMiddleware,
    (req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const adminRoles = [
        PERMISSION_LEVELS.SUPER_ADMIN,
        PERMISSION_LEVELS.BUDGET_ADMIN,
        PERMISSION_LEVELS.BUDGET_ANALYST,
        PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST, // ✅ NEW: Support BUDGET PLANNING ANALYST role
        'BUDGET PLANNING ANALYST',                 // Support display format
        PERMISSION_LEVELS.BUDGET_MANAGER,
        PERMISSION_LEVELS.OVERALL_BUDGET_APPROVER, // Accept either alias for budget manager
        'OVERALL_BUDGET_APPROVER',
        'BUDGET_PREPARER',                         // ✅ Support budget preparers accessing hierarchical assignments
        'BUDGET PREPARER',
        'BUDGET_REVIEWER',                         // ✅ Support budget reviewers
        'BUDGET REVIEWER',
        'BUDGET_APPROVER',                         // ✅ Support budget approvers
        'BUDGET APPROVER'
      ];
      if (!hasRequiredRole(req.user?.Roles, adminRoles)) {
        return res.status(403).json({
          message: "Access denied. Admin privileges required."
        });
      }
      next();
    }
  ];
};
// Enhanced due date protected route with permission level and organizational access
const dueDateProtectedRoute = (permissionLevel = PERMISSION_LEVELS.USER, accessScope = ACCESS_SCOPE.REGION) => {
  const middleware = [tokenMiddleware, checkDueDate];
  // Add role checking if permission level is specified
  if (permissionLevel !== PERMISSION_LEVELS.USER) {
    middleware.push((req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const userRoles = req.user?.Roles || [];
      
      // SUPER ADMIN bypasses all role restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }
      
      let requiredRoles = [];
      switch (permissionLevel) {
        case PERMISSION_LEVELS.ADMIN:
          requiredRoles = [
            PERMISSION_LEVELS.BUDGET_ADMIN,
            PERMISSION_LEVELS.BUDGET_ANALYST,
            PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST, // ✅ NEW: Support BUDGET PLANNING ANALYST
            PERMISSION_LEVELS.BUDGET_MANAGER
          ];
          break;
        case PERMISSION_LEVELS.BUDGET_MANAGER:
          requiredRoles = [
            PERMISSION_LEVELS.BUDGET_MANAGER,
            PERMISSION_LEVELS.BUDGET_ADMIN,
            PERMISSION_LEVELS.BUDGET_ANALYST,
            PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST  // ✅ NEW: Support BUDGET PLANNING ANALYST
          ];
          break;
        case PERMISSION_LEVELS.BUDGET_OFFICER:
          // Budget Officer no longer allowed by requirement, block by requiring none match
          requiredRoles = [
            "__NO_ROLE__"
          ];
          break;
        case PERMISSION_LEVELS.SUPER_ADMIN:
          // Super Admin has full access (handled above)
          requiredRoles = [PERMISSION_LEVELS.SUPER_ADMIN];
          break;
        default:
          requiredRoles = [permissionLevel];
      }
      if (!hasRequiredRole(req.user?.Roles, requiredRoles)) {
        return res.status(403).json({
          message: `Access denied. ${permissionLevel} privileges required.`
        });
      }
      next();
    });
  }
  // Add organizational access control based on scope
  // Always apply organizational access checks; full roles no longer bypass hierarchy
  middleware.push(checkOrganizationalAccess);
  return middleware;
};
// Owner-only access (for viewing own proposals)
const ownerOnlyRoute = () => {
  return [
    tokenMiddleware,
    (req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      
      // SUPER ADMIN can view all records without restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }
      
      // Full access roles can view all records
      if (hasFullAccess(userRoles)) {
        return next();
      }
      // For regular users, add filter to only show their own records
      req.ownerFilter = { processBy: userId };
      next();
    }
  ];
};
// Workflow staff access (for PREPARER, BUDGET REVIEWER, APPROVER to view proposals)
const workflowStaffRoute = (allowedOperations = ['read']) => {
  return [
    tokenMiddleware,
    (req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const userRoles = req.user.Roles;
      
      // SUPER ADMIN bypasses all restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }
      
      // Check if user has workflow or budget staff privileges
      const allowedRoles = [
        // Budget staff roles
        PERMISSION_LEVELS.BUDGET_ADMIN,
        PERMISSION_LEVELS.BUDGET_ANALYST,
        PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST, // ✅ NEW: Support BUDGET PLANNING ANALYST
        PERMISSION_LEVELS.BUDGET_MANAGER,
        PERMISSION_LEVELS.BUDGET_OFFICER,
        // Workflow staff roles - can now view proposals
        PERMISSION_LEVELS.BUDGET_PREPARER,
        PERMISSION_LEVELS.BUDGET_REVIEWER,
        PERMISSION_LEVELS.BUDGET_APPROVER,
        PERMISSION_LEVELS.OVERALL_BUDGET_APPROVER
      ];
      if (!hasRequiredRole(userRoles, allowedRoles)) {
        return res.status(403).json({
          message: "Access denied. Budget or workflow staff privileges required."
        });
      }
      next();
    },
    checkOrganizationalAccess
  ];
};
// Budget Officer restricted access
const budgetOfficerRoute = (allowedOperations = ['read']) => {
  return [
    tokenMiddleware,
    (req, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const userRoles = req.user.Roles;
      
      // SUPER ADMIN bypasses all restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }
      
      // Check if user has allowed privileges (includes BUDGET_OFFICER, ANALYST, MANAGER, ADMIN)
      const allowedRoles = [
        PERMISSION_LEVELS.BUDGET_ADMIN,
        PERMISSION_LEVELS.BUDGET_ANALYST,
        PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST, // ✅ NEW: Support BUDGET PLANNING ANALYST
        PERMISSION_LEVELS.BUDGET_MANAGER,
        PERMISSION_LEVELS.BUDGET_OFFICER
      ];
      if (!hasRequiredRole(userRoles, allowedRoles)) {
        return res.status(403).json({
          message: "Access denied. Budget Officer privileges required."
        });
      }
      // Check operation permissions for budget officers
      if (hasRequiredRole(userRoles, [PERMISSION_LEVELS.BUDGET_OFFICER]) &&
          !hasRequiredRole(userRoles, [PERMISSION_LEVELS.BUDGET_MANAGER, PERMISSION_LEVELS.SUPER_ADMIN])) {
        const method = req.method.toLowerCase();
        const operationMap = {
          'get': 'read',
          'post': 'create',
          'put': 'update',
          'patch': 'update',
          'delete': 'delete'
        };
        const currentOperation = operationMap[method];
        if (!allowedOperations.includes(currentOperation)) {
          return res.status(403).json({
            message: `Budget Officers are not allowed to ${currentOperation} this resource.`
          });
        }
      }
      next();
    },
    checkOrganizationalAccess
  ];
};
// Region access protected route
const regionProtectedRoute = () => {
  return [tokenMiddleware, checkRegionAccess];
};
module.exports = {
  authenticatedRoute,
  adminRoute,
  dueDateProtectedRoute,
  regionProtectedRoute,
  ownerOnlyRoute,
  budgetOfficerRoute,
  workflowStaffRoute,
  checkOrganizationalAccess,
  PERMISSION_LEVELS,
  ACCESS_SCOPE,
  hasRequiredRole,
  hasFullAccess
};
