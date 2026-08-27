import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useRoutePermissions } from "../context/RoutePermissionContext";
import { canAccessRoutePermission } from "../utils/routePermissionAccess";

/**
 * ProtectedRoute
 *
 * Props:
 *   routeKey              – the frontend route path (e.g. "/consolidated-reports").
 *                           When supplied, the dynamic DB config overrides prop values.
 *   requiredPermissions   – fallback array of permission strings
 *   requiredWorkflowRoles – fallback array of workflow role strings (user needs ≥ 1)
 *   excludeRoles          – fallback array of roles to deny even if other checks pass
 */
const ProtectedRoute = ({
  routeKey,
  requiredPermissions: propPermissions = [],
  requiredWorkflowRoles: propWorkflowRoles = [],
  excludeRoles: propExcludeRoles = [],
  children,
}) => {
  const { currentUser } = useUser();
  const { getRoutePermission, isLoading: permissionsLoading } = useRoutePermissions();

  // If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // ── Resolve effective permission config (dynamic DB overrides props) ──────
  const dynamicConfig = routeKey ? getRoutePermission(routeKey) : null;

  // While route permissions are still loading and we have a routeKey,
  // render nothing to avoid a premature redirect
  if (routeKey && permissionsLoading) {
    return null;
  }

  const requiredPermissions =
    dynamicConfig ? (dynamicConfig.requiredPermissions ?? []) : propPermissions;
  const requiredWorkflowRoles =
    dynamicConfig ? (dynamicConfig.requiredWorkflowRoles ?? []) : propWorkflowRoles;
  const excludeRoles =
    dynamicConfig ? (dynamicConfig.excludeRoles ?? []) : propExcludeRoles;

  // ── Hierarchical access check ─────────────────────────────────────────────
  const hierarchicalAccess = currentUser.hierarchicalAccess;

  const userJobRoles = currentUser.Roles || [];
  const staffRolesWithoutAssignment = [
    "BUDGET_PLANNING_ANALYST",
    "BUDGET_MANAGER",
    "BUDGET_OFFICER",
  ];
  const hasStaffRole = userJobRoles.some((role) =>
    staffRolesWithoutAssignment.includes(role)
  );

  // If no hierarchical access and not a staff role, deny access
  if (!hierarchicalAccess && !hasStaffRole) {
    return <Navigate to="/not-authorized" />;
  }

  // ── Workflow role resolution ───────────────────────────────────────────────
  const userWorkflowRoles =
    hierarchicalAccess?.workflowRoles ||
    hierarchicalAccess?.roles ||
    hierarchicalAccess?.userRoles ||
    [];

  // Special handling for FULL access users – ensure they have regionCreator role
  let effectiveWorkflowRoles = [...userWorkflowRoles];
  if (
    hierarchicalAccess?.scope === "FULL" &&
    !effectiveWorkflowRoles.includes("regionCreator")
  ) {
    effectiveWorkflowRoles.push("regionCreator");
  }

  // ── Job-role → workflow-role mapping ──────────────────────────────────────
  const workflowRolesFromJobRoles = {
    SUPER_ADMIN: "superAdmin",
    "SUPER ADMIN": "superAdmin",
    BUDGET_PREPARER: "preparer",
    "BUDGET PREPARER": "preparer",
    BUDGET_REVIEWER: "reviewer",
    "BUDGET REVIEWER": "reviewer",
    BUDGET_APPROVER: "approver",
    "BUDGET APPROVER": "approver",
    OVERALL_BUDGET_APPROVER: "overallBudgetApprover",
    "OVERALL BUDGET APPROVER": "overallBudgetApprover",
    BUDGET_PLANNING_ANALYST: "budgetAnalyst",
    "BUDGET PLANNING ANALYST": "budgetAnalyst",
    BUDGET_OFFICER: "budgetOfficer",
    "BUDGET OFFICER": "budgetOfficer",
    BUDGET_MANAGER: "budgetManager",
    "BUDGET MANAGER": "budgetManager",
  };

  userJobRoles.forEach((jobRole) => {
    const workflowRole = workflowRolesFromJobRoles[jobRole];
    if (workflowRole && !effectiveWorkflowRoles.includes(workflowRole)) {
      effectiveWorkflowRoles.push(workflowRole);
    }
  });

  // ── Final access decision ─────────────────────────────────────────────────
  const hasRouteAccess = canAccessRoutePermission({
    currentUser,
    path: routeKey,
    routePermission: {
      path: routeKey,
      isActive: true,
      requiredPermissions,
      requiredWorkflowRoles,
      excludeRoles,
    },
    additionalRoles: effectiveWorkflowRoles,
  });

  if (!hasRouteAccess) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
};

export default ProtectedRoute;
