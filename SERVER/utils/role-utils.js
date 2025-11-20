function normalizeRoleValue(role) {
  if (!role || typeof role !== 'string') return '';
  const r = String(role).trim().toUpperCase().replace(/\s+/g, '_');
  // Map synonyms to canonical forms
  const map = {
    'OVERALL_BUDGET_APPROVER': 'BUDGET_MANAGER',
    'OVERALL BUDGET APPROVER': 'BUDGET_MANAGER',
    'BUDGET_MANAGER': 'BUDGET_MANAGER',
    'MANAGER_APPROVER': 'BUDGET_MANAGER',
    'BUDGET_OFFICER': 'BUDGET_OFFICER',
    'OFFICE_FINAL_VERIFIER': 'BUDGET_OFFICER',
    'BUDGET_APPROVER': 'BUDGET_APPROVER',
    'BUDGET_REVIEWER': 'BUDGET_REVIEWER',
    'BUDGET_PREPARER': 'BUDGET_PREPARER',
    'BUDGET_PLANNING_ANALYST': 'BUDGET_PLANNING_ANALYST',
    'BUDGET_ADMIN': 'BUDGET_ADMIN',
  };
  return map[r] || r;
}

module.exports = { normalizeRoleValue };
