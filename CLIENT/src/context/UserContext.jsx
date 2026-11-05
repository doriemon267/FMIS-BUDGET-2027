import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { authApi, setDevUser } from "../config/api"; // Inalis ang setAuthToken dahil hindi na manu-manong isinasalpak ang token
import Loading from "../global/components/Loading";
import InactivityWarningDialog from "../components/InactivityWarningDialog";
import env from "../utils/env";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import useInactivityLogout from "../hooks/useInactivityLogout";

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: async () => {},
  refetchUserProfile: async () => {},
  isLoading: false,
  error: null,
  unauthorizedSuperAdmin: false,
  logout: async () => {},
  hasWorkflowRole: () => false,
  workflowRoles: [],
});

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [unauthorizedSuperAdmin, setUnauthorizedSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const closeWarningRef = useRef(null);
  const inactivityResetRef = useRef(null);
  const nav = useNavigate();

  // --- HELPER: Enrichment Logic ---
  const enrichUserWithRoles = useCallback(async (user) => {
    try {
      if (!user) return null;

      // Normalize Roles to underscore format (e.g. "BUDGET PLANNING ANALYST" → "BUDGET_PLANNING_ANALYST")
      if (Array.isArray(user.Roles)) {
        user = { ...user, Roles: user.Roles.map(r => String(r || '').replace(/\s+/g, '_').toUpperCase()).filter(Boolean) };
      }

      // Normalize array-valued identity fields to plain strings (auth server may return arrays)
      const flatStr = (val) => Array.isArray(val) ? (String(val[0] || '')) : (val != null ? String(val) : val);
      user = {
        ...user,
        Username:    flatStr(user.Username),
        Id:          flatStr(user.Id),
        Email:       flatStr(user.Email),
        DisplayName: flatStr(user.DisplayName),
        FirstName:   flatStr(user.FirstName),
        LastName:    flatStr(user.LastName),
      };

      const devHeaders = {};
      const devUserId = (Array.isArray(user?.Username) ? user.Username[0] : user?.Username) || user?.Id || user?.id || user?.userId;
      if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
      if (user?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(user.Roles) ? user.Roles : [user.Roles]).join(',');

      const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
      const accessInfo = haRes?.data?.accessInfo;

      let userWorkflowRoles = [];
      try {
        if (devUserId) {
          const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${devUserId}`, { headers: devHeaders });
          if (assignmentRes?.data?.assignment?.workflowRoles) {
            userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
          }
        }
      } catch (err) {
        console.warn("No assignment found:", err.message);
      }

      // Fallback for FULL access
      if (accessInfo?.scope === 'FULL' && (!userWorkflowRoles || userWorkflowRoles.length === 0)) {
        userWorkflowRoles = ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'];
      }

      if (accessInfo) {
        const normalizedRegions = (accessInfo.accessibleRegions || []).map((r) => ({
          id: r._id,
          _id: r._id,
          name: r.regionName || r.Region || r.name,
          regionName: r.regionName || r.Region || r.name,
          Region: r.regionName || r.Region || r.name,
        }));

        // Fetch full profile from auth server if current user object is thin (e.g. missing FirstName)
        let fullProfile = {};
        if (!user.FirstName || !user.ProfilePicture) {
          try {
            const profileRes = await authApi.get("/get-user");
            if (profileRes.data?.user) {
              fullProfile = profileRes.data.user;
            }
          } catch (e) {
            console.warn("Could not fetch full profile:", e.message);
          }
        }

        return {
          ...fullProfile, // Prioritize full profile data
          ...user,        // Merge with session user (roles, etc.)
          hierarchicalAccess: {
            ...accessInfo,
            workflowRoles: accessInfo.workflowRoles || userWorkflowRoles
          },
          regions: normalizedRegions,
        };
      }
      return user;
    } catch (error) {
      const data = error?.response?.data || {};
      const code = data.code;
      const errMsg = data.error || data.message || '';
      const isEnvUnauthorized = code === 'UNAUTHORIZED_SUPER_ADMIN' || /not authorized for this environment/i.test(String(errMsg));
      if (isEnvUnauthorized) {
        throw error;
      }
      console.warn("Error enriching user roles:", error);
      return user;
    }
  }, []);

  // --- REDIRECT LOGIC HELPER ---
  const redirectToLogin = useCallback(() => {
    const clientOrigin = IS_PRODUCTION
      ? (env("BUDGET_CLIENT_URL_PROD") || window.location.origin)
      : (env("CLIENT_URL_DEV") || window.location.origin);
    const returnUrl = clientOrigin + "/dashboard";
    const loginUrl = IS_PRODUCTION
      ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(returnUrl)}`
      : `${env("AUTH_CLIENT_URL_DEV") || env("CLIENT_URL_DEV")}/login?redirect=${encodeURIComponent(returnUrl)}`;
    window.location.href = loginUrl;
  }, []);

  // --- LOGIN HANDLER ---
  const handleSetUserInitialization = useCallback(async () => {
    setUnauthorizedSuperAdmin(false);
    const res = await api.get("/api/get-user"); // Walang nang X-Auth-Token header extraction
    try {
      const fullUser = await enrichUserWithRoles(res.data.user);
      setDevUser(fullUser);
      setCurrentUser(fullUser);
    } catch (enrichErr) {
      const d = enrichErr?.response?.data || {};
      const isEnvUnauthorized = d.code === 'UNAUTHORIZED_SUPER_ADMIN' || /not authorized for this environment/i.test(String(d.error || d.message || ''));
      if (isEnvUnauthorized) {
        setCurrentUser(null);
        setUnauthorizedSuperAdmin(true);
      } else {
        throw enrichErr;
      }
    }
  }, [enrichUserWithRoles]);

  // --- FULL LOGOUT HANDLER ---
  const handleLogout = useCallback(async () => {
    // 1. Tawagin ang logout APIs para mabura ang backend sessions at httpOnly cookies
    try {
      await api.get("/api/logout");
      await authApi.get("/logout");
    } catch (e) {
      console.warn("Logout API warning:", e.message);
    }

    // 2. Linisin ang Local Storage at Session Storage ng Budget App (wala nang token sa localStorage)
    localStorage.removeItem("user");
    localStorage.removeItem("activeWorkflowRef");
    localStorage.removeItem("activeRegion");
    localStorage.removeItem("incomeGrandTotal");
    sessionStorage.clear();

    // 3. Clear local states
    setCurrentUser(null);
    setUnauthorizedSuperAdmin(false);

    // 4. LOGOUT REDIRECT
    if (!IS_PRODUCTION) {
      const authBase = env("AUTH_CLIENT_URL_DEV") || "http://localhost:3000";
      window.location.href = `${authBase}/login`;
    } else {
      const clientId = env("CLIENT_ID");
      const budgetUrl = env("BUDGET_CLIENT_URL_PROD") || window.location.origin;
      const currentUrl = `${budgetUrl}/dashboard`;
      const returnUrl = encodeURIComponent(
        `https://accounts.nia.gov.ph/Account/Login?ReturnUrl=${encodeURIComponent(currentUrl)}`
      );

      const particularID = currentUser?.particularID || "";
      const logoffUrl = `https://accounts.nia.gov.ph/Account/LogOff?clientId=${clientId}&owner=${particularID}&returnUrl=${returnUrl}`;

      window.location.href = logoffUrl;
    }
  }, [currentUser]);

  // Allow api interceptor to send Super Admin unauthorized -> show AccessGuard page
  useEffect(() => {
    window.__onUnauthorizedSuperAdmin = () => {
      setCurrentUser(null);
      setUnauthorizedSuperAdmin(true);
    };
    return () => {
      delete window.__onUnauthorizedSuperAdmin;
    };
  }, []);

  // --- MAIN INITIALIZATION ---
  useEffect(() => {
    // Tinanggal na rin ang URL token param check dahil cookie-based na ang session

    const fetchUser = async () => {
      try {
        setUnauthorizedSuperAdmin(false);
        const res = await api.get("/api/get-user");
        
        let user = res.data?.user;
        
        // --- DETECT MOCK USER ---
        const isMock = !user || (user.Username === "909549") || (user.DisplayName && user.DisplayName.toLowerCase().includes("dev user"));
        
        if (isMock) {
          try {
            const authRes = await authApi.get("/get-user");
            if (authRes.data?.user) {
              user = authRes.data.user;
            }
          } catch (e) {
            console.warn("Could not fetch real user from auth server:", e.message);
          }
        }

        if (user) {
          try {
            const fullUser = await enrichUserWithRoles(user);
            setDevUser(fullUser);
            setCurrentUser(fullUser);
          } catch (enrichErr) {
            const d = enrichErr?.response?.data || {};
            const isEnvUnauthorized = d.code === 'UNAUTHORIZED_SUPER_ADMIN' || /not authorized for this environment/i.test(String(d.error || d.message || ''));
            if (isEnvUnauthorized) {
              setCurrentUser(null);
              setUnauthorizedSuperAdmin(true);
            } else {
              throw enrichErr;
            }
          }
        } else {
          redirectToLogin();
        }
      } catch (error) {
        const d = error?.response?.data || {};
        const isEnvUnauthorized = d.code === 'UNAUTHORIZED_SUPER_ADMIN' || /not authorized for this environment/i.test(String(d.error || d.message || ''));
        const isBudgetRoleRequired = d.code === 'BUDGET_ROLE_REQUIRED';
        if (isEnvUnauthorized || isBudgetRoleRequired) {
          setCurrentUser(null);
          setUnauthorizedSuperAdmin(true);
        } else {
          console.error("Error fetching user:", error);
          redirectToLogin();
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [enrichUserWithRoles, redirectToLogin]);

  // --- UI HELPERS ---
  const hierarchical = currentUser?.hierarchicalAccess || {};
  const workflowRoles = Array.isArray(hierarchical.workflowRoles) ? hierarchical.workflowRoles : [];
  const normalizedRoles = (currentUser?.Roles || []).map((role) => String(role || '').toUpperCase().replace(/\s+/g, '_'));
  const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('SUPERADMIN');

  const hasWorkflowRole = useCallback((role) => {
    if (isSuperAdmin) return true;
    return workflowRoles.includes(role);
  }, [isSuperAdmin, workflowRoles]);

  closeWarningRef.current = () => setShowInactivityWarning(false);

  // Auto-logout kapag walang activity sa loob ng 15 minuto
  useInactivityLogout({
    onLogout: handleLogout,
    onWarning: (reset) => {
      inactivityResetRef.current = reset;
      setShowInactivityWarning(true);
    },
    closeWarningRef,
    enabled: !!currentUser,
  });

  const handleStayLoggedIn = () => {
    inactivityResetRef.current?.();
    inactivityResetRef.current = null;
    setShowInactivityWarning(false);
  };

  const value = useMemo(() => ({
    currentUser,
    unauthorizedSuperAdmin,
    setCurrentUser: handleSetUserInitialization,
    refetchUserProfile: handleSetUserInitialization,
    logout: handleLogout,
    isLoading,
    workflowRoles,
    hasWorkflowRole,
  }), [
    currentUser,
    unauthorizedSuperAdmin,
    handleSetUserInitialization,
    handleLogout,
    isLoading,
    workflowRoles,
    hasWorkflowRole
  ]);

  if (isLoading) return <Loading />;

  return (
    <UserContext.Provider value={value}>
      {children}
      <InactivityWarningDialog
        open={showInactivityWarning}
        onStayLoggedIn={handleStayLoggedIn}
      />
    </UserContext.Provider>
  );
};

export default UserProvider;
export const useUser = () => useContext(UserContext);