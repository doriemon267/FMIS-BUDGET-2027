/**
 * 📋 Workflow and Hierarchical Constants (September 2025)
 * 
 * NEW HIERARCHICAL STRUCTURE:
 * ===========================
 * 1. DIVISION_LEVEL (Responsibility Center Level)
 *    - Roles: BUDGET REVIEWER, APPROVER
 *    - Preparer auto-assigned as divisionCreator (via divisionalSubmitter)
 *
 * 2. DEPARTMENT_REGIONAL_LEVEL (Office Level)
 *    - Roles: PREPARER (officeCreator), APPROVER
 *    - Skips BUDGET_COORDINATOR (submits directly to APPROVER)
 *
 * 3. BUDGET_AND_REVENUE_DIVISION
 *    - Roles: BUDGET_PLANNING_ANALYST, BUDGET_OFFICER, OVERALL_BUDGET_APPROVER, BUDGET_ADMIN
 * 
 * NEW 6-STEP WORKFLOW (applies to all levels):
 * ============================================
 * STEP 1: PREPARER (divisionCreator or officeCreator)
 *         - Creates and edits proposals
 *         - Submits to BUDGET REVIEWER
 *
 * STEP 2: BUDGET REVIEWER (divisionReviewer)
 *         - Reviews division-level submissions
 *         - Routes to APPROVER for approval
 *
 * STEP 3: APPROVER (divisionApprover or officeApprover)
 *         - Approves/verifies PREPARER or BUDGET REVIEWER submissions
 *         - Routes to BUDGET_PLANNING_ANALYST
 *
 * STEP 4: BUDGET_PLANNING_ANALYST (from Budget and Revenue Division)
 *         - Technical review of submissions
 *         - Routes to BUDGET_OFFICER
 *
 * STEP 5: BUDGET_OFFICER (from Budget and Revenue Division)
 *         - Operational approval
 *         - Routes to OVERALL_BUDGET_APPROVER
 *
 * STEP 6: OVERALL_BUDGET_APPROVER (from Budget and Revenue Division)
 *         - Executive authorization and final approval
 */

// Assignment Levels
const ASSIGNMENT_LEVELS = {
  DIVISION_LEVEL: 'DIVISION_LEVEL',
  DEPARTMENT_REGIONAL_LEVEL: 'DEPARTMENT_REGIONAL_LEVEL',
  BUDGET_AND_REVENUE_DIVISION: 'BUDGET_AND_REVENUE_DIVISION',
  FULL: 'FULL'
};

// User Roles
const USER_ROLES = {
  BUDGET_PREPARER: 'BUDGET PREPARER',
  BUDGET_REVIEWER: 'BUDGET REVIEWER',
  BUDGET_APPROVER: 'BUDGET APPROVER',
  BUDGET_PLANNING_ANALYST: 'BUDGET PLANNING ANALYST',
  BUDGET_OFFICER: 'BUDGET OFFICER',
  BUDGET_MANAGER: 'BUDGET MANAGER',
  SUPER_ADMIN: 'SUPER ADMIN'
};

// Workflow Roles (internal role names for workflow management)
const WORKFLOW_ROLES = {
  // Division Level
  DIVISION_CREATOR: 'divisionCreator',
  DIVISION_REVIEWER: 'divisionReviewer',
  DIVISION_APPROVER: 'divisionApprover',
  
  // Office/Department Level
  OFFICE_CREATOR: 'officeCreator',
  OFFICE_APPROVER: 'officeApprover',
  
  // Budget and Revenue Division
  BUDGET_PLANNING_ANALYST: 'budgetAnalyst',
  BUDGET_OFFICER: 'budgetOfficer',
  BUDGET_MANAGER: 'budgetManager',
  SUPER_ADMIN: 'superAdmin',
  
  // Legacy/Compatibility roles
  DIVISION_CREATOR_LEGACY: 'divisionCreator',
  OFFICE_CREATOR_LEGACY: 'officeCreator',
  DIVISION_APPROVER_LEGACY: 'divisionApprover'
};

