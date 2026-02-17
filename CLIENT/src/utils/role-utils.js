export function prettyRole(role) {
  if (!role) return 'Unassigned';
  const r = String(role).toUpperCase().replace(/_/g, ' ').trim();
  // Capitalize each word
  return r.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ').replace(/Budget/i, 'Budget');
}

/** Normalize role string for comparison (uppercase, underscores as spaces) */
function normalizeRole(r) {
  if (r == null) return '';
  return String(r).toUpperCase().replace(/_/g, ' ').trim();
}

/**
 * Roles that belong to the Budget module only. Roles from other FMIS systems
 * (e.g. CASH CHECK PREPARER, ACCOUNTANT ADMIN) should not appear in the budget app sidebar.
 */
export function isBudgetRole(role) {
  const n = normalizeRole(role);
  if (!n) return false;
  if (n.includes('BUDGET')) return true;
  if (n.includes('BRD')) return true;
  if (n === 'SUPER ADMIN' || n.replace(/\s/g, '') === 'SUPERADMIN') return true;
  return false;
}

/**
 * Filter a list of roles to only those relevant to the Budget system.
 * Use this for sidebar/display so other FMIS roles (e.g. CASH CHECK PREPARER) are hidden.
 */
export function budgetRolesOnly(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.filter((r) => isBudgetRole(r));
}

export default prettyRole;
