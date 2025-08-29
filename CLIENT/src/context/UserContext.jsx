import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../config/api";
import api from "../config/api";
import Loading from "../global/components/Loading";
import env from "../utils/env";
import CryptoJS from "crypto-js"; // Import CryptoJS for encryption

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
          hierarchicalAccess: accessInfo,
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
                hierarchicalAccess: accessInfo,
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

  const value = {
    currentUser,
    setCurrentUser: handleSetUserInitialization,
    logout: handleLogout,
    refetchUserProfile,
    isLoading,
    loading: isLoading || isRefetching, // Provide both for compatibility
    jwtToken: getToken(),
  };

  if (isLoading) return <Loading />;

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserProvider;
export const useUser = () => useContext(UserContext);