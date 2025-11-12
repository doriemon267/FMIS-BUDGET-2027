/**
 * 🎭 Workflow Role Assignment Helper (September 2025)
 * 
 * This module provides functions to assign and manage workflow roles for the NEW 6-step submission process.
 * 
 * NEW 6-STEP WORKFLOW HIERARCHY (September 2025):
 * ==============================================
 * STEP 1: PREPARER
 *         - divisionCreator (Division Level) OR officeCreator (Department/Regional Level)
 *         - Creates and edits proposals
 *
 * STEP 2: BUDGET REVIEWER
 *         - divisionReviewer (Division Level only)
 *         - Reviews submissions before approval
 *
 * STEP 3: APPROVER
 *         - divisionApprover (Division Level) OR officeApprover (Department/Regional Level)
 *         - Approves/verifies submissions
 *         - NOTE: Office level users skip BUDGET_COORDINATOR directly
 *
 * STEP 4: BUDGET_ANALYST
 *         - budgetAnalyst (Budget and Revenue Division)
 *         - Technical review of submissions
 *
 * STEP 5: BUDGET_OFFICER
 *         - budgetOfficer (Budget and Revenue Division)
 *         - Operational approval
 *
 * STEP 6: BUDGET MANAGER
 *         - budgetManager (Budget and Revenue Division)
 *         - Executive authorization and final approval
 * 
 * WORKFLOW PATHS:
 * - Division Level:   PREPARER → BUDGET REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → BUDGET MANAGER
 * - Office Level:     PREPARER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → BUDGET MANAGER (skips BUDGET REVIEWER)
 */

const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const {
  ASSIGNMENT_LEVELS,
  WORKFLOW_ROLES,
  ASSIGNMENT_LEVEL_WORKFLOW_MAPPING,
  ROLE_HIERARCHY,
  PERMISSION_MAPPING
} = require('../constants/workflowConstants');

/**
 * Assign workflow roles to users based on their organizational level (NEW 6-step workflow)
 * - If roles argument is OMITTED, auto-assign defaults based on level
 * - If roles argument is PROVIDED (even []), honor it exactly
 * 
 * NOTE: Strict separation of duties - Preparer and Approver roles should be separate users
 */
const assignWorkflowRoles = async (userId, assignmentLevel, workflowRoles) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      throw new Error('User assignment not found');
    }

    const rolesArgProvided = arguments.length >= 3; // detect explicit provision
    let rolesToSave = Array.isArray(workflowRoles) ? [...workflowRoles] : [];

    if (!rolesArgProvided) {
      // Auto-assign default workflow roles based on NEW assignment level
      const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
      const assignedRoles = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[normalizedLevel];

      if (assignedRoles && assignedRoles.autoAssignedRoles) {
        rolesToSave = assignedRoles.autoAssignedRoles;
      } else {
        // Fallback to legacy logic if not found
        rolesToSave = getDefaultRolesForLevel(assignmentLevel);
      }
    }

    // Update the assignment with workflow roles
    assignment.workflowRoles = rolesToSave;
    await assignment.save();

    return {
      success: true,
      message: 'Workflow roles assigned successfully (NEW 6-step workflow)',
      userId,
      assignmentLevel,
      normalizedLevel: normalizeAssignmentLevel(assignmentLevel),
      workflowRoles: rolesToSave
    };
  } catch (error) {
    console.error('❌ Error assigning workflow roles:', error);
    return {
      success: false,
      message: 'Failed to assign workflow roles',
      error: error.message
    };
  }
};

/**
 * Normalize assignment level to NEW standard (maps old levels to new)
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
 * Get default roles for legacy assignment levels (fallback)
 */
