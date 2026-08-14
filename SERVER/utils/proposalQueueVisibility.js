const ROLE_QUEUE_STATUSES = Object.freeze({
  'BUDGET PLANNING ANALYST': Object.freeze([
    'FORWARDED_TO_BRD_ANALYST',
    'RETURNED_TO_PLANNING_ANALYST',
  ]),
});

const normalizeWorkflowRole = role =>
  String(role || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

const getRoleQueueStatuses = role => {
  const statuses = ROLE_QUEUE_STATUSES[normalizeWorkflowRole(role)];
  return statuses ? [...statuses] : null;
};

module.exports = {
  getRoleQueueStatuses,
  ROLE_QUEUE_STATUSES,
};
