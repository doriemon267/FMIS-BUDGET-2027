const {
  getRoleQueueStatuses,
  ROLE_QUEUE_STATUSES,
} = require('../../utils/proposalQueueVisibility');

describe('Proposal Operations Hub queue visibility', () => {
  test.each(['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST'])(
    'restricts %s to proposals currently assigned to the analyst queue',
    role => {
      expect(getRoleQueueStatuses(role)).toEqual([
        'FORWARDED_TO_BRD_ANALYST',
        'RETURNED_TO_PLANNING_ANALYST',
      ]);
    }
  );

  test('does not accidentally scope roles that still use the all-proposals view', () => {
    expect(getRoleQueueStatuses('BUDGET MANAGER')).toBeNull();
    expect(getRoleQueueStatuses('SUPER ADMIN')).toBeNull();
  });

  test('returns a copy so callers cannot mutate the shared visibility policy', () => {
    const statuses = getRoleQueueStatuses('BUDGET PLANNING ANALYST');
    statuses.push('FINALIZED');

    expect(ROLE_QUEUE_STATUSES['BUDGET PLANNING ANALYST']).toEqual([
      'FORWARDED_TO_BRD_ANALYST',
      'RETURNED_TO_PLANNING_ANALYST',
    ]);
  });
});
