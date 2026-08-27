const routePermissionCache = require("../utils/routePermissionCache");
const {
  getUserRouteRoles,
  isFailClosedRoute,
  normalizeRouteRole,
} = require("../constants/routePermissionPolicy");

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

      const userRoles = getUserRouteRoles(req.user);
      const isSuperAdmin = userRoles.has(normalizeRouteRole("SUPER_ADMIN"));
      
      if (isSuperAdmin) {
        // Super Admins always bypass this check to prevent accidental lockouts
        return next();
      }

      const pathsToCheck = Array.isArray(frontendPaths) ? frontendPaths : [frontendPaths];
      const failClosed = pathsToCheck.some(isFailClosedRoute);
      
      // Fetch the route permission configurations from Cache
      const configs = [];
      for (const p of pathsToCheck) {
        const config = await routePermissionCache.getPermission(p);
        if (config && config.isActive) {
          configs.push(config);
        }
      }

      if (configs.length === 0) {
        if (failClosed) {
          return res.status(403).json({
            error: "Forbidden. This protected route has no active permission configuration.",
          });
        }
        return next();
      }

      let hasAccess = false;

      // Check if user has required roles for AT LEAST ONE of the matching paths
      for (const config of configs) {
        const excludedRoles = config.excludeRoles || [];
        const isExcluded = excludedRoles.some((role) =>
          userRoles.has(normalizeRouteRole(role))
        );
        if (isExcluded) continue;

        if (!config.requiredWorkflowRoles || config.requiredWorkflowRoles.length === 0) {
          if (!failClosed && !isFailClosedRoute(config.path)) {
            hasAccess = true;
            break;
          }
          continue;
        }

        const roleMatches = config.requiredWorkflowRoles.some((requiredRole) =>
          userRoles.has(normalizeRouteRole(requiredRole))
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
