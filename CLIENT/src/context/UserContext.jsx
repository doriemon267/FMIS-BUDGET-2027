import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { authApi, setDevUser } from "../config/api"; // Siguraduhing tama ang import path mo dito
import Loading from "../global/components/Loading";
import env from "../utils/env";

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: async () => {},
  isLoading: false,
  error: null,
  logout: async () => {},
  // Idinagdag natin para ma-access sa ibang components
  hasWorkflowRole: () => false, 
  workflowRoles: [],
});

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const nav = useNavigate();

  // --- HELPER: Kuhanin ang RBAC at Workflow Roles ---
  // Ito ang "bridge" para makuha yung logic galing sa old code nang hindi pumuputok ang useEffect
  const enrichUserWithRoles = async (user) => {
    try {
      if (!user) return null;

      // 1. Prepare Headers (gaya ng dati)
      const devHeaders = {};
      const devUserId = (Array.isArray(user?.Username) ? user.Username[0] : user?.Username) || user?.Id || user?.id || user?.userId;
      if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
      if (user?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(user.Roles) ? user.Roles : [user.Roles]).join(',');

      // 2. Fetch Access Info
      const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
      const accessInfo = haRes?.data?.accessInfo;

      // 3. Fetch Workflow Assignments
      let userWorkflowRoles = [];
      try {
        if (devUserId) {
          const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${devUserId}`, { headers: devHeaders });
          if (assignmentRes?.data?.assignment?.workflowRoles) {
            userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
          }
        }
      } catch (err) {
        console.warn("No assignment found or error fetching assignment:", err.message);
      }

      // 4. Fallback for FULL access (Auto-assign roles if super admin/full scope)
      if (accessInfo?.scope === 'FULL' && (!userWorkflowRoles || userWorkflowRoles.length === 0)) {
        userWorkflowRoles = ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'];
      }

      // 5. Merge Data & Normalize Regions
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
      
      return user; // Kung walang RBAC, return basic user
    } catch (error) {
      console.warn("Error enriching user roles:", error);
      return user; // Return basic user on error para hindi mag-crash
    }
  };

  // --- LOGIN HANDLER ---
  const handleSetUserInitialization = async () => {
    const res = await authApi.get("/get-user");
    // I-enrich muna natin bago i-save
    const fullUser = await enrichUserWithRoles(res.data.user);
    setDevUser(fullUser); // Set dev user for API interceptor
    setCurrentUser(fullUser);
  };

  const handleLogout = async () => {
    await authApi.get("/logout");
    setCurrentUser(null);
    window.location.href = env("CLIENT_URL_DEV") + "/login";
  };

  // --- MAIN INITIALIZATION (useEffect) ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authApi.get("/get-user");
        if (res.data.user) {
            // Dito natin tinatawag yung enrichment logic
            const fullUser = await enrichUserWithRoles(res.data.user);
            setDevUser(fullUser); // Set dev user for API interceptor
            setCurrentUser(fullUser);
        }
      } catch (error) {
        console.warn("Error fetching user:", error);
        // Optional: Redirect to login if needed, or stay silent
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [nav]);

  // --- HELPERS PARA SA UI (Para gumana yung mga buttons mo) ---
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
    // Extra helpers na kailangan mo
    workflowRoles,
    hasWorkflowRole, 
  };

  if (isLoading) return <Loading />;

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserProvider;
export const useUser = () => useContext(UserContext);