const getDefaultRolesForLevel = (level) => {
  const mapping = {
    'RESPONSIBILITY_CENTER': [WORKFLOW_ROLES.DIVISION_CREATOR],
    'DIVISION': [WORKFLOW_ROLES.DIVISION_CREATOR],
    'OFFICE': [WORKFLOW_ROLES.OFFICE_CREATOR],
    'DEPARTMENT': [WORKFLOW_ROLES.OFFICE_CREATOR],
    'REGION': [
      WORKFLOW_ROLES.BUDGET_ANALYST,
      WORKFLOW_ROLES.BUDGET_OFFICER,
      WORKFLOW_ROLES.BUDGET_MANAGER
    ],
    'FULL': Object.values(WORKFLOW_ROLES)
  };
  return mapping[level] || [];
};

/**
 * Check if user has specific workflow role (NEW 6-step workflow)
 */
const hasWorkflowRole = async (userId, requiredRole) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      return false;
    }

    // Map legacy role names to new roles for backward compatibility
    const roleAliases = {
      // Legacy → New role mappings
      'responsibilityCenterCreator': WORKFLOW_ROLES.DIVISION_CREATOR,
      'officeConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
      'officeFinalVerifier': WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
      'officeSubmission': WORKFLOW_ROLES.OFFICE_CREATOR,
      'departmentCreator': WORKFLOW_ROLES.OFFICE_CREATOR,
      'departmentConsolidator': WORKFLOW_ROLES.OFFICE_APPROVER,
      'regionFinalVerifier': WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER
    };

    const acceptableRoles = [requiredRole];
    if (roleAliases[requiredRole]) {
      acceptableRoles.push(roleAliases[requiredRole]);
    }

    const roles = assignment.workflowRoles || [];
    return acceptableRoles.some(r => roles.includes(r));
  } catch (error) {
    console.error('❌ Error checking workflow role:', error);
    return false;
  }
};

/**
 * Get users with specific workflow role in an organizational unit (NEW 6-step workflow)
 */
const getUsersWithWorkflowRole = async (role, organizationalFilter = {}) => {
  try {
    const query = {
      isActive: true,
      workflowRoles: role
    };

    // Add organizational filters
    if (organizationalFilter.regionId) {
      query.regionId = organizationalFilter.regionId;
    }
    if (organizationalFilter.departmentId) {
      query.departmentId = organizationalFilter.departmentId;
    }
    if (organizationalFilter.divisionName) {
      query.divisionName = organizationalFilter.divisionName;
    }

    const users = await HierarchicalUserAssignment.find(query)
      .populate('regionId', 'regionName Region')
      .populate('departmentId', 'Department departmentName');

    return users.map(user => ({
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      assignmentLevel: user.assignmentLevel,
      normalizedAssignmentLevel: normalizeAssignmentLevel(user.assignmentLevel),
      workflowRoles: user.workflowRoles,
      region: user.regionId?.regionName || user.regionId?.Region,
      department: user.departmentId?.Department || user.departmentId?.departmentName,
      division: user.divisionName
    }));
  } catch (error) {
    console.error('❌ Error getting users with workflow role:', error);
    return [];
  }
};

/**
 * Setup default workflow role assignments for existing users (NEW 6-step workflow)
 */
const setupDefaultWorkflowRoles = async () => {
  try {
    const assignments = await HierarchicalUserAssignment.find({ isActive: true });
    let updatedCount = 0;

    for (const assignment of assignments) {
      // Skip if already has workflow roles
      if (assignment.workflowRoles && assignment.workflowRoles.length > 0) {
        continue;
      }

      const normalizedLevel = normalizeAssignmentLevel(assignment.assignmentLevel);
      const assignedRoles = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[normalizedLevel];
      let defaultRoles = assignedRoles?.autoAssignedRoles || [];

      if (!defaultRoles.length) {
        // Fallback: use legacy logic
        defaultRoles = getDefaultRolesForLevel(assignment.assignmentLevel);
      }

      if (defaultRoles.length > 0) {
        assignment.workflowRoles = defaultRoles;
        await assignment.save();
        updatedCount++;
        console.log(`✅ Assigned roles to ${assignment.userName}:`, defaultRoles);
      }
    }

    return {
      success: true,
      message: `Default workflow roles assigned to ${updatedCount} users (NEW 6-step workflow)`,
      updatedCount
    };
  } catch (error) {
    console.error('❌ Error setting up default workflow roles:', error);
    return {
      success: false,
      message: 'Failed to setup default workflow roles',
      error: error.message
    };
  }
};

