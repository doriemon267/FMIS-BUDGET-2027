import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { authApi, setDevUser } from "../config/api";
import Loading from "../global/components/Loading";
import env from "../utils/env";
import IS_PRODUCTION from "../utils/IS_PRODUCTION"; // Import mo ito ulit

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: async () => {},
  isLoading: false,
  error: null,
  logout: async () => {},
  hasWorkflowRole: () => false,
  workflowRoles: [],
});

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const nav = useNavigate();

  // --- HELPER: Enrichment Logic ---
  const enrichUserWithRoles = async (user) => {
    try {
      if (!user) return null;

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

        return {
          ...user,
          hierarchicalAccess: {
            ...accessInfo,
            workflowRoles: accessInfo.workflowRoles || userWorkflowRoles
          },
          regions: normalizedRegions,
        };
      }
      return user;
    } catch (error) {
      console.warn("Error enriching user roles:", error);
      return user;
    }
  };

  // --- REDIRECT LOGIC HELPER ---
  const redirectToLogin = () => {
    const currentUrl = window.location.origin + "/dashboard";
    const loginUrl = IS_PRODUCTION
      ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(currentUrl)}`
      : `${env("CLIENT_URL_DEV")}/login`;
    window.location.href = loginUrl;
  };

  // --- LOGIN HANDLER ---
  const handleSetUserInitialization = async () => {
    const res = await authApi.get("/get-user");
    const fullUser = await enrichUserWithRoles(res.data.user);
    setDevUser(fullUser);
    setCurrentUser(fullUser);
  };

  const handleLogout = async () => {
    await authApi.get("/logout");
    setCurrentUser(null);
    if (IS_PRODUCTION) {
      const returnUrl = env("BUDGET_CLIENT_URL_PROD") ? `${env("BUDGET_CLIENT_URL_PROD")}/dashboard` : window.location.origin + "/dashboard";
      window.location.href = `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(returnUrl)}`;
    } else {
      window.location.href = env("CLIENT_URL_DEV") + "/login";
    }
  };

  // --- MAIN INITIALIZATION ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authApi.get("/get-user");
        if (res.data.user) {
          const fullUser = await enrichUserWithRoles(res.data.user);
          setDevUser(fullUser);
          setCurrentUser(fullUser);
        } else {
          // Kapag walang user response (logged out)
          redirectToLogin();
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        redirectToLogin(); // Kapag nag-error (unauthorized), kick out
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [nav]);

  // --- UI HELPERS ---
  const hierarchical = currentUser?.hierarchicalAccess || {};
  const workflowRoles = Array.isArray(hierarchical.workflowRoles) ? hierarchical.workflowRoles : [];
  const isSuperAdmin = currentUser?.Roles?.includes('SUPER_ADMIN') || currentUser?.Roles?.includes('ADMIN');

  const hasWorkflowRole = (role) => {
    if (isSuperAdmin) return true;
    return workflowRoles.includes(role);
  };

  const value = {
    currentUser,
    setCurrentUser: handleSetUserInitialization,
    logout: handleLogout,
    isLoading,
    workflowRoles,
    hasWorkflowRole, 
  };

  if (isLoading) return <Loading />;

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserProvider;
export const useUser = () => useContext(UserContext);