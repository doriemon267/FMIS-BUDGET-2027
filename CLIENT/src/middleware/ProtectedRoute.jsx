import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const SYSTEM_ALLOWED_ROLES = [
  "SUPER ADMIN",
  "BUDGET ADMIN",
  "BUDGET ANALYST",
  "BUDGET MANAGER",
];

const ProtectedRoute = ({ allowedRoles = SYSTEM_ALLOWED_ROLES, children }) => {
  const { currentUser } = useUser();

  const roles = Array.isArray(currentUser?.Roles)
    ? currentUser.Roles
    : currentUser?.Roles
    ? [currentUser.Roles]
    : [];

  // Block explicit USER role or if user has no permitted system roles
  const isUserRoleOnly = roles.length === 1 && roles[0] === "USER";
  const hasAnySystemRole = roles.some((r) => SYSTEM_ALLOWED_ROLES.includes(r));
  if (isUserRoleOnly || !hasAnySystemRole) {
    return <Navigate to="/not-authorized" />;
  }

  // Must be in both system-allowed set and the route's allowedRoles
  const intersectionAllowed = roles.some(
    (r) => SYSTEM_ALLOWED_ROLES.includes(r) && allowedRoles.includes(r)
  );

  return intersectionAllowed ? children : <Navigate to="/not-authorized" />;
};

export default ProtectedRoute;