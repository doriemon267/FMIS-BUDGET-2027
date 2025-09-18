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
  CREATE: 'CreateProposals',
  EDIT_OWN: 'EditOwnProposals',
  EDIT_ALL: 'EditAllProposals',
  DELETE: 'DeleteProposals',
  APPROVE: 'ApproveProposals',
  VIEW_REPORTS: 'ViewReports',
  MANAGE_USERS: 'ManageUsers',
  MANAGE_SETTINGS: 'ManageSettings',
};
