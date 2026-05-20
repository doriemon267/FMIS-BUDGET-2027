import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { authApi, setDevUser, setAuthToken } from "../config/api";
import Loading from "../global/components/Loading";
import InactivityWarningDialog from "../components/InactivityWarningDialog";
import env from "../utils/env";
import IS_PRODUCTION from "../utils/IS_PRODUCTION"; // Import mo ito ulit
import useInactivityLogout from "../hooks/useInactivityLogout";

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: async () => {},
  // New helper: explicitly refetch the latest user profile (roles, hierarchical access, email, etc.)
  refetchUserProfile: async () => {},
  isLoading: false,
  error: null,
  /** When true: user has SUPER_ADMIN role but ID is not in SUPER_ADMIN_IDS whitelist - block access */
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
  const enrichUserWithRoles = async (user) => {
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
  };

  // --- REDIRECT LOGIC HELPER ---
  const redirectToLogin = () => {
    // Return URL: after login, come back to budget (dashboard)
    const clientOrigin = IS_PRODUCTION
      ? (env("BUDGET_CLIENT_URL_PROD") || window.location.origin)
      : (env("CLIENT_URL_DEV") || window.location.origin);
    const returnUrl = clientOrigin + "/dashboard";
    const loginUrl = IS_PRODUCTION
      ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(returnUrl)}`
      : `${env("AUTH_CLIENT_URL_DEV") || env("CLIENT_URL_DEV")}/login?redirect=${encodeURIComponent(returnUrl)}`;
    window.location.href = loginUrl;
  };

  // --- LOGIN HANDLER ---
  const handleSetUserInitialization = async () => {
    setUnauthorizedSuperAdmin(false);
    const res = await api.get("/api/get-user");
    // Token is delivered via X-Auth-Token header (not body) to avoid exposure in Network preview
    const headerToken = res.headers?.["x-auth-token"] || res.headers?.["X-Auth-Token"];
    if (headerToken) setAuthToken(headerToken);
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
  };

  const handleLogout = async () => {
    // 1. Clear sessions
    try {
      await api.get("/api/logout");
      await authApi.get("/logout");
    } catch (e) {
      console.warn("Logout error:", e.message);
    }

    // 2. Clear local states
    setAuthToken(null);
    setCurrentUser(null);
    setUnauthorizedSuperAdmin(false);

    // 3. LOGOUT REDIRECT
    if (!IS_PRODUCTION) {
      // DEV REDIRECT
      const authBase = env("AUTH_SERVER_URL_DEV") || env("AUTH_CLIENT_URL_DEV") || "http://localhost:5000";
      const budgetUrl = env("CLIENT_URL_DEV") || "http://localhost:3005";
      const returnUrl = encodeURIComponent(`${budgetUrl}/dashboard`);

      window.location.href = `${authBase}/login?redirect=${returnUrl}`;
    } else {
      // PRODUCTION REDIRECT (NIA SSO)
      const clientId = env("CLIENT_ID");
      const budgetUrl = env("BUDGET_CLIENT_URL_PROD") || window.location.origin;
      const currentUrl = `${budgetUrl}/dashboard`;
      const returnUrl = encodeURIComponent(
        `https://accounts.nia.gov.ph/Account/Login?ReturnUrl=${encodeURIComponent(currentUrl)}`
      );

      const particularID = currentUser?.particularID || "";
      const logoffUrl = `https://accounts.nia.gov.ph/account/logoff?clientId=${clientId}&owner=${particularID}&returnUrl=${returnUrl}`;

      window.location.href = logoffUrl;
    }
  };

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
    // Read token from URL after auth redirect (?token=, ?access_token=, #access_token=, #token=)
    const url = typeof window !== "undefined" ? window.location : {};
    const params = new URLSearchParams(url.search || "");
    const hash = (url.hash || "").replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const tokenFromUrl =
      params.get("token") ||
      params.get("access_token") ||
      hashParams.get("access_token") ||
      hashParams.get("token");
    if (tokenFromUrl) {
      setAuthToken(tokenFromUrl);
      ["token", "access_token"].forEach((k) => {
        params.delete(k);
        hashParams.delete(k);
      });
      const cleanUrl = url.pathname || "/dashboard";
      const cleanSearch = params.toString();
      const newUrl = cleanSearch ? `${cleanUrl}?${cleanSearch}` : cleanUrl;
      window.history.replaceState({}, "", newUrl);
    }

    const fetchUser = async () => {
      try {
        setUnauthorizedSuperAdmin(false);
        const res = await api.get("/api/get-user");
        
        let user = res.data?.user;
        
        // --- DETECT MOCK USER ---
        // If the budget server returns a mock "Dev User", try to get the real one from Auth Server
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
          const headerToken = res.headers?.["x-auth-token"] || res.headers?.["X-Auth-Token"];
          if (headerToken) setAuthToken(headerToken);
          
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
  }, []);

  // --- UI HELPERS ---
  const hierarchical = currentUser?.hierarchicalAccess || {};
  const workflowRoles = Array.isArray(hierarchical.workflowRoles) ? hierarchical.workflowRoles : [];
  const normalizedRoles = (currentUser?.Roles || []).map((role) => String(role || '').toUpperCase().replace(/\s+/g, '_'));
  const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('SUPERADMIN');

  const hasWorkflowRole = (role) => {
    if (isSuperAdmin) return true;
    return workflowRoles.includes(role);
  };

  // Close warning modal when hook resets due to activity
  closeWarningRef.current = () => setShowInactivityWarning(false);

  // Auto-logout kapag walang activity sa loob ng 15 minuto (may warning 1 min bago)
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

  const value = {
    currentUser,
    unauthorizedSuperAdmin,
    setCurrentUser: handleSetUserInitialization,
    refetchUserProfile: handleSetUserInitialization,
    logout: handleLogout,
    isLoading,
    workflowRoles,
    hasWorkflowRole,
  };

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