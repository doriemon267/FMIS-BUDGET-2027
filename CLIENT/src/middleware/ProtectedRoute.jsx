import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { hasPermission } from "../utils/permissions";

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

  // ✅ Check role permissions using centralized permission logic
  console.log('🔍 ProtectedRoute Debug:', {
    requiredPermissions,
    requiredWorkflowRoles,
    userRoles: currentUser.Roles,
    hierarchicalAccess: hierarchicalAccess,
    allFields: Object.keys(hierarchicalAccess)
  });

  // Use the hasPermission function from permissions.js for consistency
  const hasRequiredPermissions = requiredPermissions.length === 0 ||
    requiredPermissions.every(permission => {
      const allowed = hasPermission(currentUser, permission);
      console.log(`${allowed ? '✅' : '❌'} Permission ${permission}: ${allowed ? 'ALLOWED' : 'DENIED'}`);
      return allowed;
    });

  // Check workflow roles - try multiple possible field names
  const userWorkflowRoles = hierarchicalAccess.workflowRoles ||
                           hierarchicalAccess.roles ||
                           hierarchicalAccess.userRoles ||
                           [];

  // Special handling for FULL access users - ensure they have regionCreator role
  let effectiveWorkflowRoles = [...userWorkflowRoles];
  if (hierarchicalAccess.scope === 'FULL' && !effectiveWorkflowRoles.includes('regionCreator')) {
    console.log('🔧 Adding regionCreator role for FULL access user');
    effectiveWorkflowRoles.push('regionCreator');
  }

  // ✅ Check job position Roles for budget staff (SUPER ADMIN, BUDGET ADMIN, BUDGET STAFF)
  const userJobRoles = currentUser.Roles || [];
  const budgetAdminRoles = ['SUPER ADMIN', 'SUPER_ADMIN', 'BUDGET ADMIN'];
  const budgetStaffRoles = ['BUDGET ANALYST', 'BUDGET COORDINATOR', 'BUDGET MANAGER', 'BUDGET OFFICER'];
  
  const isBudgetAdmin = userJobRoles.some(role => budgetAdminRoles.includes(role));
  const isBudgetStaff = userJobRoles.some(role => budgetStaffRoles.includes(role));
  
  // If user is SUPER ADMIN or BUDGET ADMIN, treat them as having superAdmin workflow role
  if (isBudgetAdmin && !effectiveWorkflowRoles.includes('superAdmin')) {
    console.log('🔧 Adding superAdmin workflow role for BUDGET ADMIN/SUPER ADMIN');
    effectiveWorkflowRoles.push('superAdmin');
  }
  
  // If user is Budget Staff (ANALYST, COORDINATOR, MANAGER, OFFICER), add appropriate workflow roles
  if (isBudgetStaff) {
    console.log('🔧 Adding workflow roles for Budget Staff');
    // Add superAdmin role for Budget Staff to access reports and employee pages
    if (!effectiveWorkflowRoles.includes('superAdmin')) {
      effectiveWorkflowRoles.push('superAdmin');
    }
  }

  const hasRequiredWorkflowRoles = requiredWorkflowRoles.length === 0 ||
    requiredWorkflowRoles.some(role => effectiveWorkflowRoles.includes(role));

  console.log('🔍 Workflow Roles Check:', {
    requiredWorkflowRoles,
    userWorkflowRoles,
    effectiveWorkflowRoles,
    hasRequiredWorkflowRoles,
    missingRoles: requiredWorkflowRoles.filter(role => !effectiveWorkflowRoles.includes(role)),
    isFullAccess: hierarchicalAccess.scope === 'FULL'
  });

  // User must have both required permissions AND required workflow roles
  if (!hasRequiredPermissions || !hasRequiredWorkflowRoles) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
};

export default ProtectedRoute;