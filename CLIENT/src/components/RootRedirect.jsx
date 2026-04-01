import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api, { setAuthToken } from "../config/api";
import Loading from "../global/components/Loading";
import HomePage from "../pages/HomePage";

/**
 * Root route ("/") handler: kapag naka-login na, redirect diretso sa /dashboard;
 * kung hindi pa naka-login, ipakita ang HomePage (landing page).
 */
const RootRedirect = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Handle token from SSO redirect (?token= or #access_token=)
        const params = new URLSearchParams(window.location.search || "");
        const hash = (window.location.hash || "").replace(/^#/, "");
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
          const newUrl = params.toString() ? `/?${params.toString()}` : "/";
          window.history.replaceState({}, "", newUrl);
        }
        // Use same-origin budget server (supports cookie + Bearer token)
        // authApi (fmis.nia.gov.ph) is cross-origin — cookie won't be sent due to SameSite
        const res = await api.get("/api/get-user");
        setIsLoggedIn(!!res?.data?.user);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, []);

  if (isChecking) return <Loading />;
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
};

export default RootRedirect;
