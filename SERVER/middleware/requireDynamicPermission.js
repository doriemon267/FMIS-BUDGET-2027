const routePermissionCache = require("../utils/routePermissionCache");

/**
 * requireDynamicPermission Middleware
 * 
 * Secures backend API endpoints by checking the dynamic RoutePermission rules in the database.
 * This links frontend visual permissions directly to backend data security.
 * 
 * @param {string|string[]} frontendPaths - The frontend path(s) this API endpoint corresponds to. e.g. '/fysettings'
 * @returns Express Middleware
 */
const requireDynamicPermission = (frontendPaths) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized. User not found in request." });
      }

      // Extract user roles and standardize them (uppercase, trim)
      const userJobRoles = (req.user.Roles || []).map((r) => String(r).toUpperCase().trim());
      const userWorkflowRoles = (req.user.workflowRoles || []).map((r) => String(r).toUpperCase().trim());
      
      // Determine if user is a Super Admin based on our common mappings
      const isSuperAdmin = userJobRoles.some(r => r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'ADMIN');
      
      if (isSuperAdmin) {
        // Super Admins always bypass this check to prevent accidental lockouts
        return next();
      }

      const pathsToCheck = Array.isArray(frontendPaths) ? frontendPaths : [frontendPaths];
      
      // Fetch the route permission configurations from Cache
      const configs = [];
      for (const p of pathsToCheck) {
        const config = await routePermissionCache.getPermission(p);
        if (config && config.isActive) {
          configs.push(config);
        }
      }

      // If no active configurations exist for the provided paths, we allow access by default
      // to avoid breaking endpoints that haven't been configured in the UI yet.
      if (configs.length === 0) {
        return next();
      }

      let hasAccess = false;

      // Check if user has required roles for AT LEAST ONE of the matching paths
      for (const config of configs) {
        // If the configuration exists but has no required roles, it's open to everyone
        if (!config.requiredWorkflowRoles || config.requiredWorkflowRoles.length === 0) {
          hasAccess = true;
          break;
        }

        const requiredRoles = config.requiredWorkflowRoles.map((r) => String(r).toUpperCase());
        
        // Match against both Job Roles and Workflow Roles
        const roleMatches = requiredRoles.some((requiredRole) => 
          userJobRoles.includes(requiredRole) || userWorkflowRoles.includes(requiredRole)
        );

        if (roleMatches) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          error: "Forbidden. You do not have the required dynamic route permissions for this action." 
        });
      }

      // Access granted
      next();
    } catch (error) {
      console.error("[requireDynamicPermission] Error evaluating permissions:", error);
      res.status(500).json({ error: "Server error during permission evaluation" });
    }
  };
};

module.exports = requireDynamicPermission;
