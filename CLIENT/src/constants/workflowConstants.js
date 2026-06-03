/**
 * 📋 Frontend Workflow Constants (September 2025)
 * 
 * Synchronized with backend workflow structure
 * MUST match: SERVER/constants/workflowConstants.js
 */

// Assignment Levels (3 distinct levels)
export const ASSIGNMENT_LEVELS = {
  DIVISION_LEVEL: 'DIVISION_LEVEL',
  DEPARTMENT_REGIONAL_LEVEL: 'DEPARTMENT_REGIONAL_LEVEL',
  BUDGET_AND_REVENUE_DIVISION: 'BUDGET_AND_REVENUE_DIVISION',
  FULL: 'FULL'
};

// Workflow Roles (standardized across all levels)
export const WORKFLOW_ROLES = {
  // Preparer roles
  BUDGET_PREPARER: 'BUDGET PREPARER',
  
  // Review/Approval roles
  BUDGET_REVIEWER: 'BUDGET REVIEWER',
  BUDGET_APPROVER: 'BUDGET APPROVER',
  
  // Budget authority roles
  BUDGET_PLANNING_ANALYST: 'BUDGET PLANNING ANALYST',
  BUDGET_OFFICER: 'BUDGET OFFICER',
  BUDGET_MANAGER: 'BUDGET MANAGER',
  SUPER_ADMIN: 'SUPER ADMIN'
};

// NEW 6-STEP WORKFLOW (all divisions follow this path)
export const WORKFLOW_STEPS = [
  {
    step: 1,
    role: WORKFLOW_ROLES.BUDGET_PREPARER,
    label: 'Budget Preparer',
    description: 'Creates and edits proposals',
    icon: 'edit',
    statuses: ['Draft'],
    nextRole: WORKFLOW_ROLES.BUDGET_REVIEWER
  },
  {
    step: 2,
    role: WORKFLOW_ROLES.BUDGET_REVIEWER,
    label: 'Budget Reviewer',
    description: 'Reviews proposal quality',
    icon: 'visibility',
    statuses: ['Submitted for Review'],
    nextRole: WORKFLOW_ROLES.BUDGET_APPROVER
  },
  {
    step: 3,
    role: WORKFLOW_ROLES.BUDGET_APPROVER,
    label: 'Budget Approver',
    description: 'Approves proposal',
    icon: 'verified_user',
    statuses: ['Submitted for Approval'],
    nextRole: WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST
  },
  {
    step: 4,
    role: WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
    label: 'Budget Planning Analyst',
    description: 'Technical review',
    icon: 'assignment',
    statuses: ['At Analyst'],
    nextRole: WORKFLOW_ROLES.BUDGET_OFFICER
  },
  {
    step: 5,
    role: WORKFLOW_ROLES.BUDGET_OFFICER,
    label: 'Budget Officer',
    description: 'Operational approval',
    icon: 'gavel',
    statuses: ['At Officer'],
    nextRole: WORKFLOW_ROLES.BUDGET_MANAGER
  },
  {
    step: 6,
    role: WORKFLOW_ROLES.BUDGET_MANAGER,
    label: 'Budget Manager',
    description: 'Final executive approval',
    icon: 'verified',
    statuses: ['Finalized'],
    nextRole: null
  }
];

// Workflow status values
export const WORKFLOW_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED_FOR_REVIEW: 'Submitted for Review',
  SUBMITTED_FOR_APPROVAL: 'Submitted for Approval',
  AT_ANALYST: 'At Analyst',
  AT_OFFICER: 'At Officer',
  FINALIZED: 'Finalized',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
  MERGED: 'Merged'
};

// DEPARTMENT_REGIONAL_LEVEL workflow (Office level) - 6 steps
export const OFFICE_WORKFLOW_STEPS = [
  {
    step: 1,
    role: WORKFLOW_ROLES.BUDGET_PREPARER,
    label: 'Budget Preparer',
    description: 'Creates and edits proposals',
    icon: 'edit',
    statuses: ['Draft']
  },
  {
    step: 2,
    role: WORKFLOW_ROLES.BUDGET_REVIEWER,
    label: 'Budget Reviewer',
    description: 'Reviews proposal quality',
    icon: 'visibility',
    statuses: ['Submitted for Review']
  },
  {
    step: 3,
    role: WORKFLOW_ROLES.BUDGET_APPROVER,
    label: 'Budget Approver',
    description: 'Approves proposal',
    icon: 'verified_user',
    statuses: ['Submitted for Approval']
  },
  {
    step: 4,
    role: WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
    label: 'Budget Planning Analyst',
    description: 'Technical review',
    icon: 'assignment',
    statuses: ['At Analyst']
  },
  {
    step: 5,
    role: WORKFLOW_ROLES.BUDGET_OFFICER,
    label: 'Budget Officer',
    description: 'Operational approval',
    icon: 'gavel',
    statuses: ['At Officer']
  },
  {
    step: 6,
    role: WORKFLOW_ROLES.BUDGET_MANAGER,
    label: 'Budget Manager',
    description: 'Final executive approval',
    icon: 'verified',
    statuses: ['Finalized']
  }
];

// Role display names
export const ROLE_LABELS = {
  [WORKFLOW_ROLES.BUDGET_PREPARER]: 'Budget Preparer',
  [WORKFLOW_ROLES.BUDGET_REVIEWER]: 'Budget Reviewer',
  [WORKFLOW_ROLES.BUDGET_APPROVER]: 'Budget Approver',
  [WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST]: 'Budget Planning Analyst',
  [WORKFLOW_ROLES.BUDGET_OFFICER]: 'Budget Officer',
  [WORKFLOW_ROLES.BUDGET_MANAGER]: 'Budget Manager',
  [WORKFLOW_ROLES.SUPER_ADMIN]: 'Super Admin'
};

// Assignment level display names
export const ASSIGNMENT_LEVEL_LABELS = {
  [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: 'Division Level',
  [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: 'Office Level',
  [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: 'Budget & Revenue Division',
  [ASSIGNMENT_LEVELS.FULL]: 'Full Admin'
};

// UI metadata for workflow statuses (label & color chips)
export const WORKFLOW_STATUS_UI_METADATA = {
  DRAFT: { label: "Draft", color: "default" },
  FORWARDED_TO_REVIEWER: { label: "Forwarded to Reviewer", color: "primary" },
  FORWARDED_TO_APPROVER: { label: "Forwarded to Approver", color: "primary" },
  FORWARDED_TO_BRD_ANALYST: { label: "Forwarded to Analyst", color: "primary" },
  FORWARDED_TO_BRD_OFFICER: { label: "Forwarded to Officer", color: "primary" },
  FORWARDED_TO_BRD_MANAGER: { label: "Forwarded to Manager", color: "primary" },
  FINALIZED: { label: "Finalized", color: "success" },
  RETURNED_TO_PREPARER: { label: "Returned to Preparer", color: "warning" },
  RETURNED_TO_REVIEWER: { label: "Returned to Reviewer", color: "warning" },
  RETURNED_TO_APPROVER: { label: "Returned to Approver", color: "warning" },
  RETURNED_TO_PLANNING_ANALYST: {
    label: "Returned to Analyst",
    color: "warning",
  },
  RETURNED_TO_OFFICER: { label: "Returned to Officer", color: "warning" },
  MERGED: { label: "Consolidated (Archived)", color: "default" },
};