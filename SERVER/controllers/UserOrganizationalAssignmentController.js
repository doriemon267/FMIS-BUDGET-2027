/**
 * 🏢 User Organizational Assignment Controller
 *
 * This controller manages the new hierarchical assignment of users to organizational units
 * with proper consolidation logic for Responsibility Center → Office hierarchy.
 */
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const { hasFullAccess } = require('../middleware/securityMiddleware');
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

/**
 * Create or update organizational assignment (NEW STRUCTURE)
 * This handles the logic of assigning users to Responsibility Center/Office
 * with proper consolidation setup
 */
const createOrUpdateOrganizationalAssignment = async (req, res) => {
  try {
    const adminUserRoles = req.user.Roles;
    const adminUserId = req.user.id;

    // Only admins can manage organizational assignments
    if (!hasFullAccess(adminUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required to manage organizational assignments.',
        code: 'ADMIN_REQUIRED'
      });
    }

    const {
      userId,
      userName,
      email,
      accessScope, // 'RESPONSIBILITY_CENTER', 'OFFICE', 'FULL', 'OWN_ONLY'
      officeId,
      responsibilityCenterName,
      workflowRoles = {},
      rolePermissions = {}
    } = req.body;

    if (!userId || !userName || !email || !accessScope) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userName, email, accessScope',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate access scope
    const validScopes = ['RESPONSIBILITY_CENTER', 'OFFICE', 'FULL', 'OWN_ONLY'];
    if (!validScopes.includes(accessScope)) {
      return res.status(400).json({
        success: false,
        message: `Invalid access scope. Must be one of: ${validScopes.join(', ')}`,
        code: 'INVALID_ACCESS_SCOPE'
      });
    }

    // Validate ObjectIds if provided (but allow string IDs for default offices)
    if (officeId && typeof officeId === 'string' && !mongoose.Types.ObjectId.isValid(officeId) && !officeId.startsWith('office_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid officeId format. Must be a valid ObjectId or default office identifier.',
        code: 'INVALID_OFFICE_ID'
      });
    }

    // Validate based on access scope
    if (accessScope === 'RESPONSIBILITY_CENTER') {
      if (!officeId || !responsibilityCenterName) {
        return res.status(400).json({
          success: false,
          message: 'Responsibility Center assignments require officeId and responsibilityCenterName',
          code: 'MISSING_RESPONSIBILITY_CENTER_FIELDS'
        });
      }
    } else if (accessScope === 'OFFICE') {
      if (!officeId) {
        return res.status(400).json({
          success: false,
          message: 'Office assignments require officeId',
          code: 'MISSING_OFFICE_FIELDS'
        });
      }
    }

    // Auto-assign permissions based on access scope (similar to legacy system)
    const autoAssignedPermissions = {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: accessScope === 'OFFICE' || accessScope === 'FULL',
      DeleteProposals: accessScope === 'FULL',
      ApproveProposals: accessScope === 'FULL',
      ViewReports: true,
      ManageUsers: accessScope === 'FULL',
      ManageSettings: accessScope === 'FULL'
    };

    // Merge auto-assigned permissions with provided permissions (provided permissions take precedence)
    const finalRolePermissions = {
      ...autoAssignedPermissions,
      ...rolePermissions
    };

    // Auto-assign workflow roles based on access scope
    const autoAssignedWorkflowRoles = [];
    if (accessScope === 'OFFICE') {
      autoAssignedWorkflowRoles.push('officeCreator', 'officeApprover');
    } else if (accessScope === 'RESPONSIBILITY_CENTER') {
      autoAssignedWorkflowRoles.push('divisionCreator', 'divisionApprover');
    } else if (accessScope === 'FULL') {
      autoAssignedWorkflowRoles.push('officeCreator', 'officeApprover', 'officeFinalVerifier');
    }

    // Merge auto-assigned workflow roles with provided roles (provided roles take precedence)
    const finalWorkflowRoles = Array.isArray(workflowRoles)
      ? [...new Set([...autoAssignedWorkflowRoles, ...workflowRoles])]
      : autoAssignedWorkflowRoles;

    // Get active fiscal year from settings instead of hardcoding current year
    let activeFiscalYear = new Date().getFullYear().toString(); // fallback
    try {
      const activeSettings = await Settings.findOne({ isActive: true });
      if (activeSettings && activeSettings.fiscalYear) {
        activeFiscalYear = activeSettings.fiscalYear;
      }
    } catch (error) {
      console.warn('Could not fetch active settings, using current year as fallback:', error.message);
    }

    const autoAssignedRestrictions = {
      allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
      allowedFiscalYears: [activeFiscalYear],
      readOnlyMode: false
    };

    // Create or update assignment
    const assignmentData = {
      userId,
      userName,
      email,
      accessScope,
      offices: accessScope === 'OFFICE' || accessScope === 'RESPONSIBILITY_CENTER' ? [officeId] : [],
      responsibilityCenters: accessScope === 'RESPONSIBILITY_CENTER' ? [responsibilityCenterName] : [],
      workflowRoles: finalWorkflowRoles,
      rolePermissions: finalRolePermissions,
      restrictions: autoAssignedRestrictions,
      assignedBy: adminUserId,
      assignedAt: new Date()
    };

    const assignment = await UserOrganizationalAssignment.findOneAndUpdate(
      { userId },
      assignmentData,
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Organizational assignment saved successfully',
      data: {
        assignment: {
          userId: assignment.userId,
          userName: assignment.userName,
          email: assignment.email,
          accessScope: assignment.accessScope,
          offices: assignment.offices,
          responsibilityCenters: assignment.responsibilityCenters,
          workflowRoles: assignment.workflowRoles,
          rolePermissions: assignment.rolePermissions,
          restrictions: assignment.restrictions,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.assignedAt
        },
        autoAssigned: {
          rolePermissions: autoAssignedPermissions,
          workflowRoles: autoAssignedWorkflowRoles,
          restrictions: autoAssignedRestrictions
        }
      }
    });

  } catch (error) {
    console.error('Error in organizational assignment creation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating organizational assignment',
      error: error.message
    });
  }
};

