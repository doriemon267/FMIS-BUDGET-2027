import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { hasPermission } from "../utils/permissions";

const ProtectedRoute = ({ requiredPermissions = [], requiredWorkflowRoles = [], excludeRoles = [], children }) => {
  const { currentUser } = useUser();

  // If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Get hierarchical access info
  const hierarchicalAccess = currentUser.hierarchicalAccess;

  // ✅ Allow users without hierarchical access if they have specific job roles
  const userJobRoles = currentUser.Roles || [];
  const staffRolesWithoutAssignment = ['BUDGET PLANNING ANALYST', 'BUDGET MANAGER', 'BUDGET OFFICER'];
  const hasStaffRole = userJobRoles.some(role => staffRolesWithoutAssignment.includes(role));
  
  // If no hierarchical access and not a staff role, deny access
  // But if they have a staff role, allow them to proceed (they might not have assignment yet)
  if (!hierarchicalAccess && !hasStaffRole) {
    return <Navigate to="/not-authorized" />;
  }

  // ✅ Check role permissions using centralized permission logic

  // Use the hasPermission function from permissions.js for consistency
  const hasRequiredPermissions = requiredPermissions.length === 0 ||
    requiredPermissions.every(permission => {
      const allowed = hasPermission(currentUser, permission);
      return allowed;
    });

  // Check workflow roles - try multiple possible field names
  const userWorkflowRoles = hierarchicalAccess?.workflowRoles ||
                           hierarchicalAccess?.roles ||
                           hierarchicalAccess?.userRoles ||
                           [];
  const normalizedJobRoles = (userJobRoles || []).map((role) => String(role || '').toUpperCase().trim());
  const isBrdCoreRole = normalizedJobRoles.some((role) => [
    'BUDGET PLANNING ANALYST',
    'BUDGET_PLANNING_ANALYST',
    'BUDGET OFFICER',
    'BUDGET_OFFICER',
    'BUDGET MANAGER',
    'BUDGET_MANAGER',
    'OVERALL BUDGET APPROVER',
    'OVERALL_BUDGET_APPROVER',
    'SUPER ADMIN',
    'SUPER_ADMIN',
  ].includes(role));

  // Special handling for FULL access users - ensure they have regionCreator role
  let effectiveWorkflowRoles = [...userWorkflowRoles];
  if (hierarchicalAccess?.scope === 'FULL' && !effectiveWorkflowRoles.includes('regionCreator')) {
    effectiveWorkflowRoles.push('regionCreator');
  }

  // Ensure BRD-level (Budget and Revenue Division) users have access to global pages like Employee List
  if (
    (hierarchicalAccess?.scope === 'BUDGET_AND_REVENUE_DIVISION' || hierarchicalAccess?.assignmentLevel === 'BUDGET_AND_REVENUE_DIVISION') &&
    isBrdCoreRole &&
    !effectiveWorkflowRoles.includes('superAdmin')
  ) {
    effectiveWorkflowRoles.push('superAdmin');
  }

  // ✅ Check job position Roles for budget staff
  const budgetAdminRoles = ['SUPER ADMIN'];
  const budgetStaffRoles = ['BUDGET PLANNING ANALYST', 'BUDGET MANAGER', 'BUDGET OFFICER'];
  
  const isBudgetAdmin = userJobRoles.some(role => budgetAdminRoles.includes(role));
  const isBudgetStaff = userJobRoles.some(role => budgetStaffRoles.includes(role));
  
  // If user is SUPER ADMIN, treat them as having superAdmin workflow role
  if (isBudgetAdmin && !effectiveWorkflowRoles.includes('superAdmin')) {
    effectiveWorkflowRoles.push('superAdmin');
  }
  
  // If user is Budget Staff (PLANNING_ANALYST, MANAGER, OFFICER), add appropriate workflow roles
  if (isBudgetStaff) {
    // Add superAdmin role for Budget Staff to access reports and employee pages
    if (!effectiveWorkflowRoles.includes('superAdmin')) {
      effectiveWorkflowRoles.push('superAdmin');
    }
  }
  
  // Also check for workflow roles from Roles array
  const workflowRolesFromJobRoles = {
    'BUDGET PREPARER': 'preparer',
    'BUDGET REVIEWER': 'reviewer',
    'BUDGET APPROVER': 'approver',
    'OVERALL BUDGET APPROVER': 'overallBudgetApprover'
  };
  
  userJobRoles.forEach(jobRole => {
    const workflowRole = workflowRolesFromJobRoles[jobRole];
    if (workflowRole && !effectiveWorkflowRoles.includes(workflowRole)) {
      effectiveWorkflowRoles.push(workflowRole);
    }
  });
  
  // If user is OVERALL BUDGET APPROVER, also add superAdmin role for access to reports, settings, etc.
  if (userJobRoles.includes('OVERALL BUDGET APPROVER') && !effectiveWorkflowRoles.includes('superAdmin')) {
    effectiveWorkflowRoles.push('superAdmin');
  }

  // Check if user has any excluded roles - if so, deny access
  const hasExcludedRoles = excludeRoles.length > 0 &&
    excludeRoles.some(role => effectiveWorkflowRoles.includes(role));

  const hasRequiredWorkflowRoles = requiredWorkflowRoles.length === 0 ||
    requiredWorkflowRoles.some(role => effectiveWorkflowRoles.includes(role));

  // User must have both required permissions AND required workflow roles, and no excluded roles
  if (!hasRequiredPermissions || !hasRequiredWorkflowRoles || hasExcludedRoles) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
};

export default ProtectedRoute;