/**
 * Get workflow permissions for a user (NEW 6-step workflow)
 */
const getUserWorkflowPermissions = async (userId) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
      .populate('regionId', 'regionName Region')
      .populate('departmentId', 'Department departmentName');

    if (!assignment) {
      return {
        success: false,
        message: 'User assignment not found'
      };
    }

    const workflowRoles = assignment.workflowRoles || [];
    const normalizedLevel = normalizeAssignmentLevel(assignment.assignmentLevel);

    return {
      success: true,
      userId,
      userName: assignment.userName,
      assignmentLevel: assignment.assignmentLevel,
      normalizedAssignmentLevel: normalizedLevel,
      workflowRoles,
      permissions: {
        // NEW 6-step workflow permissions
        canCreateProposals: workflowRoles.includes(WORKFLOW_ROLES.DIVISION_CREATOR) || 
                           workflowRoles.includes(WORKFLOW_ROLES.OFFICE_CREATOR),
        canReviewProposals: workflowRoles.includes(WORKFLOW_ROLES.DIVISION_REVIEWER),
        canApproveProposals: workflowRoles.includes(WORKFLOW_ROLES.DIVISION_APPROVER) || 
                            workflowRoles.includes(WORKFLOW_ROLES.OFFICE_APPROVER),
        canPerformTechnicalReview: workflowRoles.includes(WORKFLOW_ROLES.BUDGET_ANALYST),
        canProvideOperationalApproval: workflowRoles.includes(WORKFLOW_ROLES.BUDGET_OFFICER),
        canProvideExecutiveApproval: workflowRoles.includes(WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER),
        isAdministrator: workflowRoles.includes(WORKFLOW_ROLES.BUDGET_ADMIN),
        // Legacy permissions (for backward compatibility)
        isPreparer: assignment.isPreparer?.(),
        isReviewer: assignment.isReviewer?.(),
        isApprover: assignment.isApprover?.(),
        isBudgetAndRevenueUser: assignment.isBudgetAndRevenueUser?.()
      },
      organizationalContext: {
        region: assignment.regionId?.regionName || assignment.regionId?.Region,
        department: assignment.departmentId?.Department || assignment.departmentId?.departmentName,
        division: assignment.divisionName
      },
      workflowPath: getWorkflowPath(normalizedLevel)
    };
  } catch (error) {
    console.error('❌ Error getting user workflow permissions:', error);
    return {
      success: false,
      message: 'Failed to get workflow permissions',
      error: error.message
    };
  }
};

/**
 * Get workflow path based on assignment level
 */
