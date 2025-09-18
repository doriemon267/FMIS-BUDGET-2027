/**
 * 🏢 Hierarchical User Assignment Controller
 * 
 * This controller manages the hierarchical assignment of users to organizational units
 * with proper consolidation logic for Division → Department → Region hierarchy.
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const DepartmentDivisionMapping = require('../models/OrganizationStructure');
const Region = require('../models/Region');
const Department = require('../models/Department');
const { hasFullAccess } = require('../middleware/securityMiddleware');
/**
 * Create or update hierarchical user assignment
 * This handles the complex logic of assigning users to Division/Department/Region
 * with proper consolidation setup
 */
const createOrUpdateHierarchicalAssignment = async (req, res) => {
  try {
    const adminUserRoles = req.user.Roles;
    const adminUserId = req.user.id;
    // Only admins can manage hierarchical assignments
    if (!hasFullAccess(adminUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required to manage hierarchical assignments.',
        code: 'ADMIN_REQUIRED'
      });
    }
    const {
      userId,
      userName,
      email,
      assignmentLevel, // 'DIVISION', 'DEPARTMENT', 'REGION', 'FULL'
      regionId,
      departmentId,
      divisionName,
      rolePermissions = {},
      restrictions = {},
      workflowRoles: requestedWorkflowRoles
    } = req.body;
    if (!userId || !userName || !email || !assignmentLevel) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userName, email, assignmentLevel',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    // Validate assignment level
    const validLevels = ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL', 'OWN_ONLY'];
    if (!validLevels.includes(assignmentLevel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid assignment level. Must be one of: ${validLevels.join(', ')}`,
        code: 'INVALID_ASSIGNMENT_LEVEL'
      });
    }
    // Build hierarchical assignment based on level
    const assignmentData = await buildHierarchicalAssignment({
      assignmentLevel,
      regionId,
      departmentId,
      divisionName
    });
    if (!assignmentData.success) {
      return res.status(400).json(assignmentData);
    }
    // Find existing assignment or create new one
    let assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    // Validate custom workflow roles if provided
    const ALLOWED_WORKFLOW_ROLES = [
      'divisionCreator', 'divisionApprover',
      'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
      'regionCreator', 'regionFinalVerifier'
    ];
    let workflowRolesToAssign = undefined;
    if (Array.isArray(requestedWorkflowRoles)) {
      const invalid = requestedWorkflowRoles.filter(r => !ALLOWED_WORKFLOW_ROLES.includes(r));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid workflowRoles: ${invalid.join(', ')}`,
          code: 'INVALID_WORKFLOW_ROLES',
          allowed: ALLOWED_WORKFLOW_ROLES
        });
      }
      workflowRolesToAssign = requestedWorkflowRoles;
    }

    const assignmentPayload = {
      userId,
      userName,
      email,
      assignmentLevel,
      regionId: assignmentData.regions?.[0] || null,
      departmentId: assignmentData.departments?.[0] || null,
      divisionName: assignmentData.divisions?.[0] || null,
      rolePermissions: {
        // Default permissions based on assignment level
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: assignmentLevel === 'REGION' || assignmentLevel === 'FULL',
        canDeleteProposals: assignmentLevel === 'FULL',
        canApproveProposals: assignmentLevel === 'REGION' || assignmentLevel === 'FULL',
        canViewReports: true,
        canManageUsers: assignmentLevel === 'FULL',
        canManageSettings: assignmentLevel === 'FULL',
        ...rolePermissions
      },
      restrictions: {
        maxProposalAmount: getMaxProposalAmountByLevel(assignmentLevel),
        allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
        allowedFiscalYears: [new Date().getFullYear().toString()],
        readOnlyMode: false,
        ...restrictions
      },
      // Persist workflowRoles immediately if explicitly provided; else keep existing/defaults
      ...(workflowRolesToAssign ? { workflowRoles: workflowRolesToAssign } : {}),
      isActive: true,
      lastModifiedBy: adminUserId
    };
    if (assignment) {
      // Update existing assignment
      Object.assign(assignment, assignmentPayload);
      await assignment.save();
    } else {
      // Create new assignment
      assignmentPayload.createdBy = adminUserId;
      assignment = await HierarchicalUserAssignment.create(assignmentPayload);
    }

    // Auto-assign or apply custom workflow roles
    const { assignWorkflowRoles } = require('../helpers/workflowRoleManager');
    try {
      if (workflowRolesToAssign) {
        await assignWorkflowRoles(userId, assignmentLevel, workflowRolesToAssign);
        console.log(`✅ Custom workflow roles assigned for ${userName}: ${workflowRolesToAssign.join(', ')}`);
      } else {
        await assignWorkflowRoles(userId, assignmentLevel);
        console.log(`✅ Workflow roles automatically assigned for ${assignmentLevel} user: ${userName}`);
      }
    } catch (roleError) {
      console.error(`⚠️ Failed to auto-assign workflow roles for ${userName}:`, roleError.message);
    }
    // Populate the result for response
    const populatedAssignment = await HierarchicalUserAssignment
      .findById(assignment._id)
      .populate('regionId', 'Region regionName RegionName _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id')
      .lean();

    // Emit WebSocket event for real-time permission updates
    // if (global.io) {
    //   global.io.emit('permission-updated', {
    //     userId: userId,
    //     updatedBy: adminUserId,
    //     timestamp: new Date(),
    //     changes: {
    //       assignmentLevel,
    //       rolePermissions,
    //       workflowRoles: requestedWorkflowRoles,
    //       regionId,
    //       departmentId,
    //       divisionName
    //     },
    //     action: assignment.isNew ? 'created' : 'updated'
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: `Hierarchical assignment ${assignment.isNew ? 'created' : 'updated'} successfully`,
      assignment: populatedAssignment,
      consolidationInfo: assignment.getConsolidationTarget(),
      hierarchicalStructure: assignmentData.hierarchicalStructure
    });
  } catch (error) {
    console.error('🚨 Error managing hierarchical assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error managing hierarchical assignment',
      error: error.message
    });
  }
};
/**
 * Get hierarchical assignment details for a user
 */
