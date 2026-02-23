/**
 * Centralized role and permission configuration
 * Use this instead of hardcoding role strings across the app
 */

/** Job roles (from FMIS / user.Roles) */
export const JOB_ROLES = {
  SUPER_ADMIN: "SUPER ADMIN",
  SUPER_ADMIN_ALT: "SUPER_ADMIN",
  BUDGET_MANAGER: "BUDGET MANAGER",
  BUDGET_OFFICER: "BUDGET OFFICER",
  BUDGET_PLANNING_ANALYST: "BUDGET PLANNING ANALYST",
  BUDGET_REVIEWER: "BUDGET REVIEWER",
  BUDGET_APPROVER: "BUDGET APPROVER",
  BUDGET_PREPARER: "BUDGET PREPARER",
  BUDGET_COORDINATOR: "BUDGET COORDINATOR",
  OVERALL_BUDGET_APPROVER: "OVERALL BUDGET APPROVER",
  BUDGET_ADMIN: "BUDGET_ADMIN",
  REVIEWER: "REVIEWER",
  APPROVER: "APPROVER",
};

/** Workflow roles (from hierarchical assignment) */
export const WORKFLOW_ROLES = {
  SUPER_ADMIN: "superAdmin",
  REGION_CREATOR: "regionCreator",
  DIVISION_CREATOR: "divisionCreator",
  DEPARTMENT_CREATOR: "departmentCreator",
  OFFICE_CREATOR: "officeCreator",
  DIVISION_REVIEWER: "divisionReviewer",
  DIVISION_APPROVER: "divisionApprover",
  OFFICE_APPROVER: "officeApprover",
  BUDGET_ANALYST: "budgetAnalyst",
  PREPARER: "preparer",
  REVIEWER: "reviewer",
  APPROVER: "approver",
  OVERALL_BUDGET_APPROVER: "overallBudgetApprover",
};

/** Budget roles that grant access to the Budget Module */
export const BUDGET_MODULE_ROLES = [
  JOB_ROLES.SUPER_ADMIN,
  JOB_ROLES.SUPER_ADMIN_ALT,
  "SUPERADMIN",
  JOB_ROLES.BUDGET_COORDINATOR,
  "BUDGET_COORDINATOR",
  JOB_ROLES.BUDGET_MANAGER,
  "BUDGET_MANAGER",
  JOB_ROLES.BUDGET_OFFICER,
  "BUDGET_OFFICER",
  JOB_ROLES.BUDGET_PREPARER,
  "BUDGET_PREPARER",
  JOB_ROLES.BUDGET_REVIEWER,
  "BUDGET_REVIEWER",
  JOB_ROLES.BUDGET_APPROVER,
  "BUDGET_APPROVER",
  JOB_ROLES.BUDGET_PLANNING_ANALYST,
  "BUDGET_PLANNING_ANALYST",
  JOB_ROLES.OVERALL_BUDGET_APPROVER,
  "OVERALL_BUDGET_APPROVER",
  JOB_ROLES.BUDGET_ADMIN,
  JOB_ROLES.REVIEWER,
  JOB_ROLES.APPROVER,
];

/** Approver-style roles (for menu visibility - division/office/budget approver, not BUDGET MANAGER) */
export const APPROVER_JOB_ROLES = [
  "APPROVER",
  "DIVISION APPROVER",
  "OFFICE APPROVER",
  "BUDGET APPROVER",
];

export const APPROVER_WORKFLOW_ROLES = [
  "divisionapprover",
  "officeapprover",
  "approver",
];

/** Staff roles that can access reports without hierarchical assignment */
export const BUDGET_STAFF_ROLES = [
  JOB_ROLES.BUDGET_PLANNING_ANALYST,
  JOB_ROLES.BUDGET_MANAGER,
  JOB_ROLES.BUDGET_OFFICER,
];

/** Roles that can see BRD-only menus (NEP Ceiling, Tier, BRD Consolidation) */
export const BRD_LEVEL_ROLES = [
  ...BUDGET_STAFF_ROLES,
  JOB_ROLES.SUPER_ADMIN,
  JOB_ROLES.SUPER_ADMIN_ALT,
];

export const ROLE_SCOPES = {
  FULL: "FULL",
  BUDGET_AND_REVENUE_DIVISION: "BUDGET_AND_REVENUE_DIVISION",
};

/** Normalize role string for comparison (uppercase, underscores) */
export const normalizeRole = (r) =>
  String(r || "").toUpperCase().replace(/\s/g, "_").trim();

/** Check if user has budget module access (budget role or workflow assignment) */
export function hasBudgetModuleAccess(currentUser) {
  if (!currentUser) return false;
  const roles = currentUser.Roles || [];
  const hierarchicalAccess = currentUser.hierarchicalAccess;
  const hasWorkflowAssignment =
    (hierarchicalAccess?.workflowRoles?.length ?? 0) > 0 ||
    (hierarchicalAccess?.roles?.length ?? 0) > 0;
  const isSuperAdmin = roles.some((r) =>
    [JOB_ROLES.SUPER_ADMIN, JOB_ROLES.SUPER_ADMIN_ALT, "SUPERADMIN"].includes(normalizeRole(r))
  );
  const hasBudgetRole = roles.some((r) =>
    BUDGET_MODULE_ROLES.some((br) => normalizeRole(r) === normalizeRole(br))
  );
  return isSuperAdmin || hasBudgetRole || hasWorkflowAssignment;
}

/** Check if user has any approver-style role */
export function hasApproverRole(roles = [], workflowRoles = []) {
  const wf = workflowRoles.map((r) => String(r).toLowerCase());
  const hasWorkflowApprover = APPROVER_WORKFLOW_ROLES.some((ar) =>
    wf.some((r) => r.includes(ar.toLowerCase()))
  );
  const hasPrimaryApprover = roles.some((r) =>
    APPROVER_JOB_ROLES.some((ar) =>
      String(r).toUpperCase().includes(ar.toUpperCase())
    )
  );
  return hasWorkflowApprover || hasPrimaryApprover;
}

/** Check if user has any BRD-level role (job roles) */
export function hasBRDLevelJobRole(roles = []) {
  return roles.some((r) =>
    BRD_LEVEL_ROLES.some((br) => normalizeRole(r) === normalizeRole(br))
  );
}

/** Check if user is BRD-level (hierarchical scope or job role) */
export function isBRDLevelUser(currentUser) {
  if (!currentUser) return false;
  const scope = currentUser.hierarchicalAccess?.scope;
  const assignmentLevel = currentUser.hierarchicalAccess?.assignmentLevel;
  const roles = (currentUser.Roles || []).map(String);
  return (
    scope === ROLE_SCOPES.BUDGET_AND_REVENUE_DIVISION ||
    assignmentLevel === ROLE_SCOPES.BUDGET_AND_REVENUE_DIVISION ||
    roles.some((r) => String(r).toUpperCase().includes("BRD")) ||
    hasBRDLevelJobRole(roles)
  );
}
