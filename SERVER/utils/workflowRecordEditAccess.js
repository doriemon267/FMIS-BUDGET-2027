const normalize = (value) =>
  String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const STATUS_EDIT_ROLES = {
  FORWARDED_TO_REVIEWER: ["BUDGET_REVIEWER"],
  UNDER_REVIEW_BY_REVIEWER: ["BUDGET_REVIEWER"],
  FORWARDED_TO_APPROVER: ["BUDGET_APPROVER", "APPROVER"],
  FORWARDED_TO_BUDGET_PLANNING_ANALYST: ["BUDGET_PLANNING_ANALYST"],
  APPROVER_APPROVED: ["BUDGET_PLANNING_ANALYST"],
  FORWARDED_TO_BUDGET_OFFICER: ["BUDGET_OFFICER"],
  FORWARDED_TO_OFFICER: ["BUDGET_OFFICER"],
  UNDER_REVIEW_BY_OFFICER: ["BUDGET_OFFICER"],
  FORWARDED_TO_OVERALL_BUDGET_APPROVER: [
    "BUDGET_MANAGER",
    "OVERALL_BUDGET_APPROVER",
  ],
  UNDER_REVIEW_BY_MANAGER: ["BUDGET_MANAGER", "OVERALL_BUDGET_APPROVER"],
};

const isRecordLockedForUser = (status, lockedStatuses, roles = []) => {
  if (!lockedStatuses.includes(status)) return false;

  const normalizedStatus = normalize(status);
  const normalizedRoles = new Set(roles.map(normalize));

  if (
    normalizedStatus !== "FINALIZED" &&
    (normalizedRoles.has("SUPER_ADMIN") || normalizedRoles.has("SUPERADMIN"))
  ) {
    return false;
  }

  return !(STATUS_EDIT_ROLES[normalizedStatus] || []).some((role) =>
    normalizedRoles.has(role)
  );
};

module.exports = { isRecordLockedForUser };
