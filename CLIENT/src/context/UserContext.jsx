import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../config/api";
import api, { setDevUser } from "../config/api";
import Loading from "../global/components/Loading";
import env from "../utils/env";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import io from "socket.io-client"; // Import Socket.io client

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: async () => {},
  isLoading: false,
  error: null,
  logout: async () => {},
});

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [socket, setSocket] = useState(null);
  const nav = useNavigate();

  // Authentication now relies on httpOnly cookies set by the auth server.

  // Fetch user only (token is stored in httpOnly cookie on the server)
  const handleSetUserInitialization = async () => {
    const res = await authApi.get("/get-user");
    setCurrentUser(res.data.user);
  };

  const handleLogout = async () => {
    await api.get("/logout");
    setCurrentUser(null);
    const currentUrl = window.location.origin + "/dashboard";
    const loginUrl = IS_PRODUCTION
      ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(currentUrl)}`
      : env("CLIENT_URL_DEV") + "/login";
    location.href = loginUrl;
  };


  

  // Function to refetch user hierarchical access (preferred over legacy region assignments)
  const refetchUserProfile = async () => {
    if (!currentUser) return false;

    setIsRefetching(true);
    try {
      const devHeaders = {};
      // Use in-memory currentUser only
      const cu = currentUser;
      const devUserId = (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username) || cu?.Id || cu?.id || cu?.userId;
      if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
      if (cu?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(cu.Roles) ? cu.Roles : [cu.Roles]).join(',');
      const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
      const accessInfo = haRes?.data?.accessInfo;

      // Also load current user's assignment to get workflow roles
      let userWorkflowRoles = [];
      try {
        const userId = (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username) || cu?.Id || cu?.id || cu?.userId;
        if (userId) {
          const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${userId}`, { headers: devHeaders });
          if (assignmentRes?.data?.assignment?.workflowRoles) {
            userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
          }

          // If user has FULL access but no workflow roles, auto-assign them
          if (accessInfo?.scope === 'FULL' && (!userWorkflowRoles || userWorkflowRoles.length === 0)) {
            // console.log('🔧 Auto-assigning workflow roles for FULL access user');
            userWorkflowRoles = ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'];
          }
        }
      } catch (assignmentError) {
        // console.log('Could not load user assignment for workflow roles:', assignmentError.message);

        // If we can't load assignment but user has FULL access, auto-assign workflow roles
        if (accessInfo?.scope === 'FULL') {
          // console.log('🔧 Auto-assigning workflow roles for FULL access user (fallback)');
          userWorkflowRoles = ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'];
        }
      }

      if (accessInfo) {
        // Normalize regions for backward-compat fields
        const normalizedRegions = (accessInfo.accessibleRegions || []).map((r) => ({
          id: r._id,
          _id: r._id,
          name: r.regionName || r.Region || r.name,
          regionName: r.regionName || r.Region || r.name,
          Region: r.regionName || r.Region || r.name,
        }));

        const updatedUser = {
          ...currentUser,
          hierarchicalAccess: {
            ...accessInfo,
            workflowRoles: accessInfo.workflowRoles || userWorkflowRoles
          },
          regions: normalizedRegions,
        };
        setCurrentUser(updatedUser);
        try { setDevUser(updatedUser); } catch (e) {}

        // Consider it a success if user has FULL scope or any accessible unit
        const hasAnyAccess =
          accessInfo.scope === "FULL" ||
          (accessInfo.accessibleRegions?.length || accessInfo.accessibleDepartments?.length || accessInfo.accessibleDivisions?.length);
        return Boolean(hasAnyAccess);
      }

      return false;
    } catch (error) {
      console.error("❌ Error refetching hierarchical access:", error);
      return false;
    } finally {
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authApi.get("/get-user");
          if (res.data.user) {
          let user = res.data.user;
          
          // Debug: Log the authentication user ID
          
          // Preferred: fetch hierarchical access info (replaces legacy region assignment)
          try {
            // Attach dev identity explicitly on first load
            const devHeaders = {};
            const devUserId = (Array.isArray(user?.Username) ? user.Username[0] : user?.Username) || user?.Id || user?.id || user?.userId;
            if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
            if (user?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(user.Roles) ? user.Roles : [user.Roles]).join(',');

            // 🔍 DEBUG: Log what's being sent to backend
            // console.log('🔍 Frontend Debug - Dev Headers being sent:', {
            //   'X-Dev-User-Id': devHeaders['X-Dev-User-Id'],
            //   'X-Dev-Roles': devHeaders['X-Dev-Roles'],
            //   userObject: {
            //     Id: user?.Id,
            //     id: user?.id,
            //     userId: user?.userId,
            //     Username: user?.Username,
            //     Roles: user?.Roles
            //   }
            // });

            const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
            const accessInfo = haRes?.data?.accessInfo;

            // Also load current user's assignment to get workflow roles
            let userWorkflowRoles = [];
            try {
              const userId = (Array.isArray(user?.Username) ? user.Username[0] : user?.Username) || user?.Id || user?.id || user?.userId;
              if (userId) {
                // console.log('🔍 Fetching assignments for userId:', userId);
                const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${userId}`, { headers: devHeaders });
                if (assignmentRes?.data?.assignment?.workflowRoles) {
                  userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
                }
              }
            } catch (assignmentError) {
              // console.log('❌ Could not load user assignment for workflow roles:', assignmentError.response?.status, assignmentError.response?.data || assignmentError.message);
            }

            if (accessInfo) {
              const normalizedRegions = (accessInfo.accessibleRegions || []).map((r) => ({
                id: r._id,
                _id: r._id,
                name: r.regionName || r.Region || r.name,
                regionName: r.regionName || r.Region || r.name,
                Region: r.regionName || r.Region || r.name,
              }));

              user = {
                ...user,
                hierarchicalAccess: {
                  ...accessInfo,
                  workflowRoles: accessInfo.workflowRoles || (accessInfo.scope === 'FULL' ? ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'] : userWorkflowRoles)
                },
                regions: normalizedRegions,
              };
            }
          } catch (haError) {
            console.error("❌ Could not fetch hierarchical access:", haError.response?.status, haError.response?.data?.message || haError.message);
            // Leave regions undefined; guard will show pending page if none
          }
          
          setCurrentUser(user);
          try { setDevUser(user); } catch (e) {}

          // Initialize WebSocket connection for real-time updates (server uses auth cookie)
          // initializeWebSocket(user);
        } else {
          try { setDevUser(null); } catch (e) {}
          const currentUrl = window.location.origin + "/dashboard";
          const loginUrl = IS_PRODUCTION
            ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(currentUrl)}`
            : env("CLIENT_URL_DEV") + "/login";
          location.href = loginUrl;
        }
      } catch (error) {
        try { setDevUser(null); } catch (e) {}
        console.error("Error fetching user:", error);
        const currentUrl = window.location.origin + "/dashboard";
        const loginUrl = IS_PRODUCTION
          ? `${env("LOGIN_REDIRECT_URL")}?ReturnUrl=${encodeURIComponent(currentUrl)}`
          : env("CLIENT_URL_DEV") + "/login";
        location.href = loginUrl;
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [nav]);

  // Cleanup WebSocket connection on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        // console.log('🧹 Cleaning up WebSocket connection');
        socket.disconnect();
      }
    };
  }, [socket]);

  // Convenience: derive workflow roles and assignment
  const hierarchical = currentUser?.hierarchicalAccess || {};
  const workflowRoles = Array.isArray(hierarchical.workflowRoles) ? hierarchical.workflowRoles : [];
  
  // SUPER_ADMIN users automatically get FULL access
  const isSuperAdmin = currentUser?.Roles?.includes('SUPER_ADMIN') || currentUser?.Roles?.includes('SUPER ADMIN') || currentUser?.Roles?.includes('ADMIN');
  const assignmentLevel = isSuperAdmin ? 'FULL' : (hierarchical.scope || hierarchical.assignmentLevel || 'NONE');

  const hasWorkflowRole = (role) => isSuperAdmin ? true : workflowRoles.includes(role);

  const canTransition = {
    responsibilityCenterApprove: assignmentLevel === 'RESPONSIBILITY_CENTER' || assignmentLevel === 'FULL' ? hasWorkflowRole('responsibilityCenterApprover') : false,
    officeConsolidate: (assignmentLevel === 'OFFICE' || assignmentLevel === 'FULL') && hasWorkflowRole('officeConsolidator'),
    officeSubmit: (assignmentLevel === 'OFFICE' || assignmentLevel === 'FULL') && hasWorkflowRole('officeSubmission'),
    officeFinalVerify: (assignmentLevel === 'OFFICE' || assignmentLevel === 'FULL') && hasWorkflowRole('officeFinalVerifier')
  };

  const value = {
    currentUser,
    setCurrentUser: handleSetUserInitialization,
    logout: handleLogout,
    refetchUserProfile,
    isLoading,
    loading: isLoading || isRefetching, // Provide both for compatibility
    // jwtToken removed: authentication uses httpOnly cookies
    // Expose workflow helpers
    workflowRoles,
    assignmentLevel,
    hasWorkflowRole,
    canTransition,
  };

  if (isLoading) return <Loading />;

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserProvider;
export const useUser = () => useContext(UserContext);