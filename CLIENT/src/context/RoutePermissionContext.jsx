import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../config/api";

/**
 * RoutePermissionContext
 *
 * Fetches all dynamic route permissions from the backend once on mount.
 * Components (especially ProtectedRoute) can call getRoutePermission(path)
 * to retrieve the DB-stored config for that path and override the hard-coded defaults.
 */

const RoutePermissionContext = createContext({
  /** Map<string, RoutePermissionDoc> – keyed by route path */
  permissionMap: {},
  isLoading: true,
  /** Returns the dynamic permission config for a given path, or null if not found */
  getRoutePermission: (_path) => null,
  /** Force re-fetch (call after saving changes in the management UI) */
  refetch: async () => {},
});

export const RoutePermissionProvider = ({ children }) => {
  const [permissionMap, setPermissionMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get("/api/route-permissions");
      const routes = res?.data?.routes ?? [];
      const map = {};
      routes.forEach((r) => {
        map[r.path] = r;
      });
      setPermissionMap(map);
    } catch (e) {
      // Non-fatal — ProtectedRoute will fall back to hard-coded props
      console.warn("[RoutePermissionContext] Could not fetch route permissions:", e?.message || e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const getRoutePermission = useCallback(
    (path) => {
      if (!path) return null;
      return permissionMap[path] ?? null;
    },
    [permissionMap]
  );

  return (
    <RoutePermissionContext.Provider
      value={{ permissionMap, isLoading, getRoutePermission, refetch: fetchPermissions }}
    >
      {children}
    </RoutePermissionContext.Provider>
  );
};

export const useRoutePermissions = () => useContext(RoutePermissionContext);

export default RoutePermissionContext;
