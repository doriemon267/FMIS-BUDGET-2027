const { shouldShowManagerActions, normalizeRoleValue } = require('../../CLIENT/src/components/workflow/workflow-utils.cjs');

describe('workflow-utils shouldShowManagerActions', () => {
  test('blocks manager actions when user is only PREPARER', () => {
    const result = shouldShowManagerActions({ status: 'Forwarded to Manager', normalizedRoles: ['BUDGET PREPARER'] });
    expect(result).toBe(false);
  });

  test('blocks manager actions when returned to PREPARER', () => {
    const result = shouldShowManagerActions({ status: 'Returned', currentAssigneeRole: 'BUDGET PREPARER', normalizedRoles: ['BUDGET MANAGER'] });
    expect(result).toBe(false);
  });

  test('allows manager actions when returned to BUDGET MANAGER', () => {
    const result = shouldShowManagerActions({ status: 'Returned', currentAssigneeRole: 'BUDGET MANAGER', normalizedRoles: ['BUDGET MANAGER'] });
    expect(result).toBe(true);
  });

  test('allows manager actions when status is Forwarded to Manager', () => {
    const result = shouldShowManagerActions({ status: 'Forwarded to Manager', normalizedRoles: ['BUDGET MANAGER'] });
    expect(result).toBe(true);
  });
});

describe('workflow-utils normalizeRoleValue', () => {
  test('normalizes synonyms to canonical form', () => {
    expect(normalizeRoleValue('overAll_budget_approver')).toBe('BUDGET MANAGER');
    expect(normalizeRoleValue('Analyst')).toBe('BUDGET PREPARER');
  });
});
