/**
 * Standardized Budget Roles (Internal format: UPPERCASE_WITH_UNDERSCORES)
 */
const VALID_BUDGET_ROLES = new Set([
  'SUPER_ADMIN',
  'SUPERADMIN',
  'BUDGET_PREPARER',
  'BUDGET_REVIEWER',
  'BUDGET_APPROVER',
  'BUDGET_PLANNING_ANALYST',
  'BUDGET_OFFICER',
  'BUDGET_MANAGER',
  'OVERALL_BUDGET_APPROVER',
  'BUDGET_COORDINATOR',
  'BUDGET_ADMIN',
  'REVIEWER',
  'APPROVER',
]);

/** Paths that skip the check - Gamit ang exact starts-with logic */
const EXEMPT_PATHS = ['/get-user', '/login', '/logout'];

/**
 * Helper to normalize any role string to internal format
 */
const normalizeRole = (role) => 
  String(role || '').trim().replace(/\s+/g, '_').toUpperCase();

/** FOR AUTHORIZED SUPER ADMIN ROLE */
const AUTHORIZED_SUPER_ADMINS = process.env.SUPER_ADMIN_IDS 
  ? process.env.SUPER_ADMIN_IDS.split(',') 
  : ['111111']; // Fallback ID

function hasValidBudgetRole(userRoles) {
  if (!Array.isArray(userRoles)) return false;
  
  return userRoles.some((role) => {
    const n = normalizeRole(role);
    // Super admin check included in the set lookup or explicit check
    return VALID_BUDGET_ROLES.has(n);
  });
}

function isExemptPath(req) {
  const url = (req.originalUrl || req.url || '').split('?')[0];
  // Mas secured na check: Dapat ang simula ng path ay isa sa EXEMPT_PATHS
  return EXEMPT_PATHS.some((p) => url === p || url.startsWith(`${p}/`));
}

/**
 * Middleware: requireBudgetRole
 */
function requireBudgetRole(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (isExemptPath(req)) return next();

  const userRoles = req.user?.Roles || [];
  const userId = String(req.user?.userId || ''); // Kunin ang ID ng user

  // Check if the user has a Super Admin role
  const hasSuperAdminRole = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPERADMIN');

  if (hasSuperAdminRole) {
    // KAHIT SUPER ADMIN: I-check kung authorized ang ID na ito
    if (AUTHORIZED_SUPER_ADMINS.includes(userId)) {
      return next(); // Pasok!
    } else {
      console.warn(`[SECURITY ALERT] User ${userId} tried to use SUPER_ADMIN role but is not authorized.`);
      return res.status(403).json({
        error: 'Restricted Access',
        message: 'Your role is Super Admin, but your specific User ID is not authorized for this action.',
        code: 'UNAUTHORIZED_SUPER_ADMIN'
      });
    }
  }

  // Regular Budget Role Check
  if (hasValidBudgetRole(userRoles)) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied.',
    message: 'Budget role required.',
    code: 'BUDGET_ROLE_REQUIRED',
  });
}

module.exports = { requireBudgetRole, hasValidBudgetRole, VALID_BUDGET_ROLES };