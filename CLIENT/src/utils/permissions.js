export function hasPermission(currentUser, permissionKey) {
  if (!currentUser) return false;

  const userRoles = currentUser.Roles || [];

  // Role-based access control for menu permissions
  if (permissionKey === 'ManageSettings') {
    // Only BUDGET ADMIN can access Settings
      // Only BUDGET ADMIN and SUPER ADMIN can access Settings
      return userRoles.includes('BUDGET ADMIN') || userRoles.includes('SUPER ADMIN');
  }

  // For other permissions, BUDGET ADMIN gets all access
  if (userRoles.includes('BUDGET ADMIN')) {
    return true;
  }

  // BUDGET ANALYST, BUDGET COORDINATOR, BUDGET MANAGER, BUDGET OFFICER get all menus except Settings
  const allowedRoles = ['BUDGET ANALYST', 'BUDGET COORDINATOR', 'BUDGET MANAGER', 'BUDGET OFFICER'];
  if (allowedRoles.some(role => userRoles.includes(role))) {
    return true;
  }

  // Fallback to hierarchical permissions for backward compatibility
  // Prefer hierarchicalFlags populated by middleware
  const flags = currentUser.hierarchicalFlags || {};
  if (typeof flags[permissionKey] === 'boolean') return flags[permissionKey];
  // Fallback to hierarchicalAccess.rolePermissions when available
  const rolePerms = currentUser.hierarchicalAccess?.rolePermissions || {};
  if (typeof rolePerms[permissionKey] === 'boolean') return rolePerms[permissionKey];
  // If permission is undefined, default to true (allow access) for consistency with ProtectedRoute
  return true;
}

export function getUserRestrictions(currentUser) {
  if (!currentUser) return {
    allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
    allowedFiscalYears: [],
    readOnlyMode: false
  };

  // Get restrictions from hierarchicalAccess
  const restrictions = currentUser.hierarchicalAccess?.restrictions;

  // If no restrictions configured, return defaults (full access)
  if (!restrictions) {
    return {
      allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
      allowedFiscalYears: [],
      readOnlyMode: false
    };
  }

  return {
    allowedBudgetTypes: restrictions.allowedBudgetTypes || ['Initial', 'NEP', 'GAA'],
    allowedFiscalYears: restrictions.allowedFiscalYears || [],
    readOnlyMode: restrictions.readOnlyMode || false
  };
}

/**
 * Check if user should be in read-only mode
 */
export function isUserReadOnly(currentUser) {
  const restrictions = getUserRestrictions(currentUser);
  return restrictions.readOnlyMode;
}

/**
 * Check if user can access specific budget type
 */
export function canAccessBudgetType(currentUser, budgetType) {
  if (!budgetType) return true; // If no budget type specified, allow access

  const restrictions = getUserRestrictions(currentUser);
  const allowedTypes = restrictions.allowedBudgetTypes;

  // If no restrictions configured, allow all
  if (!allowedTypes || allowedTypes.length === 0) return true;

  return allowedTypes.includes(budgetType);
}

/**
 * Check if user can access specific fiscal year
 */
export function canAccessFiscalYear(currentUser, fiscalYear) {
  if (!fiscalYear) return true; // If no fiscal year specified, allow access

  const restrictions = getUserRestrictions(currentUser);
  const allowedYears = restrictions.allowedFiscalYears;

  // If no restrictions configured, allow all
  if (!allowedYears || allowedYears.length === 0) return true;

  return allowedYears.includes(fiscalYear.toString());
}

/**
 * Get filtered options based on user restrictions
 */
export function getFilteredOptions(currentUser, options, type) {
  const restrictions = getUserRestrictions(currentUser);

  if (type === 'budgetType') {
    const allowedTypes = restrictions.allowedBudgetTypes;
    if (!allowedTypes || allowedTypes.length === 0) return options;
    return options.filter(option => allowedTypes.includes(option.value || option));
  }

  if (type === 'fiscalYear') {
    const allowedYears = restrictions.allowedFiscalYears;
    if (!allowedYears || allowedYears.length === 0) return options;
    return options.filter(option => allowedYears.includes(option.value?.toString() || option.toString()));
  }

  return options;
}

export function canCreateProposalWithAmount(currentUser, amount) {
  if (!currentUser) return false;

  const hasCreatePermission = hasPermission(currentUser, 'CreateProposals');

  if (!hasCreatePermission) return false;

  // No amount limits - proposals can be any amount
  return true;
}

export const PERMISSIONS = {
  CREATE: 'CreateProposals',
  EDIT_OWN: 'EditOwnProposals',
  EDIT_ALL: 'EditAllProposals',
  DELETE: 'DeleteProposals',
  APPROVE: 'ApproveProposals',
  VIEW_REPORTS: 'ViewReports',
  MANAGE_USERS: 'ManageUsers',
  MANAGE_SETTINGS: 'ManageSettings',
};
