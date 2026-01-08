/**
 * Workflow Assignment Helper (September 2025)
 * 
 * This helper provides utilities for the new 6-step workflow assignment
 * and handles the new hierarchical structure with backward compatibility.
 */

const {
  ASSIGNMENT_LEVELS,
  WORKFLOW_ROLES,
  ASSIGNMENT_LEVEL_WORKFLOW_MAPPING,
  PERMISSION_MAPPING
} = require('../constants/workflowConstants');

/**
 * Get valid workflow roles for an assignment level
 */
const getValidWorkflowRolesForLevel = (assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  const mapping = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[normalizedLevel];
  return mapping ? mapping.canHaveRoles : [];
};

/**
 * Normalize assignment level (maps old to new)
 */
const normalizeAssignmentLevel = (level) => {
  const mapping = {
    'RESPONSIBILITY_CENTER': ASSIGNMENT_LEVELS.DIVISION_LEVEL,
    'DIVISION': ASSIGNMENT_LEVELS.DIVISION_LEVEL,
    'OFFICE': ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL,
    'DEPARTMENT': ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL,
    'REGION': ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION
  };
  return mapping[level] || level;
};

/**
 * Get auto-assigned workflow roles for an assignment level
 */
const getAutoAssignedRoles = (assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  const mapping = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[normalizedLevel];
  return mapping ? mapping.autoAssignedRoles : [];
};

/**
 * Get permissions for an assignment level
 */
const getPermissionsForLevel = (assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  return PERMISSION_MAPPING[normalizedLevel] || PERMISSION_MAPPING[ASSIGNMENT_LEVELS.FULL];
};

/**
 * Validate workflow roles for an assignment level
 */
const validateWorkflowRoles = (roles, assignmentLevel) => {
  const validRoles = getValidWorkflowRolesForLevel(assignmentLevel);
  const invalidRoles = [];
  
  for (const role of roles) {
    if (!validRoles.includes(role)) {
      invalidRoles.push(role);
    }
  }
  
  return {
    valid: invalidRoles.length === 0,
    invalidRoles,
    validRoles
  };
};

/**
 * Map legacy workflow roles to new roles
 */
const mapLegacyRolesToNew = (legacyRoles) => {
  const mapping = {
    // Division
    'divisionCreator': WORKFLOW_ROLES.DIVISION_CREATOR,
    'divisionApprover': WORKFLOW_ROLES.DIVISION_APPROVER,
    
    // Office/Department
    'officeCreator': WORKFLOW_ROLES.OFFICE_CREATOR,
    'departmentCreator': WORKFLOW_ROLES.OFFICE_CREATOR,
    'officeConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
    'departmentConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
    'officeSubmission': WORKFLOW_ROLES.OFFICE_CREATOR,
    'departmentSubmission': WORKFLOW_ROLES.OFFICE_CREATOR,
    'officeFinalVerifier': WORKFLOW_ROLES.BUDGET_MANAGER,
    
    // Region/Budget
    'regionCreator': WORKFLOW_ROLES.BUDGET_ANALYST,
    'regionFinalVerifier': WORKFLOW_ROLES.BUDGET_MANAGER
  };

  const newRoles = [];
  const unmappedRoles = [];

  for (const role of legacyRoles) {
    if (mapping[role]) {
      const newRole = mapping[role];
      if (!newRoles.includes(newRole)) {
        newRoles.push(newRole);
      }
    } else if (Object.values(WORKFLOW_ROLES).includes(role)) {
      // Already a new role
      if (!newRoles.includes(role)) {
        newRoles.push(role);
      }
    } else {
      unmappedRoles.push(role);
    }
  }

  return { newRoles, unmappedRoles };
};

/**
 * Apply appropriate permissions based on assignment level
 */
const applyPermissionsForLevel = (assignmentLevel) => {
  return getPermissionsForLevel(assignmentLevel);
};

/**
 * Get the full workflow path description for an assignment level
 */