const getHierarchicalAssignment = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserRoles = req.user.Roles;
    // Check if user can view this assignment
    if (!hasFullAccess(currentUserRoles) && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own assignment.',
        code: 'ACCESS_DENIED'
      });
    }
    const assignment = await HierarchicalUserAssignment
      .findOne({ userId, isActive: true })
      .populate('regionId', 'Region regionName RegionName _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id')
      .lean();
    if (!assignment) {
      return res.status(200).json({
        success: true,
        message: 'No hierarchical assignment found',
        assignment: null,
        defaultAssignment: {
          userId,
          accessScope: 'OWN_ONLY',
          regions: [],
          departments: [],
          divisions: [],
          consolidationInfo: {
            primaryLevel: 'OWN_ONLY',
            consolidationData: {
              originalLevel: 'OWN_ONLY',
              targetLevel: 'OWN_ONLY',
              originalValue: null,
              targetValue: null,
              region: null
            }
          }
        }
      });
    }
    // Get consolidation information
    const assignmentDoc = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    const consolidationInfo = assignmentDoc.getConsolidationTarget();
    return res.status(200).json({
      success: true,
      message: 'Hierarchical assignment retrieved successfully',
      assignment: {
        ...assignment,
        consolidationInfo
      }
    });
  } catch (error) {
    console.error('🚨 Error getting hierarchical assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving hierarchical assignment',
      error: error.message
    });
  }
};
/**
 * Get all hierarchical assignments (Admin only)
 */
