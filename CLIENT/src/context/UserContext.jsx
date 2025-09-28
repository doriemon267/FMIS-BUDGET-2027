import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../config/api";
import api from "../config/api";
import Loading from "../global/components/Loading";
import env from "../utils/env";
import CryptoJS from "crypto-js"; // Import CryptoJS for encryption
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

  // Function to encrypt and store token
  const storeToken = (token) => {
    const encryptedToken = CryptoJS.AES.encrypt(
      token,
      env("SECRET_KEY")
    ).toString();
    localStorage.setItem("token", encryptedToken);
  };

  // Function to retrieve and decrypt token
  const getToken = () => {
    const encryptedToken = localStorage.getItem("token");
    if (!encryptedToken) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, env("SECRET_KEY"));
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Error decrypting token:", error);
      return null;
    }
  };

  // Fetch user and store token
  const handleSetUserInitialization = async () => {
    const res = await authApi.get("/get-user");
    setCurrentUser(res.data.user);
    if (res.data.jwtToken) {
      storeToken(res.data.jwtToken);
    }
  };

  const handleLogout = async () => {
    // Disconnect WebSocket before logout
    // if (socket) {
    //   socket.disconnect();
    //   setSocket(null);
    // }

    // Clear polling interval
    // if (window.permissionPollingInterval) {
    //   clearInterval(window.permissionPollingInterval);
    //   window.permissionPollingInterval = null;
    // }

    await authApi.get("/logout");
    setCurrentUser(null);
    localStorage.removeItem("token"); // Remove token on logout
    localStorage.removeItem("currentUser"); // Remove user data for RegionContext
    localStorage.removeItem("activeRegion"); // Clear active region
    location.href = env("AUTH_CLIENT_URL") + "/login";
  };

  // Function to refetch user hierarchical access (preferred over legacy region assignments)
  const refetchUserProfile = async () => {
    if (!currentUser) return false;

    setIsRefetching(true);
    try {
      const devHeaders = {};
      const cu = currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
      const devUserId = cu?.Id || cu?.id || cu?.userId || (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username);
      if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
      if (cu?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(cu.Roles) ? cu.Roles : [cu.Roles]).join(',');
      const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
      const accessInfo = haRes?.data?.accessInfo;

      // Also load current user's assignment to get workflow roles
      let userWorkflowRoles = [];
      try {
        const userId = cu?.Id || cu?.id || cu?.userId || (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username);
        if (userId) {
          const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${userId}`, { headers: devHeaders });
          if (assignmentRes?.data?.assignment?.workflowRoles) {
            userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
          }

          // If user has FULL access but no workflow roles, auto-assign them
          if (accessInfo?.scope === 'FULL' && (!userWorkflowRoles || userWorkflowRoles.length === 0)) {
            console.log('🔧 Auto-assigning workflow roles for FULL access user');
            userWorkflowRoles = ['responsibilityCenterCreator', 'responsibilityCenterApprover', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'responsibilityCenterFinalVerifier', 'officeFinalVerifier'];
          }
        }
      } catch (assignmentError) {
        console.log('Could not load user assignment for workflow roles:', assignmentError.message);

        // If we can't load assignment but user has FULL access, auto-assign workflow roles
        if (accessInfo?.scope === 'FULL') {
          console.log('🔧 Auto-assigning workflow roles for FULL access user (fallback)');
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
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));

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

  // Initialize WebSocket connection for real-time permission updates
  // const initializeWebSocket = (user) => {
  //   if (!user) return;

  //   const baseUrl = env("API_BASE_URL") || env("SERVER_URL") || "http://localhost:5005";
  //   const serverUrl = baseUrl.replace(/\/$/, '');
  //   const isDev = !!import.meta.env.DEV;
  //   const transports = isDev ? ['polling'] : ['polling', 'websocket'];
  //   const upgrade = isDev ? false : true;
  //   console.log('🛰️ Initializing Socket.IO', { serverUrl, transports, upgrade });

  //   const newSocket = io(serverUrl, {
  //     path: '/socket.io',
  //     transports,
  //     upgrade,
  //     rememberUpgrade: true,
  //     timeout: 20000,
  //     withCredentials: true,
  //     reconnection: true,
  //     reconnectionAttempts: 5,
  //     reconnectionDelay: 1000,
  //   });

  //   newSocket.on('connect', () => {
  //     console.log('🔌 Connected to WebSocket server');
      
  //     // Join user-specific room for targeted updates
  //     const userId = user.Id || user.id || user.userId || user.Username;
  //     if (userId) {
  //       newSocket.emit('join-user-room', userId);
  //     }

  //     // Join admin room if user is admin
  //     const isAdmin = user.Roles?.includes('SUPER ADMIN') || user.Roles?.includes('BUDGET ADMIN');
  //     if (isAdmin) {
  //       newSocket.emit('join-admin-room');
  //     }
  //   });

  //   // Listen for permission updates
  //   newSocket.on('permission-updated', async (data) => {
  //     console.log('🔄 Permission update received:', data);
      
  //     // If this update affects the current user, refresh their permissions
  //     const currentUserId = user.Id || user.id || user.userId || user.Username;
  //     if (data.userId === currentUserId) {
  //       console.log('📋 Refreshing permissions for current user...');
  //       await refetchUserProfile();
        
  //       // Show notification to user
  //       if (window.showSnackbar) {
  //         window.showSnackbar('Your permissions have been updated by an administrator.', 'info');
  //       }
  //     }
  //   });

  //   // Listen for admin permission updates
  //   newSocket.on('admin-permission-updated', (data) => {
  //     console.log('👑 Admin permission update:', data);
  //     // Admin users can refresh their view or show notification
  //     if (window.showSnackbar) {
  //       window.showSnackbar(`Permissions updated for user: ${data.userId}`, 'info');
  //     }
  //   });

  //   newSocket.on('disconnect', () => {
  //     console.log('🔌 Disconnected from WebSocket server');
  //     // Start fallback polling when WebSocket disconnects
  //     startFallbackPolling(user);
  //   });

  //   newSocket.on('connect_error', (error) => {
  //     console.error('❌ WebSocket connection error:', error?.message || error);
  //     // Start fallback polling on connection error
  //     startFallbackPolling(user);
  //   });
  //   newSocket.on('reconnect_attempt', (n) => console.log('🔁 WS reconnect attempt', n));
  //   newSocket.on('reconnect', (n) => console.log('✅ WS reconnected on attempt', n));
  //   newSocket.on('reconnect_failed', () => console.warn('❗ WS reconnection failed'));

  //   setSocket(newSocket);
  // };

  // Fallback polling mechanism for permission updates
  // const startFallbackPolling = (user) => {
  //   if (!user) return;

  //   console.log('🔄 Starting fallback polling for permission updates');

  //   // Clear any existing polling interval
  //   if (window.permissionPollingInterval) {
  //     clearInterval(window.permissionPollingInterval);
  //   }

  //   // Poll every 30 seconds for permission updates
  //   window.permissionPollingInterval = setInterval(async () => {
  //     try {
  //       const lastCheck = localStorage.getItem('lastPermissionCheck');
  //       const currentTime = Date.now();
        
  //       // Only check if it's been more than 30 seconds since last check
  //       if (!lastCheck || (currentTime - parseInt(lastCheck)) > 30000) {
  //         const hasUpdates = await refetchUserProfile();
          
  //         if (hasUpdates) {
  //           console.log('🔄 Permission updates detected via polling');
  //           if (window.showSnackbar) {
  //             window.showSnackbar('Your permissions have been updated.', 'info');
  //           }
  //         }
          
  //           localStorage.setItem('lastPermissionCheck', currentTime.toString());
  //       }
  //     } catch (error) {
  //       console.error('❌ Error during permission polling:', error);
  //     }
  //   }, 30000); // Check every 30 seconds
  // };

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
            const devUserId = user?.Id || user?.id || user?.userId || (Array.isArray(user?.Username) ? user.Username[0] : user?.Username);
            if (devUserId) devHeaders['X-Dev-User-Id'] = String(devUserId);
            if (user?.Roles) devHeaders['X-Dev-Roles'] = (Array.isArray(user.Roles) ? user.Roles : [user.Roles]).join(',');

            const haRes = await api.get("/api/hierarchical-rbac/my-access", { headers: devHeaders });
            const accessInfo = haRes?.data?.accessInfo;

            // Also load current user's assignment to get workflow roles
            let userWorkflowRoles = [];
            try {
              const userId = user?.Id || user?.id || user?.userId || (Array.isArray(user?.Username) ? user.Username[0] : user?.Username);
              if (userId) {
                const assignmentRes = await api.get(`/api/hierarchical-rbac/assignments/${userId}`, { headers: devHeaders });
                if (assignmentRes?.data?.assignment?.workflowRoles) {
                  userWorkflowRoles = assignmentRes.data.assignment.workflowRoles;
                }
              }
            } catch (assignmentError) {
              console.log('Could not load user assignment for workflow roles:', assignmentError.message);
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
          
          // Store user in localStorage for RegionContext
          localStorage.setItem('currentUser', JSON.stringify(user));
          
          // Initialize WebSocket connection for real-time updates
          // initializeWebSocket(user);
          
          if (res.data.jwtToken) {
            storeToken(res.data.jwtToken);
          }
        } else {
          localStorage.removeItem("token");
          location.href = env("AUTH_CLIENT_URL") + "/login";
        }
      } catch (error) {
        localStorage.removeItem("token");
        console.error("Error fetching user:", error);
        location.href = env("AUTH_CLIENT_URL") + "/login";
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
        console.log('🧹 Cleaning up WebSocket connection');
        socket.disconnect();
      }
    };
  }, [socket]);

  // Convenience: derive workflow roles and assignment
  const hierarchical = currentUser?.hierarchicalAccess || {};
  const workflowRoles = Array.isArray(hierarchical.workflowRoles) ? hierarchical.workflowRoles : [];
  const assignmentLevel = hierarchical.scope || hierarchical.assignmentLevel || 'NONE';

  const hasWorkflowRole = (role) => workflowRoles.includes(role);

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
    jwtToken: getToken(),
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