const getWorkflowPathDescription = (assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  
  const paths = {
    [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: {
      level: 'Division Level (Responsibility Center)',
      path: 'PREPARER → REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_BUDGET_APPROVER',
      steps: 6,
      skipsReviewer: false,
      skipsCoordinator: false
    },
    [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: {
      level: 'Department/Regional Level (Office)',
      path: 'PREPARER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_BUDGET_APPROVER',
      steps: 5,
      skipsReviewer: true,
      skipsCoordinator: true,
      description: 'Skips REVIEWER and direct submission to APPROVER (no BUDGET_COORDINATOR)'
    },
    [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: {
      level: 'Budget and Revenue Division',
      path: 'BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_BUDGET_APPROVER',
      steps: 3,
      description: 'Central budget authority - technical, operational, and executive review'
    },
    [ASSIGNMENT_LEVELS.FULL]: {
      level: 'Full System Access',
      path: 'All roles available',
      steps: 0,
      description: 'Can perform all workflow functions'
    }
  };

  return paths[normalizedLevel] || null;
};

/**
 * Check if office creator should skip budget coordinator
 */
const shouldSkipBudgetCoordinator = (assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  return normalizedLevel === ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL;
};

/**
 * Sanitize and validate workflow roles
 */
const sanitizeWorkflowRoles = (roles, assignmentLevel) => {
  if (!Array.isArray(roles)) {
    return [];
  }

  // Remove empty strings and duplicates
  const cleanedRoles = [...new Set(
    roles.filter(role => typeof role === 'string' && role.trim()).map(r => r.trim())
  )];

  // Validate against assignment level
  const validation = validateWorkflowRoles(cleanedRoles, assignmentLevel);

  return {
    valid: validation.valid,
    sanitizedRoles: cleanedRoles.filter(role => validation.validRoles.includes(role)),
    invalidRoles: validation.invalidRoles,
    validRolesForLevel: validation.validRoles
  };
};

/**
 * Build workflow roles configuration for a new user
 */
const buildWorkflowRolesConfig = (assignmentLevel, explicitRoles = null) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);

  if (explicitRoles !== null) {
    // Use explicit roles if provided
    const sanitized = sanitizeWorkflowRoles(explicitRoles, assignmentLevel);
    return {
      roles: sanitized.sanitizedRoles,
      autoAssigned: false,
      sanitization: sanitized
    };
  } else {
    // Use auto-assigned roles
    const autoRoles = getAutoAssignedRoles(assignmentLevel);
    return {
      roles: autoRoles,
      autoAssigned: true,
      description: getWorkflowPathDescription(normalizedLevel)
    };
  }
};

/**
 * Check separation of duties (no same user with both creator and approver roles at same level)
 */
const validateSeparationOfDuties = (workflowRoles) => {
  const creatorRoles = [
    WORKFLOW_ROLES.DIVISION_CREATOR,
    WORKFLOW_ROLES.OFFICE_CREATOR
  ];
  
  const approverRoles = [
    WORKFLOW_ROLES.DIVISION_APPROVER,
    WORKFLOW_ROLES.OFFICE_APPROVER
  ];

  const hasCreator = workflowRoles.some(r => creatorRoles.includes(r));
  const hasApprover = workflowRoles.some(r => approverRoles.includes(r));

  return {
    valid: !(hasCreator && hasApprover),
    violation: hasCreator && hasApprover,
    message: hasCreator && hasApprover 
      ? 'Separation of duties violation: Same user cannot be both PREPARER and APPROVER'
      : 'Separation of duties validated'
  };
};

module.exports = {
  getValidWorkflowRolesForLevel,
  normalizeAssignmentLevel,
  getAutoAssignedRoles,
  getPermissionsForLevel,
  validateWorkflowRoles,
  mapLegacyRolesToNew,
  applyPermissionsForLevel,
  getWorkflowPathDescription,
  shouldSkipBudgetCoordinator,
  sanitizeWorkflowRoles,
  buildWorkflowRolesConfig,
  validateSeparationOfDuties,
  ASSIGNMENT_LEVELS,
  WORKFLOW_ROLES
};