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
  if (req.method === 'OPTIONS') return next();
  try {
    // Skip if user is not authenticated
    if (!req.user || !req.user.id) {
      return next();
    }
    // If user has SUPER ADMIN role, grant full hierarchical access unconditionally
    const roles = req.user.Roles || req.user.roles || [];
    if (Array.isArray(roles) && roles.includes('SUPER_ADMIN')) {
      // Synthetic assignment giving full access without DB entry
      const synthetic = {
        userId: req.user.id,
        assignmentLevel: 'FULL',
        regions: [],
        departments: [],
        divisions: [],
        rolePermissions: {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: true,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: true,
          ManageSettings: true
        },
        getConsolidationTarget: () => ({})
      };
      req.userHierarchicalAssignment = synthetic;
      req.hierarchicalFlags = {
        isFullAccess: true,
        isRegionLevel: false,
        isDepartmentLevel: false,
        isDivisionLevel: false,
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: true,
        canDeleteProposals: true,
        canApproveProposals: true,
        canViewReports: true,
        canManageUsers: true,
        canManageSettings: true
      };
      return next();
    }
    const userId = req.user.id;
    // Get the user's hierarchical assignment
    const assignment = await HierarchicalUserAssignment.getUserPermissions(userId, req.user.Roles);
    // Add to request object
    req.userHierarchicalAssignment = assignment;
    // Also add convenience flags
    req.hierarchicalFlags = {
      isFullAccess: assignment.assignmentLevel === 'FULL',
      isRegionLevel: assignment.assignmentLevel === 'REGION',
      isDepartmentLevel: assignment.assignmentLevel === 'DEPARTMENT',
      isDivisionLevel: assignment.assignmentLevel === 'DIVISION',
      canCreateProposals: assignment.rolePermissions.CreateProposals,
      canEditOwnProposals: assignment.rolePermissions.EditOwnProposals,
      canEditAllProposals: assignment.rolePermissions.EditAllProposals,
      canDeleteProposals: assignment.rolePermissions.DeleteProposals,
      canApproveProposals: assignment.rolePermissions.ApproveProposals,
      canViewReports: assignment.rolePermissions.ViewReports,
      canManageUsers: assignment.rolePermissions.ManageUsers,
      canManageSettings: assignment.rolePermissions.ManageSettings
    };
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
    if (req.method === 'OPTIONS') return next();
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
  if (req.method === 'OPTIONS') return next();
  const assignment = req.userHierarchicalAssignment;
  const roles = req.user?.Roles || req.user?.roles || [];
  const normRole = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_').trim();
  const isBudgetManager = roles.some((r) => {
    const n = normRole(r);
    return n === 'BUDGET_MANAGER' || n === 'OVERALL_BUDGET_APPROVER';
  });

  if (!assignment || assignment.assignmentLevel === 'NONE') {
    // Budget Manager / Overall Budget Approver without HUA record: see all data (dashboard stats, etc.)
    if (isBudgetManager) {
      req.hierarchicalFilters = {};
      return next();
    }
    req.hierarchicalFilters = { userId: req.user?.id };
    return next();
  }
  let filters = {};
  switch (assignment.assignmentLevel) {
    case 'BUDGET_AND_REVENUE_DIVISION':
    case 'FULL':
      filters = {};
      break;
    case 'WORKFLOW':
      // Workflow users with no HUA doc: Budget Manager sees all; others need scope for employee list
      if (isBudgetManager) {
        filters = {};
      } else {
        const hasScope = (assignment.regions?.length > 0) || (assignment.departments?.length > 0) || (assignment.divisions?.length > 0);
        if (!hasScope) {
          // Budget Preparer / workflow user without Department/Division assignment must not see other depts' data
          filters = { __noScope: true };
        } else {
          filters = { userId: req.user?.id };
        }
      }
      break;
    case 'DIVISION':
    case 'DIVISION_LEVEL':
    case 'RESPONSIBILITY_CENTER':
      // Can only see data from their specific division
      if (assignment.regions?.length > 0 && assignment.departments?.length > 0 && assignment.divisions?.length > 0) {
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        const departmentName = assignment.departments[0].Department || assignment.departments[0].departmentName || assignment.departments[0].DepartmentName;
        const divisionName = typeof assignment.divisions[0] === 'string' ? assignment.divisions[0].trim() : (assignment.divisions[0]?.divisionName || '').trim();
        filters = {
          region: regionName,
          $or: [
            { division: divisionName },
            { department: divisionName }
          ]
        };
      }
      break;
    case 'DEPARTMENT':
    case 'DEPARTMENT_REGIONAL_LEVEL':
    case 'OFFICE':
      // Can see all data from their department (all divisions within)
      if (assignment.regions?.length > 0 && assignment.departments?.length > 0) {
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        const departmentName = assignment.departments[0].Department || assignment.departments[0].departmentName || assignment.departments[0].DepartmentName;
        filters = {
          region: regionName,
          department: departmentName
        };
      }
      break;
    case 'REGION':
      // Can see all data from their region (all departments and divisions within)
      if (assignment.regions.length > 0 && (assignment.regions[0].regionName || assignment.regions[0].Region)) {
        const regionName = assignment.regions[0].Region || assignment.regions[0].regionName;
        filters = {
          region: regionName
        };
      }
      break;
    default:
      // Default to own data only
      filters = { userId: req.user?.id };
  }
  req.hierarchicalFilters = filters;
  next();
};
module.exports = {
  loadHierarchicalAssignment,
  hasPermission,
  requirePermission,
  applyHierarchicalFilters
};
