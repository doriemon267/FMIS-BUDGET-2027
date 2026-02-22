/**
 * requireBudgetRole - Blocks users whose roles are NOT in the budget roles list.
 * Exception: SUPER ADMIN can always proceed.
 *
 * Only users with at least one valid budget role (or SUPER ADMIN) can access the system.
 */
const VALID_BUDGET_ROLES = [
  'SUPER ADMIN',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'BUDGET PREPARER',
  'BUDGET_PREPARER',
  'BUDGET REVIEWER',
  'BUDGET_REVIEWER',
  'BUDGET APPROVER',
  'BUDGET_APPROVER',
  'BUDGET PLANNING ANALYST',
  'BUDGET_PLANNING_ANALYST',
  'BUDGET OFFICER',
  'BUDGET_OFFICER',
  'BUDGET MANAGER',
  'BUDGET_MANAGER',
  'OVERALL BUDGET APPROVER',
  'OVERALL_BUDGET_APPROVER',
  'BUDGET COORDINATOR',
  'BUDGET_COORDINATOR',
  'BUDGET_ADMIN',
  'REVIEWER',
  'APPROVER',
];

/** Paths that should skip the budget role check (e.g. get-user so client can fetch profile and redirect) */
const EXEMPT_PATHS = ['/get-user', '/login', '/logout', 'get-user', 'login', 'logout'];

function hasValidBudgetRole(userRoles) {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  const normalized = userRoles.map((r) => (typeof r === 'string' ? r.replace(/\s+/g, '_').toUpperCase().trim() : String(r)));
  return normalized.some((r) => VALID_BUDGET_ROLES.some((br) => br === r || r === br.replace(/\s/g, '_')));
}

function isSuperAdmin(userRoles) {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.some((r) => {
    const n = String(r || '').toUpperCase().replace(/\s/g, '_');
    return n === 'SUPER_ADMIN' || n === 'SUPERADMIN' || n === 'SUPER ADMIN';
  });
}

function isExemptPath(req) {
  const path = (req.path || req.url || '').split('?')[0];
  const full = (req.originalUrl || req.url || path || '').split('?')[0];
  return EXEMPT_PATHS.some((e) => path.includes(e) || full.includes(e));
}

/**
 * Middleware: Block if user has no budget role and is not SUPER ADMIN.
 * Must run AFTER token middleware (req.user must exist).
 */
function requireBudgetRole(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (isExemptPath(req)) return next();

  const userRoles = req.user?.Roles || [];
  if (isSuperAdmin(userRoles)) return next();
  if (hasValidBudgetRole(userRoles)) return next();

  return res.status(403).json({
    message: 'Access denied. Your account does not have a budget role. Only users with budget roles or SUPER ADMIN can access this system.',
    code: 'BUDGET_ROLE_REQUIRED',
  });
}

module.exports = { requireBudgetRole, hasValidBudgetRole, isSuperAdmin, VALID_BUDGET_ROLES };
