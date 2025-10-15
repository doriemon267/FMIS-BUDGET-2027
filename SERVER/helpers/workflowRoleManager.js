/**
 * 🎭 Workflow Role Assignment Helper
 * 
 * This module provides functions to assign and manage workflow roles for the submission process.
 * 
 * WORKFLOW HIERARCHY (October 2025):
 * - BUDGET ANALYST (Creator): divisioncreator (RC/Division) OR officecreator (Office)
 * - BUDGET COORDINATOR (Approver): divisionapprover only
 * - BUDGET OFFICER (Verifier): officeverifier/officeconsolidator/officefinalverifier
 * - BUDGET MANAGER (Final Approver): managerapprover/regionfinalverifier
 * 
 * WORKFLOW PATHS:
 * Division Level: ANALYST (divisioncreator) → COORDINATOR (divisionapprover) → OFFICER → MANAGER
 * Office Level:   ANALYST (officecreator) → OFFICER (direct, skip coordinator) → MANAGER
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
/**
 * Assign workflow roles to users based on their organizational level
 * - If roles argument is OMITTED, auto-assign defaults based on level (CREATOR roles only)
 * - If roles argument is PROVIDED (even []), honor it exactly (no auto-assignment)
 * 
 * NOTE: Approver roles should be manually assigned to separate users to maintain
 * separation of duties between creators and approvers.
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
      // Auto-assign default CREATOR workflow roles based on assignment level
      // APPROVER roles must be assigned manually
      switch (assignmentLevel) {
        case 'RESPONSIBILITY_CENTER':
        case 'DIVISION':
          // Division/RC Level: Budget Analyst creator role only
          // Submits to COORDINATOR → OFFICER → MANAGER
          rolesToSave = ['divisionCreator'];
          break;
        case 'OFFICE':
          // Office Level: Budget Analyst creator role only
          // Submits DIRECTLY to OFFICER (skip coordinator) → MANAGER
          rolesToSave = ['officeCreator'];
          break;
        case 'DEPARTMENT':
          // Department Level: Typically coordinator/consolidator roles
          // Should be manually assigned based on actual function
          rolesToSave = ['departmentConsolidator'];
          break;
        case 'REGION':
          // Regional Level: Final verifier/approver roles
          rolesToSave = ['regionFinalVerifier'];
          break;
        case 'FULL':
          // Full access: All creator and approver roles
          rolesToSave = [
            'divisionCreator', 
            'officeCreator',
            'divisionApprover',
            'officeFinalVerifier',
            'regionFinalVerifier',
            'managerapprover'
          ];
          break;
        default:
          // Unknown level: no auto-assignment
          rolesToSave = [];
      }
    }

    // Update the assignment with workflow roles (as provided or auto)
    assignment.workflowRoles = rolesToSave;
    await assignment.save();
    return {
      success: true,
      message: 'Workflow roles assigned successfully',
      userId,
      assignmentLevel,
      workflowRoles: rolesToSave
    };
  } catch (error) {
    console.error('Error assigning workflow roles:', error);
    return {
      success: false,
      message: 'Failed to assign workflow roles',
      error: error.message
    };
  }
};
/**
 * Check if user has specific workflow role
 */
const hasWorkflowRole = async (userId, requiredRole) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      return false;
    }

    // Bridge new vs legacy role names used by workflow routes vs. model enum
    // New structure routes use: officeConsolidator, officeFinalVerifier, officeSubmission, responsibilityCenterCreator
    // Legacy/model roles are: departmentConsolidator, regionFinalVerifier, departmentSubmission, divisionCreator
    const roleAliases = {
      officeConsolidator: 'departmentConsolidator',
      officeFinalVerifier: 'regionFinalVerifier',
      officeSubmission: 'departmentSubmission',
      responsibilityCenterCreator: 'divisionCreator'
    };

    const acceptableRoles = [requiredRole];
    if (roleAliases[requiredRole]) acceptableRoles.push(roleAliases[requiredRole]);

    const roles = assignment.workflowRoles || [];
    return acceptableRoles.some(r => roles.includes(r));
  } catch (error) {
    console.error('Error checking workflow role:', error);
    return false;
  }
};
/**
 * Get users with specific workflow role in an organizational unit
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
      workflowRoles: user.workflowRoles,
      region: user.regionId?.regionName || user.regionId?.Region,
      department: user.departmentId?.Department || user.departmentId?.departmentName,
      division: user.divisionName
    }));
  } catch (error) {
    console.error('Error getting users with workflow role:', error);
    return [];
  }
};
/**
 * Setup default workflow role assignments for existing users
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
      let defaultRoles = [];
      switch (assignment.assignmentLevel) {
        case 'DIVISION':
          defaultRoles = ['divisionCreator'];
          break;
        case 'DEPARTMENT':
          defaultRoles = ['departmentCreator', 'departmentConsolidator'];
          break;
        case 'REGION':
          defaultRoles = ['regionCreator', 'regionFinalVerifier'];
          break;
        case 'FULL':
          defaultRoles = [
            'divisionCreator', 'divisionApprover',
            'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
            'regionCreator', 'regionFinalVerifier'
          ];
          break;
      }
      if (defaultRoles.length > 0) {
        assignment.workflowRoles = defaultRoles;
        await assignment.save();
        updatedCount++;
      }
    }
    return {
      success: true,
      message: `Default workflow roles assigned to ${updatedCount} users`,
      updatedCount
    };
  } catch (error) {
    console.error('Error setting up default workflow roles:', error);
    return {
      success: false,
      message: 'Failed to setup default workflow roles',
      error: error.message
    };
  }
};
/**
 * Workflow role descriptions for admin interface
 */
const WORKFLOW_ROLE_DESCRIPTIONS = {
  'divisionCreator': 'Can create and edit division-level data',
  'divisionApprover': 'Can approve division submissions (usually Department-level users)',
  'departmentCreator': 'Can create and edit department-level data',
  'departmentConsolidator': 'Can consolidate and review division submissions',
  'departmentSubmission': 'Can submit department data to region',
  'regionCreator': 'Can create and edit region-level data',
  'regionFinalVerifier': 'Can provide final approval for all submissions'
};
/**
 * Get workflow permissions for a user
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
    return {
      success: true,
      userId,
      userName: assignment.userName,
      assignmentLevel: assignment.assignmentLevel,
      workflowRoles,
      permissions: {
        canCreateDivisionData: workflowRoles.includes('divisionCreator'),
        canApproveDivisionSubmissions: workflowRoles.includes('divisionApprover'),
        canCreateDepartmentData: workflowRoles.includes('departmentCreator'),
        canConsolidateDivisionData: workflowRoles.includes('departmentConsolidator'),
        canSubmitDepartmentData: workflowRoles.includes('departmentSubmission'),
        canCreateRegionData: workflowRoles.includes('regionCreator'),
        canProvideRegionFinalApproval: workflowRoles.includes('regionFinalVerifier')
      },
      organizationalContext: {
        region: assignment.regionId?.regionName || assignment.regionId?.Region,
        department: assignment.departmentId?.Department || assignment.departmentId?.departmentName,
        division: assignment.divisionName
      }
    };
  } catch (error) {
    console.error('Error getting user workflow permissions:', error);
    return {
      success: false,
      message: 'Failed to get workflow permissions',
      error: error.message
    };
  }
};
module.exports = {
  assignWorkflowRoles,
  hasWorkflowRole,
  getUsersWithWorkflowRole,
  setupDefaultWorkflowRoles,
  getUserWorkflowPermissions,
  WORKFLOW_ROLE_DESCRIPTIONS
};
