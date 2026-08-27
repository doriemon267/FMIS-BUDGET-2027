export const TIER_OPERATION_BUDGET_TYPE = "NEP";

const normalizeTierRole = (role) =>
  String(role || "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

const getTierUserRoles = (currentUser) =>
  new Set(
    [
      ...(currentUser?.Roles || []),
      ...(currentUser?.workflowRoles || []),
      ...(currentUser?.hierarchicalAccess?.workflowRoles || []),
      ...(currentUser?.hierarchicalAccess?.roles || []),
    ]
      .map(normalizeTierRole)
      .filter(Boolean)
  );

export const isTierOperationBudgetType = (budgetType) =>
  String(budgetType || "").trim().toUpperCase() ===
  TIER_OPERATION_BUDGET_TYPE;

export const getTierAccessProfile = (currentUser, activeBudgetType) => {
  const roles = getTierUserRoles(currentUser);
  const isSuperAdmin = roles.has("SUPERADMIN") || roles.has("ADMIN");
  const isBudgetPlanningAnalyst =
    roles.has("BUDGETPLANNINGANALYST") || roles.has("BUDGETANALYST");
  const isBudgetOfficer = roles.has("BUDGETOFFICER");
  const isBudgetManager =
    roles.has("BUDGETMANAGER") || roles.has("OVERALLBUDGETAPPROVER");
  const isBudgetPreparer =
    roles.has("BUDGETPREPARER") || roles.has("PREPARER");
  const isBudgetReviewer =
    roles.has("BUDGETREVIEWER") || roles.has("REVIEWER");
  const isBudgetApprover =
    roles.has("BUDGETAPPROVER") || roles.has("APPROVER");
  const isNepPhase = isTierOperationBudgetType(activeBudgetType);

  const hasBrdAccess =
    isSuperAdmin ||
    isBudgetPlanningAnalyst ||
    isBudgetOfficer ||
    isBudgetManager;
  const hasProposalWorkflowAccess =
    isBudgetPreparer || isBudgetReviewer || isBudgetApprover;

  return {
    canAccess: hasBrdAccess || (hasProposalWorkflowAccess && isNepPhase),
    isReadOnly:
      isBudgetReviewer ||
      isBudgetApprover ||
      isBudgetOfficer ||
      isBudgetManager,
    isNepPhase,
    isBudgetPreparer,
    isBudgetReviewer,
    isBudgetApprover,
  };
};

export const canAccessTierPage = (currentUser, activeBudgetType) =>
  getTierAccessProfile(currentUser, activeBudgetType).canAccess;

