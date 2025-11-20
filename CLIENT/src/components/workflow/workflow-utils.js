// Utility functions for workflow action visibility
export function normalizeRoleValue(roleValue) {
  if (!roleValue || typeof roleValue !== 'string') return '';
  const normalized = roleValue.trim().toUpperCase().replace(/\s+/g, '_');
  const camelCaseNormalized = normalized.replace(/[^A-Z0-9_]/g, '_');

  const roleSynonyms = {
    PREPARER: 'BUDGET PREPARER',
    ANALYST: 'BUDGET PREPARER',
    REVIEWER: 'BUDGET REVIEWER',
    APPROVER: 'BUDGET APPROVER',
    "BUDGET_PLANNING_ANALYST": 'BUDGET PLANNING ANALYST',
    OFFICER: 'BUDGET OFFICER',
    'OVERALL_BUDGET_APPROVER': 'BUDGET MANAGER',
    BUDGET_MANAGER: 'BUDGET MANAGER',
    FINAL_APPROVER: 'BUDGET MANAGER',
    BUDGETADMIN: 'SUPER ADMIN',
    BUDGET_ADMIN: 'SUPER ADMIN',
    FULL: 'BUDGET MANAGER'
  };

  return roleSynonyms[camelCaseNormalized] || camelCaseNormalized;
}

export function shouldShowManagerActions({ status, currentAssigneeRole, normalizedRoles = [] } = {}) {
  // Must be manager or super admin role
  const isOverallApprover = normalizedRoles.includes('OVERALL BUDGET APPROVER') || normalizedRoles.includes('BUDGET MANAGER');
  const isSuperAdmin = normalizedRoles.includes('SUPER ADMIN');
  if (!isOverallApprover && !isSuperAdmin) return false;

  const normalizedStatus = String(status || '').toUpperCase().trim();
  const isReturned = normalizedStatus.includes('RETURNED');

  // If returned to a specific role and it's not the manager, block manager actions
  if (isReturned && currentAssigneeRole) {
    const normalizedAssignee = normalizeRoleValue(currentAssigneeRole);
    if (normalizedAssignee !== 'BUDGET MANAGER') return false;
  }

  // By default, allow if status implies manager stage or officer approved
  if (
    normalizedStatus === 'FORWARDED TO MANAGER' ||
    normalizedStatus === 'FORWARDED TO BUDGET MANAGER' ||
    normalizedStatus === 'OFFICER APPROVED' ||
    normalizedStatus === 'OFFICER_APPROVED' ||
    normalizedStatus === 'OFFICER_APPROVED'
  ) {
    return true;
  }

  // If no specific return restriction, let the manager act when they have the role
  return true;
}

export default { normalizeRoleValue, shouldShowManagerActions };

// CommonJS export for server test compatibility
try {
  module.exports = module.exports || {};
  module.exports.normalizeRoleValue = normalizeRoleValue;
  module.exports.shouldShowManagerActions = shouldShowManagerActions;
} catch (e) {
  // Ignore in browser ES module contexts
}
