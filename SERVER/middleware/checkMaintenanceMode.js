const SystemSetting = require("../models/SystemSetting");

// Paths (relative to /api) that are ALWAYS accessible regardless of maintenance mode.
const EXEMPT_PATHS = [
  "/get-user",
  "/logout",
  "/route-permissions/maintenance-status",
  "/csrf-token",
  "/auth",
  "/hierarchical-rbac/my-access",
  "/hierarchical-rbac/assignments",
];

// Cache maintenance status briefly (5 seconds) to reduce DB queries
let maintenanceCache = null;
let maintenanceCacheTime = 0;
const CACHE_TTL_MS = 5000;

/**
 * Maintenance Mode Check
 * Designed to be run AFTER is_auth and requireBudgetRole, 
 * so req.user is guaranteed to be fully populated with Roles.
 * Returns TRUE if request was blocked (response sent), FALSE if it passed.
 */
const checkMaintenanceMode = async (req, res) => {
  try {
    // Skip OPTIONS preflight
    if (req.method === "OPTIONS") return false;

    // Skip exempt paths
    const reqPath = req.path || "";
    // If req.path still has /api prefix (depends on where it's mounted), strip it for the check
    const cleanPath = reqPath.replace(/^\/api/, '');
    const isExempt = EXEMPT_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`));
    if (isExempt) return false;

    // Read from cache or DB
    const now = Date.now();
    if (!maintenanceCache || now - maintenanceCacheTime > CACHE_TTL_MS) {
      try {
        const setting = await SystemSetting.findOne({ key: "maintenance_mode" }).lean();
        maintenanceCache = setting?.value || { isActive: false };
        maintenanceCacheTime = now;
      } catch (dbError) {
        // If DB error, fail-open (don't block users)
        console.error("[MaintenanceModeMiddleware] DB error:", dbError.message);
        return false;
      }
    }

    const isMaintenanceMode = Boolean(maintenanceCache?.isActive);
    if (!isMaintenanceMode) return false; // maintenance is OFF — pass through everyone

    // Maintenance is ON — check roles from req.user (already populated by is_auth)
    const userRoles = req.user?.Roles || [];
    const hasSuperAdminRole = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPERADMIN');

    if (hasSuperAdminRole) return false; // Super Admin bypasses maintenance

    // Non-Super Admin during maintenance → 503
    const maintenanceMessage =
      maintenanceCache?.message ||
      "The system is currently under maintenance. Please try again later.";

    res.status(503).json({
      error: "System is currently under maintenance.",
      isMaintenanceMode: true,
      message: maintenanceMessage,
    });
    return true; // Blocked
  } catch (err) {
    console.error("[MaintenanceModeMiddleware] Unexpected error:", err.message);
    return false; // fail-open
  }
};

/**
 * Invalidate the cache (call after toggling maintenance mode)
 */
checkMaintenanceMode.invalidateCache = () => {
  maintenanceCache = null;
  maintenanceCacheTime = 0;
};

module.exports = checkMaintenanceMode;
