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

const normalizeRouteRole = (role) =>
  String(role || "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

const getRoleAliases = (roleId) => ROLE_ALIASES[roleId] || [roleId];

const getUserRouteRoles = (user) => {
  const rawRoles = [
    ...(user?.Roles || []),
    ...(user?.workflowRoles || []),
    ...(user?.hierarchicalAccess?.workflowRoles || []),
    ...(user?.hierarchicalAccess?.roles || []),
    ...(user?.hierarchicalAccess?.userRoles || []),
  ];
  const normalizedRoles = new Set(
    rawRoles.map(normalizeRouteRole).filter(Boolean)
  );

  Object.entries(ROLE_ALIASES).forEach(([roleId, aliases]) => {
    if (
      aliases.some((alias) =>
        normalizedRoles.has(normalizeRouteRole(alias))
      )
    ) {
      normalizedRoles.add(normalizeRouteRole(roleId));
      aliases.forEach((alias) => normalizedRoles.add(normalizeRouteRole(alias)));
    }
  });

  return normalizedRoles;
};

const isFailClosedRoute = (path) =>
  FAIL_CLOSED_ROUTE_PATHS.has(String(path || "").trim());

module.exports = {
  getRoleAliases,
  getUserRouteRoles,
  isFailClosedRoute,
  normalizeRouteRole,
};

