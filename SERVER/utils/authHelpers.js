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
};

// Role checking helper function
const hasRequiredRole = (userRoles, requiredRoles) => {
  if (!userRoles) return false;
  // Handle both array and string roles
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.some(role => required.includes(role));
};

const hasFullAccess = (userRoles) => {
  const requiredRoles = [
    PERMISSION_LEVELS.SUPER_ADMIN,
    'SUPER ADMIN',
    PERMISSION_LEVELS.ADMIN,
    'ADMIN',
    PERMISSION_LEVELS.BUDGET_ADMIN,
    PERMISSION_LEVELS.BUDGET_PREPARER,
    PERMISSION_LEVELS.BUDGET_REVIEWER,
    'BUDGET REVIEWER',
    PERMISSION_LEVELS.BUDGET_APPROVER,
    'BUDGET APPROVER',
    PERMISSION_LEVELS.BUDGET_ANALYST,
    PERMISSION_LEVELS.BUDGET_PLANNING_ANALYST,
    'BUDGET PLANNING ANALYST',
    PERMISSION_LEVELS.BUDGET_OFFICER,
    'BUDGET OFFICER',
    PERMISSION_LEVELS.BUDGET_MANAGER,
    'BUDGET MANAGER',
    PERMISSION_LEVELS.OVERALL_BUDGET_APPROVER
  ];
  return hasRequiredRole(userRoles, requiredRoles);
};

module.exports = {
  PERMISSION_LEVELS,
  ACCESS_SCOPE,
  hasRequiredRole,
  hasFullAccess
};
