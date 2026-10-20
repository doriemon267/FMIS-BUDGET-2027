import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../config/api";

/**
 * RoutePermissionContext
 *
 * Fetches all dynamic route permissions from the backend once on mount.
 * Also manages system-wide maintenance mode state.
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
  /** Apply a saved route permission without refetching the full map */
  syncRoutePermission: (_route) => {},
  // ─── Maintenance Mode ──────────────────────────────────────────────────────
  isMaintenanceMode: false,
  maintenanceMessage: "",
  maintenanceUpdatedAt: null,
  maintenanceUpdatedBy: null,
  refetchMaintenanceStatus: async () => {},
  updateMaintenanceStatus: async () => {},
});

export const RoutePermissionProvider = ({ children }) => {
  const [permissionMap, setPermissionMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceUpdatedAt, setMaintenanceUpdatedAt] = useState(null);
  const [maintenanceUpdatedBy, setMaintenanceUpdatedBy] = useState(null);

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
      // If we got a 503 with maintenance info, extract it from the error
      const errData = e?.response?.data;
      if (e?.response?.status === 503 && errData?.isMaintenanceMode) {
        setIsMaintenanceMode(true);
        setMaintenanceMessage(errData.message || "");
      }
      // Non-fatal — ProtectedRoute will fall back to hard-coded props
      console.warn("[RoutePermissionContext] Could not fetch route permissions:", e?.message || e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/route-permissions/maintenance-status");
      const data = res?.data || {};
      setIsMaintenanceMode(Boolean(data.isMaintenanceMode));
      setMaintenanceMessage(data.maintenanceMessage || "");
      setMaintenanceUpdatedAt(data.updatedAt || null);
      setMaintenanceUpdatedBy(data.updatedBy || null);
    } catch (e) {
      // If 503, maintenance is active
      const errData = e?.response?.data;
      if (e?.response?.status === 503 && errData?.isMaintenanceMode) {
        setIsMaintenanceMode(true);
        setMaintenanceMessage(errData.message || "");
      }
      console.warn("[RoutePermissionContext] Could not fetch maintenance status:", e?.message || e);
    }
  }, []);

  const updateMaintenanceStatus = useCallback(async (newIsActive, newMessage) => {
    const res = await api.put("/api/route-permissions/maintenance-status", {
      isActive: newIsActive,
      message: newMessage ?? "",
    });
    const data = res?.data || {};
    setIsMaintenanceMode(Boolean(data.isMaintenanceMode));
    setMaintenanceMessage(data.maintenanceMessage || "");
    setMaintenanceUpdatedAt(data.updatedAt || null);
    setMaintenanceUpdatedBy(data.updatedBy || null);
    return data;
  }, []);

  useEffect(() => {
    fetchPermissions();
    fetchMaintenanceStatus();
  }, [fetchPermissions, fetchMaintenanceStatus]);

  const getRoutePermission = useCallback(
    (path) => {
      if (!path) return null;
      return permissionMap[path] ?? null;
    },
    [permissionMap]
  );

  const syncRoutePermission = useCallback((route) => {
    if (!route?.path) return;
    setPermissionMap((previous) => {
      const next = { ...previous };
      if (route.isActive === false) {
        delete next[route.path];
      } else {
        next[route.path] = { ...previous[route.path], ...route };
      }
      return next;
    });
  }, []);

  return (
    <RoutePermissionContext.Provider
      value={{
        permissionMap,
        isLoading,
        getRoutePermission,
        refetch: fetchPermissions,
        syncRoutePermission,
        // Maintenance mode
        isMaintenanceMode,
        maintenanceMessage,
        maintenanceUpdatedAt,
        maintenanceUpdatedBy,
        refetchMaintenanceStatus: fetchMaintenanceStatus,
        updateMaintenanceStatus,
      }}
    >
      {children}
    </RoutePermissionContext.Provider>
  );
};

export const useRoutePermissions = () => useContext(RoutePermissionContext);

export default RoutePermissionContext;
