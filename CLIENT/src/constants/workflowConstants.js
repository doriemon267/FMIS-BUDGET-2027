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
  PREPARER: 'PREPARER',
  
  // Review/Approval roles
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER',
  
  // Budget authority roles
  BUDGET_ANALYST: 'BUDGET_ANALYST',
  BUDGET_OFFICER: 'BUDGET_OFFICER',
  OVERALL_BUDGET_APPROVER: 'OVERALL_BUDGET_APPROVER',
  BUDGET_ADMIN: 'BUDGET_ADMIN'
};

// NEW 6-STEP WORKFLOW (all divisions follow this path)
export const WORKFLOW_STEPS = [
  {
    step: 1,
    role: WORKFLOW_ROLES.PREPARER,
    label: 'Preparer',
    description: 'Creates and edits proposals',
    icon: 'edit',
    statuses: ['Draft'],
    nextRole: WORKFLOW_ROLES.REVIEWER
  },
  {
    step: 2,
    role: WORKFLOW_ROLES.REVIEWER,
    label: 'Reviewer',
    description: 'Reviews proposal quality',
    icon: 'visibility',
    statuses: ['Submitted for Review'],
    nextRole: WORKFLOW_ROLES.APPROVER
  },
  {
    step: 3,
    role: WORKFLOW_ROLES.APPROVER,
    label: 'Approver',
    description: 'Approves proposal',
    icon: 'verified_user',
    statuses: ['Submitted for Approval'],
    nextRole: WORKFLOW_ROLES.BUDGET_ANALYST
  },
  {
    step: 4,
    role: WORKFLOW_ROLES.BUDGET_ANALYST,
    label: 'Budget Analyst',
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
    nextRole: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER
  },
  {
    step: 6,
    role: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
    label: 'Overall Budget Approver',
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
  REJECTED: 'Rejected'
};

// DEPARTMENT_REGIONAL_LEVEL workflow (Office level) - 5 steps (skips REVIEWER)
export const OFFICE_WORKFLOW_STEPS = [
  {
    step: 1,
    role: WORKFLOW_ROLES.PREPARER,
    label: 'Preparer',
    description: 'Creates and edits proposals',
    icon: 'edit',
    statuses: ['Draft']
  },
  {
    step: 2,
    role: WORKFLOW_ROLES.APPROVER,
    label: 'Approver',
    description: 'Approves proposal',
    icon: 'verified_user',
    statuses: ['Submitted for Approval']
  },
  {
    step: 3,
    role: WORKFLOW_ROLES.BUDGET_ANALYST,
    label: 'Budget Analyst',
    description: 'Technical review',
    icon: 'assignment',
    statuses: ['At Analyst']
  },
  {
    step: 4,
    role: WORKFLOW_ROLES.BUDGET_OFFICER,
    label: 'Budget Officer',
    description: 'Operational approval',
    icon: 'gavel',
    statuses: ['At Officer']
  },
  {
    step: 5,
    role: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
    label: 'Overall Budget Approver',
    description: 'Final executive approval',
    icon: 'verified',
    statuses: ['Finalized']
  }
];

// Role display names
export const ROLE_LABELS = {
  [WORKFLOW_ROLES.PREPARER]: 'Preparer',
  [WORKFLOW_ROLES.REVIEWER]: 'Reviewer',
  [WORKFLOW_ROLES.APPROVER]: 'Approver',
  [WORKFLOW_ROLES.BUDGET_ANALYST]: 'Budget Analyst',
  [WORKFLOW_ROLES.BUDGET_OFFICER]: 'Budget Officer',
  [WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER]: 'Overall Budget Approver',
  [WORKFLOW_ROLES.BUDGET_ADMIN]: 'Budget Admin'
};

// Assignment level display names
export const ASSIGNMENT_LEVEL_LABELS = {
  [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: 'Division Level',
  [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: 'Office Level',
  [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: 'Budget & Revenue Division',
  [ASSIGNMENT_LEVELS.FULL]: 'Full Admin'
};