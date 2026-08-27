import { hasPermission } from "./permissions";

const FAIL_CLOSED_ROUTE_PATHS = new Set([
  "/settings",
  "/fysettings",
  "/compensation-management",
  "/rata",
  "/categories",
  "/income-management",
  "/salary-management",
  "/salary-table",
  "/employee-salary-table",
  "/cos-salary-table",
  "/position-titles",
  "/grouped-income-categories",
  "/setup/organization",
  "/hierarchical-user-assignments",
  "/route-permissions",
  "/user-activity-logs",
  "/audit-logs",
  "/bulk-upload-management",
  "/database-backup",
  "/corporate-income-upload",
  "/mooe-upload",
]);

const ROLE_ALIASES = {
  SUPER_ADMIN: ["SUPER_ADMIN", "SUPER ADMIN", "SUPERADMIN", "superAdmin", "admin"],
  BUDGET_PREPARER: ["BUDGET_PREPARER", "BUDGET PREPARER", "preparer"],
  BUDGET_REVIEWER: ["BUDGET_REVIEWER", "BUDGET REVIEWER", "reviewer"],
  BUDGET_APPROVER: ["BUDGET_APPROVER", "BUDGET APPROVER", "approver"],
  BUDGET_PLANNING_ANALYST: [
    "BUDGET_PLANNING_ANALYST",
    "BUDGET PLANNING ANALYST",
    "budgetAnalyst",
  ],
  BUDGET_OFFICER: ["BUDGET_OFFICER", "BUDGET OFFICER", "budgetOfficer"],
  BUDGET_MANAGER: [
    "BUDGET_MANAGER",
    "BUDGET MANAGER",
    "budgetManager",
    "OVERALL_BUDGET_APPROVER",
    "OVERALL BUDGET APPROVER",
    "overallBudgetApprover",
  ],
};

export const normalizeRouteRole = (role) =>
  String(role || "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

export const getRoleOptionAliases = (roleId) =>
  ROLE_ALIASES[roleId] || [roleId];

export const isRoleOptionAssigned = (assignedRoles, roleId) => {
  const normalizedAssigned = new Set(
    (assignedRoles || []).map(normalizeRouteRole).filter(Boolean)
  );

  return getRoleOptionAliases(roleId).some((alias) =>
    normalizedAssigned.has(normalizeRouteRole(alias))
  );
};

export const removeRoleOptionAliases = (assignedRoles, roleId) => {
  const aliases = new Set(
    getRoleOptionAliases(roleId).map(normalizeRouteRole).filter(Boolean)
  );

  return (assignedRoles || []).filter(
    (role) => !aliases.has(normalizeRouteRole(role))
  );
};

export const isFailClosedRoute = (path) =>
  FAIL_CLOSED_ROUTE_PATHS.has(String(path || "").trim());

const getUserRouteRoles = (currentUser, additionalRoles = []) => {
  const jobRoles = currentUser?.Roles || [];
  const workflowRoles = [
    ...(currentUser?.workflowRoles || []),
    ...(currentUser?.hierarchicalAccess?.workflowRoles || []),
    ...(currentUser?.hierarchicalAccess?.roles || []),
    ...(currentUser?.hierarchicalAccess?.userRoles || []),
    ...additionalRoles,
  ];

  const normalizedRoles = new Set(
    [...jobRoles, ...workflowRoles].map(normalizeRouteRole).filter(Boolean)
  );

  Object.entries(ROLE_ALIASES).forEach(([roleId, aliases]) => {
    const hasAlias = aliases.some((alias) =>
      normalizedRoles.has(normalizeRouteRole(alias))
    );
    if (hasAlias) {
      aliases.forEach((alias) => normalizedRoles.add(normalizeRouteRole(alias)));
      normalizedRoles.add(normalizeRouteRole(roleId));
    }
  });

  return normalizedRoles;
};

export const canAccessRoutePermission = ({
  currentUser,
  path,
  routePermission,
  fallbackAllow = false,
  isLoading = false,
  additionalRoles = [],
}) => {
  if (!currentUser || isLoading) return false;
  if (!routePermission) return Boolean(fallbackAllow);
  if (routePermission.isActive === false) return Boolean(fallbackAllow);

  const userRoles = getUserRouteRoles(currentUser, additionalRoles);
  const isSuperAdmin = userRoles.has(normalizeRouteRole("SUPER_ADMIN"));
  if (isSuperAdmin) return true;

  const excludedRoles = routePermission.excludeRoles || [];
  if (
    excludedRoles.some((role) =>
      userRoles.has(normalizeRouteRole(role))
    )
  ) {
    return false;
  }

  const requiredPermissions = routePermission.requiredPermissions || [];
  if (
    requiredPermissions.length > 0 &&
    !requiredPermissions.every((permission) =>
      hasPermission(currentUser, permission)
    )
  ) {
    return false;
  }

  const requiredRoles = routePermission.requiredWorkflowRoles || [];
  if (requiredRoles.length === 0) {
    return !isFailClosedRoute(path || routePermission.path);
  }

  return requiredRoles.some((role) =>
    userRoles.has(normalizeRouteRole(role))
  );
};

