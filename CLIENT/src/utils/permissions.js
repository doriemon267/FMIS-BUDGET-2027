export function hasPermission(currentUser, permissionKey) {
  if (!currentUser) return false;
  // Prefer hierarchicalFlags populated by middleware
  const flags = currentUser.hierarchicalFlags || {};
  if (typeof flags[permissionKey] === 'boolean') return flags[permissionKey];
  // Fallback to hierarchicalAccess.rolePermissions when available
  const rolePerms = currentUser.hierarchicalAccess?.rolePermissions || {};
  if (typeof rolePerms[permissionKey] === 'boolean') return rolePerms[permissionKey];
  return false;
}

export const PERMISSIONS = {
  CREATE: 'canCreateProposals',
  EDIT_OWN: 'canEditOwnProposals',
  EDIT_ALL: 'canEditAllProposals',
  DELETE: 'canDeleteProposals',
  APPROVE: 'canApproveProposals',
  VIEW_REPORTS: 'canViewReports',
  MANAGE_USERS: 'canManageUsers',
  MANAGE_SETTINGS: 'canManageSettings',
};