const getAllHierarchicalAssignments = async (req, res) => {
  try {
    const userRoles = req.user.Roles;
    if (!hasFullAccess(userRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        code: 'ADMIN_REQUIRED'
      });
    }
    const assignments = await HierarchicalUserAssignment
      .find({ isActive: true })
      .populate('regionId', 'Region regionName RegionName RegionCode _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id')
      .sort({ assignmentLevel: 1, userName: 1 })
      .lean();
    // Add consolidation info to each assignment
    const assignmentsWithConsolidation = await Promise.all(
      assignments.map(async (assignment) => {
        const assignmentDoc = await HierarchicalUserAssignment.findById(assignment._id);
        const consolidationInfo = assignmentDoc.getConsolidationTarget();
        // Shape to match UI expectations
        return {
          ...assignment,
          accessScope: assignment.assignmentLevel,
          regions: assignment.regionId ? [{ _id: assignment.regionId._id, Region: assignment.regionId.Region || assignment.regionId.regionName || assignment.regionId.RegionName }] : [],
          departments: assignment.departmentId ? [{ _id: assignment.departmentId._id, Department: assignment.departmentId.Department || assignment.departmentId.departmentName || assignment.departmentId.DepartmentName }] : [],
          divisions: assignment.divisionName ? [assignment.divisionName] : [],
          consolidationInfo
        };
      })
    );
    // Group by access scope for better organization
    const groupedAssignments = assignmentsWithConsolidation.reduce((groups, assignment) => {
      const scope = assignment.accessScope;
      if (!groups[scope]) {
        groups[scope] = [];
      }
      groups[scope].push(assignment);
      return groups;
    }, {});
    return res.status(200).json({
      success: true,
      message: 'All hierarchical assignments retrieved successfully',
      assignments: assignmentsWithConsolidation,
      groupedByScope: groupedAssignments,
      summary: {
        total: assignmentsWithConsolidation.length,
        byScope: Object.keys(groupedAssignments).reduce((summary, scope) => {
          summary[scope] = groupedAssignments[scope].length;
          return summary;
        }, {})
      }
    });
  } catch (error) {
    console.error('🚨 Error getting all hierarchical assignments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving hierarchical assignments',
      error: error.message
    });
  }
};

/**
 * Explicitly update workflow roles for a user (Admin only)
 */