/**
 * Get organizational assignment for a specific user
 */
const getOrganizationalAssignment = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const currentUserRoles = req.user.Roles;

    // Users can only view their own assignments unless they're admin
    if (userId !== currentUserId && !hasFullAccess(currentUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own organizational assignment.',
        code: 'ACCESS_DENIED'
      });
    }

    const assignment = await UserOrganizationalAssignment.findOne({ userId });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Organizational assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Organizational assignment retrieved successfully',
      data: {
        assignment: {
          userId: assignment.userId,
          userName: assignment.userName,
          email: assignment.email,
          accessScope: assignment.accessScope,
          offices: assignment.offices,
          responsibilityCenters: assignment.responsibilityCenters,
          workflowRoles: assignment.workflowRoles,
          rolePermissions: assignment.rolePermissions,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.assignedAt
        }
      }
    });

  } catch (error) {
    console.error('Error getting organizational assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving organizational assignment',
      error: error.message
    });
  }
};

/**
 * Get all organizational assignments (Admin only)
 */
const getAllOrganizationalAssignments = async (req, res) => {
  try {
    const assignments = await UserOrganizationalAssignment.find({})
      .sort({ assignedAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Organizational assignments retrieved successfully',
      data: {
        assignments: assignments.map(assignment => ({
          userId: assignment.userId,
          userName: assignment.userName,
          email: assignment.email,
          accessScope: assignment.accessScope,
          offices: assignment.offices,
          responsibilityCenters: assignment.responsibilityCenters,
          workflowRoles: assignment.workflowRoles,
          rolePermissions: assignment.rolePermissions,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.assignedAt
        })),
        totalCount: assignments.length
      }
    });

  } catch (error) {
    console.error('Error getting all organizational assignments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving organizational assignments',
      error: error.message
    });
  }
};

/**
 * Delete organizational assignment
 */
const deleteOrganizationalAssignment = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await UserOrganizationalAssignment.findOneAndDelete({ userId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Organizational assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Organizational assignment deleted successfully',
      data: {
        deletedAssignment: {
          userId: result.userId,
          userName: result.userName,
          email: result.email
        }
      }
    });

  } catch (error) {
    console.error('Error deleting organizational assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting organizational assignment',
      error: error.message
    });
  }
};

// BACKWARD COMPATIBILITY: Keep old function names for existing routes
const getAllUserOrganizationalAssignments = getAllOrganizationalAssignments;
const getUserOrganizationalAssignments = getOrganizationalAssignment;
const createOrUpdateUserOrganizationalAssignment = createOrUpdateOrganizationalAssignment;
const deleteUserOrganizationalAssignment = deleteOrganizationalAssignment;

/**
 * Get current user's organizational assignments (for backward compatibility)
 */
const getCurrentUserOrganizationalAssignments = async (req, res) => {
  try {
    const userId = req.user.id;
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);

    if (!assignment) {
      return res.status(200).json({
        userId,
        accessScope: 'OWN_ONLY',
        offices: [],
        responsibilityCenters: [],
        rolePermissions: {}
      });
    }

    return res.status(200).json(assignment);
  } catch (error) {
    console.error('Error fetching current user organizational assignments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Check if user has access to a specific organizational unit (for backward compatibility)
 */
const checkUserOrganizationalAccess = async (userId, { office, responsibilityCenter }) => {
  try {
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);

    // Full access bypasses all restrictions
    if (assignment.accessScope === 'FULL') {
      return true;
    }

    // Own only access denies all organizational checks
    if (assignment.accessScope === 'OWN_ONLY') {
      return false;
    }

    // Check office access
    if (office && assignment.offices && !assignment.offices.includes(office)) {
      return false;
    }

    // Check responsibility center access
    if (responsibilityCenter && assignment.responsibilityCenters && !assignment.responsibilityCenters.includes(responsibilityCenter)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking user organizational access:', error);
    return false;
  }
};

/**
 * Get user's role permissions (for backward compatibility)
 */
const getUserRolePermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);

    return res.status(200).json({
      success: true,
      rolePermissions: assignment.rolePermissions || {},
      workflowRoles: assignment.workflowRoles || {}
    });
  } catch (error) {
    console.error('Error getting user role permissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user permissions',
      error: error.message
    });
  }
};

module.exports = {
  // New function names
  createOrUpdateOrganizationalAssignment,
  getOrganizationalAssignment,
  getAllOrganizationalAssignments,
  deleteOrganizationalAssignment,

  // Backward compatibility aliases
  getAllUserOrganizationalAssignments,
  getUserOrganizationalAssignments,
  createOrUpdateUserOrganizationalAssignment,
  deleteUserOrganizationalAssignment,
  getCurrentUserOrganizationalAssignments,
  checkUserOrganizationalAccess,
  getUserRolePermissions
};
