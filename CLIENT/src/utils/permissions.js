export function hasPermission(currentUser, permissionKey) {
  if (!currentUser) return false;

  const userRoles = currentUser.Roles || [];

  // 🔥 SUPER ADMIN - Access ALL (including Settings)
  if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
    return true;
  }

  // 🔥 ManageUsers - RESTRICTED to SUPER ADMIN only
  if (permissionKey === 'ManageUsers') {
    return false; // Already checked SUPER ADMIN above
  }

  // ✅ Settings access: allow BRD-level roles + super admin
  if (permissionKey === 'ManageSettings') {
    const normalizedRoles = userRoles.map((role) => String(role || '').replace(/\s+/g, '_').toUpperCase());
    return normalizedRoles.some((role) => [
      'BUDGET_MANAGER',
      'BUDGET_OFFICER',
      'BUDGET_PLANNING_ANALYST',
    ].includes(role));
  }

  // 🔥 BUDGET_PLANNING_ANALYST, BUDGET MANAGER, BUDGET OFFICER
  // Access ALL menus EXCEPT Settings
  const budgetStaffRoles = ['BUDGET_PLANNING_ANALYST', 'BUDGET_MANAGER', 'BUDGET_OFFICER'];
  if (budgetStaffRoles.some(role => userRoles.includes(role))) {
    return true; // All permissions except ManageSettings (already filtered above)
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

export function normalizeWorkflowStatus(status) {
  const raw = String(status || '').trim().toUpperCase();
  const statusMap = {
    'DRAFT': 'DRAFT',
    'INITIAL': 'INITIAL',
    'RETURNED': 'RETURNED',
    'RETURNED TO PREPARER': 'RETURNED_TO_PREPARER',
    'RETURNED_TO_PREPARER': 'RETURNED_TO_PREPARER',
    'FORWARDED TO REVIEWER': 'FORWARDED_TO_REVIEWER',
    'FORWARDED TO APPROVER': 'FORWARDED_TO_APPROVER',
    'FORWARDED TO BUDGET PLANNING ANALYST': 'FORWARDED_TO_BRD_ANALYST',
    'FORWARDED TO BUDGET OFFICER': 'FORWARDED_TO_BRD_OFFICER',
    'FORWARDED TO OVERALL BUDGET APPROVER': 'FORWARDED_TO_BRD_MANAGER',
    'RETURNED TO REVIEWER': 'RETURNED_TO_REVIEWER',
    'RETURNED TO APPROVER': 'RETURNED_TO_APPROVER',
    'RETURNED TO BUDGET PLANNING ANALYST': 'RETURNED_TO_PLANNING_ANALYST',
    'RETURNED TO BUDGET OFFICER': 'RETURNED_TO_OFFICER',
    'FINALIZED': 'FINALIZED',
  };

  return statusMap[raw] || raw.replace(/\s+/g, '_');
}

export function isBudgetPreparerEditableStatus(status) {
  const normalizedStatus = normalizeWorkflowStatus(status);
  if (!normalizedStatus) return false;

  if (
    normalizedStatus === 'DRAFT' ||
    normalizedStatus === 'INITIAL' ||
    normalizedStatus === 'RETURNED' ||
    normalizedStatus === 'RETURNED_TO_PREPARER'
  ) {
    return true;
  }

  return normalizedStatus.includes('PREPARER');
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

const normalizeStringList = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      if (value && typeof value === 'object') {
        return value.value ?? value.label ?? value.fiscalYear ?? value.year ?? value.name ?? '';
      }
      return value;
    })
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
};

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
  const allowedTypes = normalizeStringList(restrictions.allowedBudgetTypes);

  // If no restrictions configured, allow all
  if (!allowedTypes || allowedTypes.length === 0) return true;

  return allowedTypes.includes(String(budgetType));
}

/**
 * Check if user can access specific fiscal year
 */
export function canAccessFiscalYear(currentUser, fiscalYear) {
  if (!fiscalYear) return true; // If no fiscal year specified, allow access

  const restrictions = getUserRestrictions(currentUser);
  const allowedYears = normalizeStringList(restrictions.allowedFiscalYears);

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
    const allowedTypes = normalizeStringList(restrictions.allowedBudgetTypes);
    if (!allowedTypes || allowedTypes.length === 0) return options;
    return options.filter(option => allowedTypes.includes(String(option.value ?? option)));
  }

  if (type === 'fiscalYear') {
    const allowedYears = normalizeStringList(restrictions.allowedFiscalYears);
    if (!allowedYears || allowedYears.length === 0) return options;
    return options.filter(option => allowedYears.includes(String(option.value ?? option)));
  }

  return options;
}

export function canCreateProposalWithAmount(currentUser, _amount) {
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