// Workflow Step Definitions
const WORKFLOW_STEPS = {
  BUDGET_PREPARER: {
    step: 1,
    name: 'BUDGET PREPARER',
    description: 'Creates and edits proposals',
    nextStep: 'BUDGET_REVIEWER'
  },
  BUDGET_REVIEWER: {
    step: 2,
    name: 'BUDGET REVIEWER',
    description: 'Reviews division-level submissions',
    nextStep: 'BUDGET_APPROVER'
  },
  BUDGET_APPROVER: {
    step: 3,
    name: 'BUDGET APPROVER',
    description: 'Approves/verifies submissions',
    nextStep: 'BUDGET_PLANNING_ANALYST'
  },
  BUDGET_PLANNING_ANALYST: {
    step: 4,
    name: 'BUDGET PLANNING ANALYST',
    description: 'Performs technical review',
    nextStep: 'BUDGET_OFFICER'
  },
  BUDGET_OFFICER: {
    step: 5,
    name: 'BUDGET OFFICER',
    description: 'Provides operational approval',
    nextStep: 'BUDGET_MANAGER'
  },
  BUDGET_MANAGER: {
    step: 6,
    name: 'BUDGET MANAGER',
    description: 'Executive authorization and final approval',
    nextStep: null
  }
};

// Assignment Level to Workflow Roles Mapping
const ASSIGNMENT_LEVEL_WORKFLOW_MAPPING = {
  [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: {
    assignmentLevelName: 'Division Level (Responsibility Center)',
    autoAssignedRoles: [
      WORKFLOW_ROLES.DIVISION_CREATOR,
      WORKFLOW_ROLES.DIVISION_REVIEWER,
      WORKFLOW_ROLES.DIVISION_APPROVER
    ],
    canHaveRoles: [
      WORKFLOW_ROLES.DIVISION_CREATOR,
      WORKFLOW_ROLES.DIVISION_REVIEWER,
      WORKFLOW_ROLES.DIVISION_APPROVER
    ],
    description: 'Handles division/responsibility center level submissions'
  },
  [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: {
    assignmentLevelName: 'Department/Regional Level (Office)',
    autoAssignedRoles: [
      WORKFLOW_ROLES.OFFICE_CREATOR,
      WORKFLOW_ROLES.OFFICE_APPROVER
    ],
    canHaveRoles: [
      WORKFLOW_ROLES.OFFICE_CREATOR,
      WORKFLOW_ROLES.OFFICE_APPROVER
    ],
    description: 'Handles department/regional office level submissions (skips BUDGET REVIEWER)'
  },
  [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: {
    assignmentLevelName: 'Budget and Revenue Division',
    autoAssignedRoles: [
      WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
      WORKFLOW_ROLES.BUDGET_OFFICER,
      WORKFLOW_ROLES.BUDGET_MANAGER,
      WORKFLOW_ROLES.SUPER_ADMIN
    ],
    canHaveRoles: [
      WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
      WORKFLOW_ROLES.BUDGET_OFFICER,
      WORKFLOW_ROLES.BUDGET_MANAGER,
      WORKFLOW_ROLES.SUPER_ADMIN
    ],
    description: 'Central budget authority handling final reviews and approvals'
  },
  [ASSIGNMENT_LEVELS.FULL]: {
    assignmentLevelName: 'Full System Access',
    autoAssignedRoles: [
      WORKFLOW_ROLES.DIVISION_CREATOR,
      WORKFLOW_ROLES.DIVISION_REVIEWER,
      WORKFLOW_ROLES.DIVISION_APPROVER,
      WORKFLOW_ROLES.OFFICE_CREATOR,
      WORKFLOW_ROLES.OFFICE_APPROVER,
      WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
      WORKFLOW_ROLES.BUDGET_OFFICER,
      WORKFLOW_ROLES.BUDGET_MANAGER,
      WORKFLOW_ROLES.SUPER_ADMIN
    ],
    canHaveRoles: [
      WORKFLOW_ROLES.DIVISION_CREATOR,
      WORKFLOW_ROLES.DIVISION_REVIEWER,
      WORKFLOW_ROLES.DIVISION_APPROVER,
      WORKFLOW_ROLES.OFFICE_CREATOR,
      WORKFLOW_ROLES.OFFICE_APPROVER,
      WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST,
      WORKFLOW_ROLES.BUDGET_OFFICER,
      WORKFLOW_ROLES.BUDGET_MANAGER,
      WORKFLOW_ROLES.SUPER_ADMIN
    ],
    description: 'Full access to all workflow roles'
  }
};

// Workflow Path Definitions
const WORKFLOW_PATHS = {
  DIVISION_SUBMISSION: {
    name: 'Division Level Submission',
    steps: [
      'BUDGET PREPARER',      // divisionCreator
      'BUDGET REVIEWER',      // divisionReviewer
      'BUDGET APPROVER',      // divisionApprover
      'BUDGET PLANNING ANALYST',
      'BUDGET OFFICER',
      'BUDGET MANAGER'
    ]
  },
  OFFICE_SUBMISSION: {
    name: 'Office/Department Level Submission',
    steps: [
      'BUDGET PREPARER',      // officeCreator (skips BUDGET_COORDINATOR)
      'BUDGET APPROVER',      // officeApprover (skips BUDGET REVIEWER)
      'BUDGET PLANNING ANALYST',
      'BUDGET OFFICER',
      'BUDGET MANAGER'
    ]
  }
};

// Role Descriptions
const WORKFLOW_ROLE_DESCRIPTIONS = {
  [WORKFLOW_ROLES.DIVISION_CREATOR]: 'Creates and edits division-level budget proposals',
  [WORKFLOW_ROLES.DIVISION_REVIEWER]: 'Reviews division-level submissions before approval',
  [WORKFLOW_ROLES.DIVISION_APPROVER]: 'Approves division-level submissions and routes to preparer',
  [WORKFLOW_ROLES.OFFICE_CREATOR]: 'Creates and edits office/department-level budget proposals',
  [WORKFLOW_ROLES.OFFICE_APPROVER]: 'Approves office-level submissions and routes to preparer (skips coordinator)',
  [WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST]: 'Performs technical review of all submissions',
  [WORKFLOW_ROLES.BUDGET_OFFICER]: 'Provides operational approval after technical review',
  [WORKFLOW_ROLES.BUDGET_MANAGER]: 'Executive authorization and final budget approval',
  [WORKFLOW_ROLES.SUPER_ADMIN]: 'Administrative access for budget management'
};

// Role Hierarchy (for access control and permissions)
const ROLE_HIERARCHY = {
  [WORKFLOW_ROLES.DIVISION_CREATOR]: 1,
  [WORKFLOW_ROLES.OFFICE_CREATOR]: 1,
  [WORKFLOW_ROLES.DIVISION_REVIEWER]: 2,
  [WORKFLOW_ROLES.DIVISION_APPROVER]: 3,
  [WORKFLOW_ROLES.OFFICE_APPROVER]: 3,
  [WORKFLOW_ROLES.BUDGET_PLANNING_ANALYST]: 4,
  [WORKFLOW_ROLES.BUDGET_OFFICER]: 5,
  [WORKFLOW_ROLES.BUDGET_MANAGER]: 6,
  [WORKFLOW_ROLES.SUPER_ADMIN]: 99
};

// Permission Mapping
const PERMISSION_MAPPING = {
  [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: {
    CreateProposals: true,
    EditOwnProposals: true,
    EditAllProposals: false,
    DeleteProposals: false,
    ApproveProposals: false,
    ViewReports: true,
    ManageUsers: false,
    ManageSettings: false
  },
  [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: {
    CreateProposals: true,
    EditOwnProposals: true,
    EditAllProposals: false,
    DeleteProposals: false,
    ApproveProposals: false,
    ViewReports: true,
    ManageUsers: false,
    ManageSettings: false
  },
  [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: {
    CreateProposals: false,
    EditOwnProposals: false,
    EditAllProposals: true,
    DeleteProposals: false,
    ApproveProposals: true,
    ViewReports: true,
    ManageUsers: false,
    ManageSettings: false
  },
  [ASSIGNMENT_LEVELS.FULL]: {
    CreateProposals: true,
    EditOwnProposals: true,
    EditAllProposals: true,
    DeleteProposals: true,
    ApproveProposals: true,
    ViewReports: true,
    ManageUsers: true,
    ManageSettings: true
  }
};

module.exports = {
  ASSIGNMENT_LEVELS,
  USER_ROLES,
  WORKFLOW_ROLES,
  WORKFLOW_STEPS,
  ASSIGNMENT_LEVEL_WORKFLOW_MAPPING,
  WORKFLOW_PATHS,
  WORKFLOW_ROLE_DESCRIPTIONS,
  ROLE_HIERARCHY,
  PERMISSION_MAPPING
};