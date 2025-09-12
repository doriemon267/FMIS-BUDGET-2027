/**
 * 🎭 Workflow Role Assignment Helper
 * 
 * This module provides functions to assign and manage workflow roles for the submission process:
 * - Division Approvers: Can approve division submissions
 * - Department Approvers: Can approve department submissions  
 * - Region Approvers: Can provide final approval
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
/**
 * Assign workflow roles to users based on their organizational level
 */
const assignWorkflowRoles = async (userId, assignmentLevel, workflowRoles = []) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      throw new Error('User assignment not found');
    }
    // Auto-assign default workflow roles based on assignment level if none provided
    if (workflowRoles.length === 0) {
      switch (assignmentLevel) {
        case 'DIVISION':
          workflowRoles = ['divisionCreator']; // Can create division-level data
          break;
        case 'DEPARTMENT':
          workflowRoles = ['departmentCreator', 'departmentConsolidator']; // Can create and approve division submissions
          break;
        case 'REGION':
          workflowRoles = ['regionCreator', 'regionFinalVerifier']; // Can create and provide final approval
          break;
        case 'FULL':
          workflowRoles = ['divisionCreator', 'divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission', 'regionCreator', 'regionFinalVerifier'];
          break;
      }
    }
    // Update the assignment with workflow roles
    assignment.workflowRoles = workflowRoles;
    await assignment.save();
    return {
      success: true,
      message: 'Workflow roles assigned successfully',
      userId,
      assignmentLevel,
      workflowRoles
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
    return assignment.workflowRoles && assignment.workflowRoles.includes(requiredRole);
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
        console.log(`Assigned default roles to user:`, defaultRoles);
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