const getWorkflowPath = (normalizedLevel) => {
  const paths = {
    [ASSIGNMENT_LEVELS.DIVISION_LEVEL]: {
      name: 'Division Level Submission',
      steps: [
        { step: 1, role: WORKFLOW_ROLES.DIVISION_CREATOR, name: 'BUDGET PREPARER' },
        { step: 2, role: WORKFLOW_ROLES.DIVISION_REVIEWER, name: 'BUDGET REVIEWER' },
        { step: 3, role: WORKFLOW_ROLES.DIVISION_APPROVER, name: 'BUDGET APPROVER' },
        { step: 4, role: WORKFLOW_ROLES.BUDGET_ANALYST, name: 'BUDGET_ANALYST' },
        { step: 5, role: WORKFLOW_ROLES.BUDGET_OFFICER, name: 'BUDGET_OFFICER' },
        { step: 6, role: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER, name: 'OVERALL_BUDGET_APPROVER' }
      ]
    },
    [ASSIGNMENT_LEVELS.DEPARTMENT_REGIONAL_LEVEL]: {
      name: 'Office/Department Level Submission',
      steps: [
        { step: 1, role: WORKFLOW_ROLES.OFFICE_CREATOR, name: 'BUDGET PREPARER' },
        { step: 2, role: WORKFLOW_ROLES.OFFICE_APPROVER, name: 'BUDGET APPROVER' },
        { step: 3, role: WORKFLOW_ROLES.BUDGET_ANALYST, name: 'BUDGET_ANALYST' },
        { step: 4, role: WORKFLOW_ROLES.BUDGET_OFFICER, name: 'BUDGET_OFFICER' },
        { step: 5, role: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER, name: 'OVERALL_BUDGET_APPROVER' }
      ]
    },
    [ASSIGNMENT_LEVELS.BUDGET_AND_REVENUE_DIVISION]: {
      name: 'Budget and Revenue Division',
      steps: [
        { step: 1, role: WORKFLOW_ROLES.BUDGET_ANALYST, name: 'BUDGET_ANALYST' },
        { step: 2, role: WORKFLOW_ROLES.BUDGET_OFFICER, name: 'BUDGET_OFFICER' },
        { step: 3, role: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER, name: 'OVERALL_BUDGET_APPROVER' }
      ]
    }
  };

  return paths[normalizedLevel] || null;
};

/**
 * Validate workflow role for a specific assignment level
 */
const validateWorkflowRole = (role, assignmentLevel) => {
  const normalizedLevel = normalizeAssignmentLevel(assignmentLevel);
  const assignedRoles = ASSIGNMENT_LEVEL_WORKFLOW_MAPPING[normalizedLevel];

  if (!assignedRoles) {
    return { valid: false, message: `Unknown assignment level: ${assignmentLevel}` };
  }

  if (!assignedRoles.canHaveRoles.includes(role)) {
    return {
      valid: false,
      message: `Role '${role}' not allowed for assignment level '${normalizedLevel}'`,
      allowedRoles: assignedRoles.canHaveRoles
    };
  }

  return { valid: true, message: 'Role is valid for this assignment level' };
};

/**
 * Get the next workflow role in the sequence
 */
const getNextWorkflowRole = (currentRole) => {
  const nextRoleMap = {
    [WORKFLOW_ROLES.DIVISION_CREATOR]: WORKFLOW_ROLES.DIVISION_REVIEWER,
    [WORKFLOW_ROLES.DIVISION_REVIEWER]: WORKFLOW_ROLES.DIVISION_APPROVER,
    [WORKFLOW_ROLES.DIVISION_APPROVER]: WORKFLOW_ROLES.BUDGET_ANALYST,
    [WORKFLOW_ROLES.OFFICE_CREATOR]: WORKFLOW_ROLES.OFFICE_APPROVER,
    [WORKFLOW_ROLES.OFFICE_APPROVER]: WORKFLOW_ROLES.BUDGET_ANALYST,
    [WORKFLOW_ROLES.BUDGET_ANALYST]: WORKFLOW_ROLES.BUDGET_OFFICER,
    [WORKFLOW_ROLES.BUDGET_OFFICER]: WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER,
    [WORKFLOW_ROLES.OVERALL_BUDGET_APPROVER]: null
  };

  return nextRoleMap[currentRole] || null;
};

module.exports = {
  assignWorkflowRoles,
  hasWorkflowRole,
  getUsersWithWorkflowRole,
  setupDefaultWorkflowRoles,
  getUserWorkflowPermissions,
  getWorkflowPath,
  validateWorkflowRole,
  getNextWorkflowRole,
  normalizeAssignmentLevel,
  getDefaultRolesForLevel,
  WORKFLOW_ROLES: WORKFLOW_ROLES
};