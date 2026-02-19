import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "../config/api";
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
        const res = await authApi.get("/get-user");
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