const updateWorkflowRoles = async (req, res) => {
  try {
    const adminUserRoles = req.user.Roles;
    if (!hasFullAccess(adminUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required to update workflow roles.',
        code: 'ADMIN_REQUIRED'
      });
    }
    const { userId } = req.params;
    const { workflowRoles = [] } = req.body;
    const ALLOWED_WORKFLOW_ROLES = [
      'divisionCreator', 'divisionApprover',
      'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
      'regionCreator', 'regionFinalVerifier'
    ];
    if (!Array.isArray(workflowRoles)) {
      return res.status(400).json({ success: false, message: 'workflowRoles must be an array', code: 'INVALID_PAYLOAD' });
    }
    const invalid = workflowRoles.filter(r => !ALLOWED_WORKFLOW_ROLES.includes(r));
    if (invalid.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid workflowRoles: ${invalid.join(', ')}`, allowed: ALLOWED_WORKFLOW_ROLES, code: 'INVALID_WORKFLOW_ROLES' });
    }
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'User assignment not found', code: 'NOT_FOUND' });
    }
    assignment.workflowRoles = workflowRoles;
    await assignment.save();
    // If final verifier is set, consider ensuring canApproveProposals is enabled
    if (workflowRoles.includes('regionFinalVerifier') && assignment.rolePermissions && !assignment.rolePermissions.canApproveProposals) {
      assignment.rolePermissions.canApproveProposals = true;
      await assignment.save();
    }

    // Emit WebSocket event for real-time workflow role updates
    // if (global.io) {
    //   global.io.emit('permission-updated', {
    //     userId: userId,
    //     updatedBy: req.user.id,
    //     timestamp: new Date(),
    //     changes: {
    //       workflowRoles: workflowRoles,
    //       rolePermissions: assignment.rolePermissions
    //     },
    //     action: 'workflow-roles-updated'
    //   });
    // }

    return res.status(200).json({ success: true, message: 'Workflow roles updated', userId, workflowRoles });
  } catch (error) {
    console.error('Error updating workflow roles:', error);
    return res.status(500).json({ success: false, message: 'Failed to update workflow roles', error: error.message });
  }
};
/**
 * Delete hierarchical assignment
 */
const deleteHierarchicalAssignment = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUserRoles = req.user.Roles;
    if (!hasFullAccess(adminUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        code: 'ADMIN_REQUIRED'
      });
    }
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Hierarchical assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }
    await HierarchicalUserAssignment.deleteOne({ userId, isActive: true });
    return res.status(200).json({
      success: true,
      message: 'Hierarchical assignment deleted successfully',
      deletedAssignment: {
        userId,
        userName: assignment.userName,
        assignmentLevel: assignment.assignmentLevel
      }
    });
  } catch (error) {
    console.error('🚨 Error deleting hierarchical assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting hierarchical assignment',
      error: error.message
    });
  }
};
/**
 * Test hierarchical consolidation for a user
 */
const testHierarchicalConsolidation = async (req, res) => {
  try {
    const { userId, proposalData } = req.body;
    const userRoles = req.user.Roles;
    if (!hasFullAccess(userRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required for testing.',
        code: 'ADMIN_REQUIRED'
      });
    }
    const assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'User assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }
    const consolidationInfo = assignment.getConsolidationTarget();
    // Simulate consolidation application
    const originalData = { ...proposalData };
    const consolidatedData = { ...proposalData };
    // Apply consolidation logic
    switch (assignment.assignmentLevel) {
      case 'DIVISION':
        consolidatedData.originalLevel = 'DIVISION';
        consolidatedData.originalDivision = assignment.divisionName;
        consolidatedData.department = assignment.departmentId;
        consolidatedData.region = assignment.regionId;
        consolidatedData.consolidatedFrom = 'DIVISION';
        break;
      case 'DEPARTMENT':
        consolidatedData.originalLevel = 'DEPARTMENT';
        consolidatedData.originalDepartment = assignment.departmentId;
        consolidatedData.region = assignment.regionId;
        consolidatedData.consolidatedFrom = 'DEPARTMENT';
        break;
      case 'REGION':
        consolidatedData.originalLevel = 'REGION';
        consolidatedData.region = assignment.regionId;
        break;
    }
    return res.status(200).json({
      success: true,
      message: 'Hierarchical consolidation test completed',
      testResults: {
        userId,
        userScope: assignment.accessScope,
        consolidationInfo,
        originalData,
        consolidatedData,
        consolidationApplied: consolidationInfo.consolidationData.originalLevel !== consolidationInfo.consolidationData.targetLevel,
        explanation: getConsolidationExplanation(assignment.accessScope)
      }
    });
  } catch (error) {
    console.error('🚨 Error testing hierarchical consolidation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing hierarchical consolidation',
      error: error.message
    });
  }
};
/**
 * Helper function to build hierarchical assignment
 */
const buildHierarchicalAssignment = async ({ assignmentLevel, regionId, departmentId, divisionName }) => {
  try {
    let regions = [];
    let departments = [];
    let divisions = [];
    let hierarchicalStructure = {};
    switch (assignmentLevel) {
      case 'DIVISION':
        // Division assignment requires region, department, and division
        if (!regionId || !departmentId || !divisionName) {
          return {
            success: false,
            message: 'Division assignment requires regionId, departmentId, and divisionName',
            code: 'MISSING_DIVISION_REQUIREMENTS'
          };
        }
        // Validate region and department exist
        const region = await Region.findById(regionId);
        const department = await Department.findById(departmentId);
        if (!region || !department) {
          return {
            success: false,
            message: 'Invalid region or department ID',
            code: 'INVALID_REGION_DEPARTMENT'
          };
        }
        regions = [regionId];
        departments = [departmentId];
        divisions = [divisionName];
        hierarchicalStructure = {
          level: 'DIVISION',
          division: divisionName,
          department: department.Department,
          region: region.Region,
          consolidatesTo: 'DEPARTMENT',
          ultimateRegion: region.Region
        };
        break;
      case 'DEPARTMENT':
        // Department assignment requires region and department
        if (!regionId || !departmentId) {
          return {
            success: false,
            message: 'Department assignment requires regionId and departmentId',
            code: 'MISSING_DEPARTMENT_REQUIREMENTS'
          };
        }
        const deptRegion = await Region.findById(regionId);
        const assignedDepartment = await Department.findById(departmentId);
        if (!deptRegion || !assignedDepartment) {
          return {
            success: false,
            message: 'Invalid region or department ID',
            code: 'INVALID_REGION_DEPARTMENT'
          };
        }
        regions = [regionId];
        departments = [departmentId];
        divisions = [];
        hierarchicalStructure = {
          level: 'DEPARTMENT',
          department: assignedDepartment.Department,
          region: deptRegion.Region,
          consolidatesTo: 'REGION',
          ultimateRegion: deptRegion.Region
        };
        break;
      case 'REGION':
        // Region assignment requires only region
        if (!regionId) {
          return {
            success: false,
            message: 'Region assignment requires regionId',
            code: 'MISSING_REGION_REQUIREMENTS'
          };
        }
        const assignedRegion = await Region.findById(regionId);
        if (!assignedRegion) {
          return {
            success: false,
            message: 'Invalid region ID',
            code: 'INVALID_REGION'
          };
        }
        regions = [regionId];
        departments = [];
        divisions = [];
        hierarchicalStructure = {
          level: 'REGION',
          region: assignedRegion.Region,
          consolidatesTo: 'REGION',
          ultimateRegion: assignedRegion.Region
        };
        break;
      case 'FULL':
        // Full access - no specific assignments needed
        regions = [];
        departments = [];
        divisions = [];
        hierarchicalStructure = {
          level: 'FULL',
          consolidatesTo: 'FULL',
          hasFullAccess: true
        };
        break;
      case 'OWN_ONLY':
        // Own only access - no organizational assignments
        regions = [];
        departments = [];
        divisions = [];
        hierarchicalStructure = {
          level: 'OWN_ONLY',
          consolidatesTo: 'OWN_ONLY',
          restrictedToOwnRecords: true
        };
        break;
      default:
        return {
          success: false,
          message: 'Invalid assignment level',
          code: 'INVALID_ASSIGNMENT_LEVEL'
        };
    }
    return {
      success: true,
      regions,
      departments,
      divisions,
      hierarchicalStructure
    };
  } catch (error) {
    console.error('Error building hierarchical assignment:', error);
    return {
      success: false,
      message: 'Error building hierarchical assignment',
      error: error.message
    };
  }
};
/**
 * Helper function to get max proposal amount by level
 */
const getMaxProposalAmountByLevel = (level) => {
  switch (level) {
    case 'DIVISION':
      return 100000; // 100K limit for division users
    case 'DEPARTMENT':
      return 500000; // 500K limit for department users
    case 'REGION':
      return 1000000; // 1M limit for region users
    case 'FULL':
      return null; // No limit for full access
    default:
      return 50000; // 50K limit for own-only users
  }
};
/**
 * Helper function to explain consolidation
 */
const getConsolidationExplanation = (scope) => {
  switch (scope) {
    case 'DIVISION':
      return 'Division users submit proposals that are consolidated to their Department records, which roll up to the Region for reporting.';
    case 'DEPARTMENT':
      return 'Department users submit proposals that are consolidated to their Region records for centralized regional reporting.';
    case 'REGION':
      return 'Region users submit proposals directly to their Region records with no consolidation needed.';
    case 'FULL':
      return 'Full access users can operate at any level without consolidation restrictions.';
    default:
      return 'Own-only users can only create and edit their own records.';
  }
};
module.exports = {
  createOrUpdateHierarchicalAssignment,
  getHierarchicalAssignment,
  getAllHierarchicalAssignments,
  updateWorkflowRoles,
  deleteHierarchicalAssignment,
  testHierarchicalConsolidation,
  buildHierarchicalAssignment
};
