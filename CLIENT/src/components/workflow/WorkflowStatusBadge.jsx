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
    'DRAFT': { color: 'bg-gray-200 text-gray-800', icon: '📝', label: 'Draft', defaultStep: '1/6' },
    'DIVISION SUBMITTED': { color: 'bg-blue-200 text-blue-800', icon: '📤', label: 'Division Submitted', defaultStep: '2/6' },
    'FORWARDED TO APPROVER': { color: 'bg-indigo-200 text-indigo-800', icon: '📮', label: 'Forwarded to Approver', defaultStep: '3/6' },
    'FORWARDED TO OFFICER': { color: 'bg-indigo-200 text-indigo-800', icon: '📮', label: 'Forwarded to Approver', defaultStep: '3/6' },
    'FORWARDED TO BUDGET OFFICER': { color: 'bg-cyan-200 text-cyan-800', icon: '📬', label: 'Forwarded to Budget Officer', defaultStep: '5/6' },
    'OFFICER APPROVED': { color: 'bg-green-200 text-green-800', icon: '✅', label: 'Officer Approved', defaultStep: '4/6' },
    'FORWARDED TO MANAGER': { color: 'bg-purple-200 text-purple-800', icon: '🚀', label: 'Forwarded to Manager', defaultStep: '5/6' },
    'RETURNED': { color: 'bg-red-200 text-red-800', icon: '↩️', label: 'Returned', defaultStep: '—' },
    'FINALIZED': { color: 'bg-emerald-200 text-emerald-800', icon: '🏆', label: 'Finalized', defaultStep: '6/6' }
  };

  const stepMap = {
    'ANALYST_DRAFT': '1/6',
    'ANALYST_DIVISION_SUBMITTED': '2/6',
    'APPROVER_FORWARDED': '3/6',
    'OFFICER_APPROVED': '4/6',
    'OFFICER_FORWARDED': '5/6',
    'MANAGER_FINALIZED': '6/6',
    'FINALIZED': '6/6',
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