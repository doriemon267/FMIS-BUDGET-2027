import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { hasPermission } from "../utils/permissions";
import { useRoutePermissions } from "../context/RoutePermissionContext";

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

  // ── Permission check ──────────────────────────────────────────────────────
  const hasRequiredPermissions =
    requiredPermissions.length === 0 ||
    requiredPermissions.every((permission) => hasPermission(currentUser, permission));

  // ── Workflow role resolution ───────────────────────────────────────────────
  const userWorkflowRoles =
    hierarchicalAccess?.workflowRoles ||
    hierarchicalAccess?.roles ||
    hierarchicalAccess?.userRoles ||
    [];

  const normalizedJobRoles = (userJobRoles || []).map((role) =>
    String(role || "").toUpperCase().trim()
  );

  const isBrdCoreRole = normalizedJobRoles.some((role) =>
    [
      "BUDGET PLANNING ANALYST",
      "BUDGET_PLANNING_ANALYST",
      "BUDGET OFFICER",
      "BUDGET_OFFICER",
      "BUDGET MANAGER",
      "BUDGET_MANAGER",
      "OVERALL BUDGET APPROVER",
      "OVERALL_BUDGET_APPROVER",
      "SUPER ADMIN",
      "SUPER_ADMIN",
    ].includes(role)
  );

  // Special handling for FULL access users – ensure they have regionCreator role
  let effectiveWorkflowRoles = [...userWorkflowRoles];
  if (
    hierarchicalAccess?.scope === "FULL" &&
    !effectiveWorkflowRoles.includes("regionCreator")
  ) {
    effectiveWorkflowRoles.push("regionCreator");
  }

  // Ensure BRD-level users have access to global pages like Employee List
  if (
    (hierarchicalAccess?.scope === "BUDGET_AND_REVENUE_DIVISION" ||
      hierarchicalAccess?.assignmentLevel === "BUDGET_AND_REVENUE_DIVISION") &&
    isBrdCoreRole &&
    !effectiveWorkflowRoles.includes("superAdmin")
  ) {
    effectiveWorkflowRoles.push("superAdmin");
  }

  // ── Job-role → workflow-role mapping ──────────────────────────────────────
  const isBudgetAdmin = userJobRoles.some((role) => role === "SUPER_ADMIN");
  const isBudgetStaff = userJobRoles.some((role) =>
    ["BUDGET_PLANNING_ANALYST", "BUDGET_MANAGER", "BUDGET_OFFICER"].includes(role)
  );

  if (isBudgetAdmin && !effectiveWorkflowRoles.includes("superAdmin")) {
    effectiveWorkflowRoles.push("superAdmin");
  }
  if (isBudgetStaff && !effectiveWorkflowRoles.includes("superAdmin")) {
    effectiveWorkflowRoles.push("superAdmin");
  }

  const workflowRolesFromJobRoles = {
    BUDGET_PREPARER: "preparer",
    "BUDGET PREPARER": "preparer",
    BUDGET_REVIEWER: "reviewer",
    "BUDGET REVIEWER": "reviewer",
    BUDGET_APPROVER: "approver",
    "BUDGET APPROVER": "approver",
    OVERALL_BUDGET_APPROVER: "overallBudgetApprover",
  };

  userJobRoles.forEach((jobRole) => {
    const workflowRole = workflowRolesFromJobRoles[jobRole];
    if (workflowRole && !effectiveWorkflowRoles.includes(workflowRole)) {
      effectiveWorkflowRoles.push(workflowRole);
    }
  });

  if (
    userJobRoles.includes("OVERALL_BUDGET_APPROVER") &&
    !effectiveWorkflowRoles.includes("superAdmin")
  ) {
    effectiveWorkflowRoles.push("superAdmin");
  }

  // ── Final access decision ─────────────────────────────────────────────────
  const hasExcludedRoles =
    excludeRoles.length > 0 &&
    !effectiveWorkflowRoles.includes("superAdmin") &&
    excludeRoles.some((role) => effectiveWorkflowRoles.includes(role));

  const hasRequiredWorkflowRoles =
    requiredWorkflowRoles.length === 0 ||
    requiredWorkflowRoles.some((role) => effectiveWorkflowRoles.includes(role));

  if (!hasRequiredPermissions || !hasRequiredWorkflowRoles || hasExcludedRoles) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
};

export default ProtectedRoute;
