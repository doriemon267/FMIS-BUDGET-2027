import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const ProtectedRoute = ({ requiredPermissions = [], requiredWorkflowRoles = [], children }) => {
  const { currentUser } = useUser();

  // If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Get hierarchical access info
  const hierarchicalAccess = currentUser.hierarchicalAccess;

  // If no hierarchical access (user not properly configured), deny access
  if (!hierarchicalAccess) {
    return <Navigate to="/not-authorized" />;
  }

  // Check role permissions
  const userPermissions = hierarchicalAccess.rolePermissions || {};
  console.log('🔍 ProtectedRoute Debug:', {
    requiredPermissions,
    userPermissions,
    hierarchicalAccess: {
      scope: hierarchicalAccess.scope,
      workflowRoles: hierarchicalAccess.workflowRoles
    }
  });

  const hasRequiredPermissions = requiredPermissions.length === 0 ||
    requiredPermissions.every(permission => {
      // If permission is explicitly set to false, deny access
      if (userPermissions[permission] === false) {
        console.log(`❌ Permission ${permission} is explicitly set to false`);
        return false;
      }
      // If permission is true or undefined (default), allow access
      const hasPermission = userPermissions[permission] === true || userPermissions[permission] === undefined;
      console.log(`✅ Permission ${permission}: ${hasPermission ? 'ALLOWED' : 'DENIED'} (value: ${userPermissions[permission]})`);
      return hasPermission;
    });

  // Check workflow roles
  const userWorkflowRoles = hierarchicalAccess.workflowRoles || [];
  const hasRequiredWorkflowRoles = requiredWorkflowRoles.length === 0 ||
    requiredWorkflowRoles.some(role => userWorkflowRoles.includes(role));

  // User must have both required permissions AND required workflow roles
  if (!hasRequiredPermissions || !hasRequiredWorkflowRoles) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
};

export default ProtectedRoute;