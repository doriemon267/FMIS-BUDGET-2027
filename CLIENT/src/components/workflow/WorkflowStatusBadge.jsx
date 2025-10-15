import React from "react";

// Workflow Status Badge: Displays status, step indicator, and assignment info
const WorkflowStatusBadge = ({ status, step, assignee, pendingRoles = [], className = "" }) => {
  // Normalize incoming status with simple synonyms
  const raw = String(status || 'Draft');
  const u = raw.toUpperCase();
  const normalizedStatus = (
    u === 'RESPONSIBILITY CENTER SUBMITTED' ? 'DIVISION SUBMITTED' :
    u
  );

  const statusMap = {
    'DRAFT': { color: 'bg-gray-200 text-gray-800', icon: '📝', label: 'Draft', defaultStep: '1/5' },
    'DIVISION SUBMITTED': { color: 'bg-blue-200 text-blue-800', icon: '📤', label: 'Division Submitted', defaultStep: '2/5' },
    'OFFICE': { color: 'bg-indigo-200 text-indigo-800', icon: '📮', label: 'Officer Review', defaultStep: '3/5' },
    'OFFICE APPROVED': { color: 'bg-green-200 text-green-800', icon: '✅', label: 'Officer Approved', defaultStep: '3/5' },
    'OFFICE SUBMITTED': { color: 'bg-purple-200 text-purple-800', icon: '🚀', label: 'Submitted to Manager', defaultStep: '4/5' },
    'RETURNED': { color: 'bg-red-200 text-red-800', icon: '↩️', label: 'Returned', defaultStep: '—' },
    'FINALIZED': { color: 'bg-emerald-200 text-emerald-800', icon: '🏆', label: 'Finalized', defaultStep: '5/5' }
  };

  const stepMap = {
    'ANALYST_DRAFT': '1/5',
    'COORDINATOR_REVIEW': '2/5',
    'OFFICER_REVIEW': '3/5',
    'MANAGER_REVIEW': '4/5',
    'FINALIZED': '5/5',
    'RETURNED': '—'
  };

  const config = statusMap[normalizedStatus] || statusMap['DRAFT'];
  const stepIndicator = stepMap[String(step || '').toUpperCase()] || config.defaultStep || '—';

  const titleCase = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase());

  const pendingLabel = Array.isArray(pendingRoles) && pendingRoles.length > 0
    ? pendingRoles.map((r) => titleCase(String(r || ''))).join(', ')
    : null;

  const assigneeLabel = assignee ? titleCase(String(assignee)) : null;

  return (
    <div className={`inline-flex flex-col gap-1 px-3 py-2 rounded-lg text-sm font-medium ${config.color} ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <span>{config.label}</span>
        <span className="text-xs opacity-75">({stepIndicator})</span>
      </div>
      {(assigneeLabel || pendingLabel) && (
        <div className="text-xs opacity-90">
          {assigneeLabel && <div>Assigned: {assigneeLabel}</div>}
          {pendingLabel && <div>Pending: {pendingLabel}</div>}
        </div>
      )}
    </div>
  );
};

export default WorkflowStatusBadge;