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
const mongoose = require('mongoose');
const { mainConnection } = require('../config/mongo_db');

// Import new workflow constants (September 2025 refactoring)
const { WORKFLOW_ROLES } = require('../constants/workflowConstants');
const DEBUG = process.env.DEBUG_LOGS === 'true';

/**
 * Lookup user from fmis_main.assigned_roles table
 * Restricted based on current user's role permissions
 */
const lookupUserFromMainDB = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserRoles = req.user.Roles || [];
    const currentUserId = req.user.id;

    // Define role hierarchy for access control (based on 6-step workflow)
    // 📋 ONLY these roles are valid: SUPER_ADMIN, ADMIN, BUDGET_ADMIN (admins)
    //    + BUDGET_PREPARER, BUDGET_REVIEWER, BUDGET_APPROVER, BUDGET_PLANNING_ANALYST, BUDGET_OFFICER, OVERALL_BUDGET_APPROVER (6-step workflow)
    const roleHierarchy = {
      'SUPER_ADMIN': 7,                         // Admin override (highest)
      'ADMIN': 7,                               // Admin override (highest)
      'BUDGET_ADMIN': 7,                        // Admin override (highest)
      'OVERALL_BUDGET_APPROVER': 6,             // STEP 6: Executive budget approval
      'BUDGET_OFFICER': 5,                      // STEP 5: Operational approval
      'BUDGET_PLANNING_ANALYST': 4,             // STEP 4: Technical review
      'BUDGET_APPROVER': 3,                     // STEP 3: Division/Office approval
      'BUDGET_REVIEWER': 2,                     // STEP 2: Division review
      'BUDGET_PREPARER': 1                      // STEP 1: Proposal creation
    };

    // Get current user's highest role level
    const currentUserMaxLevel = Math.max(...currentUserRoles.map(role => roleHierarchy[role] || 0));

    // Allow lookup for users with any budget role or admin roles
    const hasBudgetRole = currentUserRoles.some(role => roleHierarchy[role] !== undefined);
    const hasAdminRole = currentUserRoles.some(role => 
      role.includes('ADMIN') || role.includes('SUPER') || role.includes('MANAGER')
    );

    if (!hasBudgetRole && !hasAdminRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Budget or admin role required for user lookup.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Query the assigned_roles collection from fmis_main database
    const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
    const Role = mainConnection.model('roles', new mongoose.Schema({}, { strict: false }), 'roles');

    const userData = await AssignedRole.findOne({
      $or: [
        { user: userId },
        { user: parseInt(userId) }
      ]
    }).lean();

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found in assigned roles',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get the actual role names from the roles collection
    const roleNames = [];
    if (userData.roles && userData.roles.length > 0) {
      
      // Handle both cases: roles as ObjectIds or as direct role names
      const allRoleNames = [];
      for (const roleItem of userData.roles) {
        console.log(`🔍 Processing role item:`, roleItem, `type:`, typeof roleItem);
        if (roleItem && roleItem._bsontype === 'ObjectId') {
          // It's an ObjectId object
          const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
          if (roleDoc && roleDoc.name) {
            allRoleNames.push(roleDoc.name);
          }
        } else if (typeof roleItem === 'string') {
          if (roleItem.match(/^[0-9a-fA-F]{24}$/)) {
            // It's an ObjectId string, look it up
            const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
            if (roleDoc && roleDoc.name) {
              allRoleNames.push(roleDoc.name);
            }
          } else {
            // It's already a role name
            allRoleNames.push(roleItem);
          }
        } else if (roleItem && typeof roleItem === 'object' && roleItem.name) {
          // It's a role object with name property
          allRoleNames.push(roleItem.name);
        } else if (roleItem && roleItem.toString) {
          // Try to convert to string
          allRoleNames.push(roleItem.toString());
        }
      }
      
      roleNames.push(...allRoleNames);
    }

    // Extract relevant user information
    const userInfo = {
      userId: userData.user,
      userName: userData.fullName || userData.userName || userData.name,
      // Note: Email is not stored in assigned_roles collection, so we don't return it
      // email: userData.email || userData.userEmail,
      roles: roleNames, // Return actual role names, not just IDs
      department: userData.department || userData.departmentName,
      division: userData.division || userData.divisionName,
      region: userData.region || userData.regionName
    };

    // Determine the appropriate budget role based on user's main roles
    // Following the 6-step workflow hierarchy, but now supporting MULTIPLE LEGITIMATE ROLES
    //  ONLY accept these role names - 6-step workflow + 3 admin roles
    // Map ANY incoming role name to standardized versions ONLY (with underscores)
    let budgetRoles = []; // Array to hold multiple roles
    let primaryRole = 'BUDGET_PREPARER'; // default (STEP 1)

  if (DEBUG) console.debug(`🔍 User ${userId} roles from DB:`, roleNames);

    if (roleNames.includes('SUPER ADMIN') || roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN')) {
      budgetRoles.push('SUPER_ADMIN');
      primaryRole = 'SUPER_ADMIN';
    } else {
      // Check for each role type and add to budgetRoles array
      // Allow multiple roles where it makes sense (e.g., Preparer + Reviewer, Approver + Reviewer)
      
      // Check for OVERALL_BUDGET_APPROVER
      if (roleNames.includes('OVERALL_BUDGET_APPROVER') || roleNames.includes('OVERALL BUDGET APPROVER')) {
        budgetRoles.push('OVERALL_BUDGET_APPROVER');
        primaryRole = 'OVERALL_BUDGET_APPROVER';
      }
      
      // Check for BUDGET_OFFICER
      if (roleNames.includes('BUDGET OFFICER') || roleNames.includes('BUDGET_OFFICER')) {
        budgetRoles.push('BUDGET_OFFICER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_OFFICER';
      }
      
      // Check for BUDGET_PLANNING_ANALYST
      if (roleNames.includes('BUDGET PLANNING ANALYST') || roleNames.includes('BUDGET_PLANNING_ANALYST')) {
        budgetRoles.push('BUDGET_PLANNING_ANALYST');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_PLANNING_ANALYST';
      }
      
      // Check for BUDGET_APPROVER
      if (roleNames.includes('BUDGET APPROVER') || roleNames.includes('BUDGET_APPROVER')) {
        budgetRoles.push('BUDGET_APPROVER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_APPROVER';
      }
      
      // Check for BUDGET_REVIEWER
      if (roleNames.includes('BUDGET REVIEWER') || roleNames.includes('BUDGET_REVIEWER')) {
        budgetRoles.push('BUDGET_REVIEWER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_REVIEWER';
      }
      
      // Check for BUDGET_PREPARER
      if (roleNames.includes('BUDGET PREPARER') || roleNames.includes('BUDGET_PREPARER')) {
        budgetRoles.push('BUDGET_PREPARER');
        // Don't change primaryRole if it's already set to higher role
      }
      
      // If no specific budget roles found, default to BUDGET_PREPARER
      if (budgetRoles.length === 0) {
        budgetRoles.push('BUDGET_PREPARER');
      }
    }

  if (DEBUG) console.debug(`📋 Determined budgetRoles for user ${userId}:`, budgetRoles, `primaryRole: ${primaryRole}`);
    userInfo.budgetRoles = budgetRoles; // Multiple roles
    userInfo.budgetRole = primaryRole; // Primary role for backward compatibility

    res.json({
      success: true,
      data: userInfo
    });

  } catch (error) {
    console.error('❌ Error looking up user from main DB:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup user information',
      error: error.message
    });
  }
};
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
      if (DEBUG) console.debug('❌ Admin access denied');
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
      userRole,
      assignmentLevel, // 'DIVISION', 'DEPARTMENT', 'REGION', 'FULL'
      accessScope, // NEW: Alternative field name for backward compatibility
      regionId,
      departmentId,
      divisionName,
      officeId, // NEW: Office ID from new structure
      responsibilityCenterName // NEW: Responsibility center name from new structure
    } = req.body;

    // Handle backward compatibility: map new field names to old ones
    const effectiveAssignmentLevel = assignmentLevel || accessScope;
    const normalizedEffectiveLevel = (effectiveAssignmentLevel || '').toUpperCase();
    // Only use non-empty values for organizational fields
    const effectiveDepartmentId = (departmentId && departmentId.trim()) || (officeId && officeId.trim()) || null;
    const effectiveDivisionName = (divisionName && divisionName.trim()) || (responsibilityCenterName && responsibilityCenterName.trim()) || null;

    // Map new assignment levels to old model enum values
    let modelAssignmentLevel = normalizedEffectiveLevel;
    if (normalizedEffectiveLevel === 'OFFICE') {
      modelAssignmentLevel = 'DEPARTMENT';
    } else if (normalizedEffectiveLevel === 'RESPONSIBILITY_CENTER') {
      modelAssignmentLevel = 'DIVISION';
    }

    if (!userId || !userName || !email || !normalizedEffectiveLevel) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userName, email, assignmentLevel/accessScope',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    // Validate assignment level
    const validLevels = ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL', 'OWN_ONLY', 'RESPONSIBILITY_CENTER', 'OFFICE'];
    if (!validLevels.includes(normalizedEffectiveLevel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid assignment level. Must be one of: ${validLevels.join(', ')}`,
        code: 'INVALID_ASSIGNMENT_LEVEL'
      });
    }

    // Validate ObjectIds if provided (use effective values after mapping)
    if (regionId && !mongoose.Types.ObjectId.isValid(regionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid regionId format',
        code: 'INVALID_REGION_ID'
      });
    }
    if (effectiveDepartmentId && !mongoose.Types.ObjectId.isValid(effectiveDepartmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departmentId/officeId format',
        code: 'INVALID_DEPARTMENT_ID'
      });
    }
    // Build hierarchical assignment based on level
    if (DEBUG) console.debug('🔍 Building hierarchical assignment with:', {
      assignmentLevel: normalizedEffectiveLevel,
      regionId,
      departmentId: effectiveDepartmentId,
      divisionName: effectiveDivisionName
    });
    
    const assignmentData = await buildHierarchicalAssignment({
      assignmentLevel: normalizedEffectiveLevel,
      regionId,
      departmentId: effectiveDepartmentId,
      divisionName: effectiveDivisionName
    });
    
    if (!assignmentData.success) {
      console.error('❌ Failed to build hierarchical assignment:', assignmentData);
      return res.status(400).json(assignmentData);
    }
    
  if (DEBUG) console.debug('✅ Hierarchical assignment built successfully:', assignmentData);
    // Find existing assignment or create new one
    let assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });

    const approvalLevels = ['REGION', 'FULL', 'OFFICE', 'RESPONSIBILITY_CENTER'];
    
    // ✅ ONLY accept VALID 6-STEP WORKFLOW roles + 3 admin roles
    // DO NOT accept legacy role names like PREPARER, REVIEWER, APPROVER
    // These should already be standardized to BUDGET_PREPARER, BUDGET_REVIEWER, BUDGET_APPROVER
    const VALID_WORKFLOW_ROLES = [
      // Admin roles (3 only)
      'SUPER_ADMIN', 'ADMIN', 'BUDGET_ADMIN',
      // 6-STEP WORKFLOW ROLES (standardized names ONLY)
      'BUDGET_PREPARER',           // STEP 1
      'BUDGET_REVIEWER',           // STEP 2
      'BUDGET_APPROVER',           // STEP 3
      'BUDGET_PLANNING_ANALYST',   // STEP 4
      'BUDGET_OFFICER',            // STEP 5
      'OVERALL_BUDGET_APPROVER'    // STEP 6
    ];
    
    const hasExplicitWorkflowRoles = Array.isArray(req.body.workflowRoles);
    const sanitizedWorkflowRoles = hasExplicitWorkflowRoles
      ? (req.body.workflowRoles || [])
          .filter(role => typeof role === 'string' && role.trim())
          .filter(role => VALID_WORKFLOW_ROLES.includes(role)) // ✅ NOW accepts both old and new roles
      : [];
    
    if (DEBUG) console.debug('🔍 Workflow roles sanitization:', {
      received: req.body.workflowRoles,
      sanitized: sanitizedWorkflowRoles,
      hasExplicit: hasExplicitWorkflowRoles
    });
    
    const assignmentPayload = {
      userId,
      userName,
      email,
      // NEW: Support multiple roles from FMIS main system
      userRoles: req.body.userRoles || [], // Array of roles from FMIS main
      // Keep backward compatibility - primary role (highest in hierarchy)
      userRole: userRole || undefined,
      assignmentLevel: modelAssignmentLevel,
      regionId: assignmentData.regions?.[0] || null,
      departmentId: assignmentData.departments?.[0] || null,
      divisionName: assignmentData.divisions?.[0] || null,
      // NEW: Budget Planning Analyst region configuration
      isNIAWide: req.body.isNIAWide === true,
      assignedRegions: (userRole === 'BUDGET_PLANNING_ANALYST' && Array.isArray(req.body.assignedRegions)) 
        ? req.body.assignedRegions.filter(id => {
            // Accept non-empty strings (region codes like "MARIIS", "CALABARZON")
            const isValidString = typeof id === 'string' && id.trim().length > 0;
            if (!isValidString) {
              console.warn(`⚠️ Invalid region value (must be non-empty string): ${id}`);
            }
            return isValidString;
          })
        : [],
      rolePermissions: {
        // Default permissions based on assignment level
        CreateProposals: true,
        EditOwnProposals: true,
        EditAllProposals: approvalLevels.includes(normalizedEffectiveLevel),
        DeleteProposals: normalizedEffectiveLevel === 'FULL',
        ApproveProposals: approvalLevels.includes(normalizedEffectiveLevel),
        canApproveProposals: approvalLevels.includes(normalizedEffectiveLevel),
        ViewReports: true,
        ManageUsers: normalizedEffectiveLevel === 'FULL',
        ManageSettings: normalizedEffectiveLevel === 'FULL'
      },
      workflowRoles: hasExplicitWorkflowRoles ? sanitizedWorkflowRoles : undefined,
      isActive: true,
      lastModifiedBy: adminUserId
    };

    if (!hasExplicitWorkflowRoles) {
      delete assignmentPayload.workflowRoles;
    }

    if (assignment) {
      // Update existing assignment
      Object.assign(assignment, assignmentPayload);
      
      // Clean up any invalid workflow roles from existing assignment
      if (Array.isArray(assignment.workflowRoles)) {
        const originalRoles = [...assignment.workflowRoles];
        assignment.workflowRoles = assignment.workflowRoles.filter(role => 
          VALID_WORKFLOW_ROLES.includes(role)
        );
        
        if (originalRoles.length !== assignment.workflowRoles.length) {
          if (DEBUG) console.debug('🧹 Cleaned up invalid workflow roles:', {
            original: originalRoles,
            cleaned: assignment.workflowRoles,
            removed: originalRoles.filter(r => !VALID_WORKFLOW_ROLES.includes(r))
          });
        }
      }
    } else {
      // Create new assignment
      assignmentPayload.createdBy = adminUserId;
      assignment = await HierarchicalUserAssignment.create(assignmentPayload);
    }

    // Auto-configure workflow roles and approval flag based on assignment level
    try {
      applyOfficeDefaults(assignment, sanitizedWorkflowRoles, normalizedEffectiveLevel, hasExplicitWorkflowRoles);
      ensureApprovalFlagConsistency(assignment, sanitizedWorkflowRoles, normalizedEffectiveLevel, hasExplicitWorkflowRoles);
      
      if (DEBUG) console.debug('💾 Saving assignment:', {
        userId: assignment.userId,
        assignmentLevel: assignment.assignmentLevel,
        userRole: assignment.userRole,
        regionId: assignment.regionId,
        departmentId: assignment.departmentId,
        divisionName: assignment.divisionName,
        isNIAWide: assignment.isNIAWide,
        assignedRegionsCount: assignment.assignedRegions?.length || 0
      });
      
      await assignment.save();
  if (DEBUG) console.debug('✅ Assignment saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving assignment:', saveError);
      throw saveError;
    }

    // Get consolidation info before converting to lean object
    const consolidationInfo = assignment.getConsolidationTarget();
    
    // Populate the result for response
    const populatedAssignment = await HierarchicalUserAssignment
      .findById(assignment._id)
      .populate('regionId', 'Region regionName RegionName _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id')
      .populate('assignedRegions', 'Region regionName RegionName _id')
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
      consolidationInfo: consolidationInfo,
      hierarchicalStructure: assignmentData.hierarchicalStructure
    });
  } catch (error) {
    console.error('🚨 Error managing hierarchical assignment:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // Provide more specific error messages
    let errorMessage = 'Error managing hierarchical assignment';
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.name === 'CastError') {
      errorMessage = `Invalid ${error.path}: ${error.value}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    // Allow access if user has full access OR if the requested userId matches any of the authenticated user's IDs
    const authenticatedUserIds = [
      String(req.user.Id || ''),  // Check uppercase Id first (from dev headers)
      String(req.user.id || ''),
      String(req.user.userId || ''),
      String(req.user.UserId || ''),
      ...(Array.isArray(req.user.Username) ? req.user.Username.map(u => String(u || '')) : [String(req.user.Username || '')]),
      ...(Array.isArray(req.user.username) ? req.user.username.map(u => String(u || '')) : [String(req.user.username || '')])
    ].filter(id => id && id !== '');
    
    const isOwnAssignment = authenticatedUserIds.includes(String(userId));
    
    if (!hasFullAccess(currentUserRoles) && !isOwnAssignment) {
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
    
    // If userName is missing, try to look it up
    let userName = assignment.userName;
    if (!userName || userName.trim() === '') {
      try {
        // Simple user lookup from main DB
        const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
        const userData = await AssignedRole.findOne({
          user: userId
        }).lean();
        
        if (userData) {
          userName = userData.fullName || userData.userName || userData.name || userData.user;
          // Update the assignment document with the looked up name
          if (assignmentDoc && userName) {
            assignmentDoc.userName = userName;
            await assignmentDoc.save().catch(err => console.warn('Failed to save userName:', err.message));
          }
        }
      } catch (lookupError) {
        console.warn(`Failed to lookup userName for ${userId}:`, lookupError.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Hierarchical assignment retrieved successfully',
      assignment: {
        ...assignment,
        userName: userName || userId, // Fallback to userId if name not found
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
    
    // Allow access for users with budget roles or admin privileges
    // ✅ Check both old (space-separated) and new (underscore) formats for backward compatibility
    const hasBudgetRole = userRoles && (
      userRoles.includes('BUDGET_PREPARER') || userRoles.includes('BUDGET PREPARER') ||
      userRoles.includes('BUDGET_REVIEWER') || userRoles.includes('BUDGET REVIEWER') ||
      userRoles.includes('BUDGET_APPROVER') || userRoles.includes('BUDGET APPROVER') ||
      userRoles.includes('BUDGET_PLANNING_ANALYST') || userRoles.includes('BUDGET PLANNING ANALYST') ||
      userRoles.includes('BUDGET_OFFICER') || userRoles.includes('BUDGET OFFICER') ||
      userRoles.includes('OVERALL_BUDGET_APPROVER') || userRoles.includes('OVERALL BUDGET APPROVER')
    );
    
    if (!hasFullAccess(userRoles) && !hasBudgetRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Budget role or admin privileges required.',
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
        try {
          const assignmentDoc = await HierarchicalUserAssignment.findById(assignment._id);
          const consolidationInfo = assignmentDoc ? assignmentDoc.getConsolidationTarget() : null;
          
          // If userName is missing, try to look it up
          let userName = assignment.userName;
          if (!userName || userName.trim() === '') {
            try {
              // Simple user lookup from main DB
              const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
              const userData = await AssignedRole.findOne({
                user: assignment.userId
              }).lean();
              
              if (userData) {
                userName = userData.fullName || userData.userName || userData.name || userData.user;
                // Update the assignment document with the looked up name
                if (assignmentDoc && userName) {
                  assignmentDoc.userName = userName;
                  await assignmentDoc.save().catch(err => console.warn('Failed to save userName:', err.message));
                }
              }
            } catch (lookupError) {
              console.warn(`Failed to lookup userName for ${assignment.userId}:`, lookupError.message);
            }
          }
          
          // Shape to match UI expectations
          const officeId = assignment.regionId && assignment.departmentId
            ? `${assignment.departmentId._id}_${assignment.regionId._id}`
            : assignment.departmentId
              ? assignment.departmentId._id.toString()
              : '';
          return {
            ...assignment,
            userName: userName || assignment.userId, // Fallback to userId if name not found
            accessScope: assignment.assignmentLevel,
            officeId: officeId,
            regions: assignment.regionId ? [{ _id: assignment.regionId._id, Region: assignment.regionId.Region || assignment.regionId.regionName || assignment.regionId.RegionName }] : [],
            departments: assignment.departmentId ? [{ _id: assignment.departmentId._id, Department: assignment.departmentId.Department || assignment.departmentId.departmentName || assignment.departmentId.DepartmentName }] : [],
            divisions: assignment.divisionName ? [assignment.divisionName] : [],
            consolidationInfo
          };
        } catch (error) {
          console.error(`Error processing assignment ${assignment._id}:`, error);
          // Return assignment without consolidation info if there's an error
          const officeId = assignment.regionId && assignment.departmentId
            ? `${assignment.departmentId._id}_${assignment.regionId._id}`
            : assignment.departmentId
              ? assignment.departmentId._id.toString()
              : '';
          return {
            ...assignment,
            accessScope: assignment.assignmentLevel,
            officeId: officeId,
            regions: assignment.regionId ? [{ _id: assignment.regionId._id, Region: assignment.regionId.Region || assignment.regionId.regionName || assignment.regionId.RegionName }] : [],
            departments: assignment.departmentId ? [{ _id: assignment.departmentId._id, Department: assignment.departmentId.Department || assignment.departmentId.departmentName || assignment.departmentId.DepartmentName }] : [],
            divisions: assignment.divisionName ? [assignment.divisionName] : [],
            consolidationInfo: null
          };
        }
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
    
    // ✅ ONLY accept VALID 6-STEP WORKFLOW roles + 3 admin roles
    // DO NOT accept any legacy role names
    const ALLOWED_WORKFLOW_ROLES = [
      // Admin roles (3 only)
      'SUPER_ADMIN', 'ADMIN', 'BUDGET_ADMIN',
      // 6-STEP WORKFLOW ROLES (standardized names ONLY)
      'BUDGET_PREPARER',           // STEP 1
      'BUDGET_REVIEWER',           // STEP 2
      'BUDGET_APPROVER',           // STEP 3
      'BUDGET_PLANNING_ANALYST',   // STEP 4
      'BUDGET_OFFICER',            // STEP 5
      'OVERALL_BUDGET_APPROVER'    // STEP 6
    ];
    
    if (!Array.isArray(workflowRoles)) {
      return res.status(400).json({ success: false, message: 'workflowRoles must be an array', code: 'INVALID_PAYLOAD' });
    }
    const invalid = workflowRoles.filter(r => !ALLOWED_WORKFLOW_ROLES.includes(r));
    if (invalid.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid workflowRoles: ${invalid.join(', ')}. Only use: ${ALLOWED_WORKFLOW_ROLES.join(', ')}`, 
        allowed: ALLOWED_WORKFLOW_ROLES, 
        code: 'INVALID_WORKFLOW_ROLES' 
      });
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
      case 'DIVISION': {
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
      }
      case 'DEPARTMENT': {
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
      }
      case 'REGION': {
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
      }
      case 'FULL': {
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
      }
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
      case 'RESPONSIBILITY_CENTER':
        // Responsibility Center assignment (new structure) - maps to division
        if (!departmentId || !divisionName) {
          return {
            success: false,
            message: 'Responsibility Center assignment requires departmentId and divisionName',
            code: 'MISSING_RESPONSIBILITY_CENTER_REQUIREMENTS'
          };
        }
        // For backward compatibility, we need to find the region for this department
        const rcDepartment = await Department.findById(departmentId);
        if (!rcDepartment) {
          return {
            success: false,
            message: 'Invalid department ID for Responsibility Center assignment',
            code: 'INVALID_DEPARTMENT'
          };
        }
        // Find region from department mappings
        const deptMappings = await DepartmentDivisionMapping.find({ departmentId: departmentId });
        let rcRegionId = null;
        if (deptMappings.length > 0) {
          const firstMapping = deptMappings[0];
          if (firstMapping.regionId) {
            const region = await Region.findById(firstMapping.regionId);
            if (region) {
              rcRegionId = firstMapping.regionId;
            }
          }
        }
        regions = rcRegionId ? [rcRegionId] : [];
        departments = [departmentId];
        divisions = [divisionName];
        
        // Get region name only if regionId exists
        const rcRegionName = rcRegionId ? (await Region.findById(rcRegionId))?.Region : null;
        
        hierarchicalStructure = {
          level: 'RESPONSIBILITY_CENTER',
          division: divisionName,
          department: rcDepartment.Department,
          region: rcRegionName,
          consolidatesTo: 'OFFICE',
          ultimateRegion: rcRegionName
        };
        break;
      case 'OFFICE':
        // Office assignment (new structure) - maps to department
        if (!departmentId) {
          return {
            success: false,
            message: 'Office assignment requires departmentId',
            code: 'MISSING_OFFICE_REQUIREMENTS'
          };
        }
        const officeDepartment = await Department.findById(departmentId);
        if (!officeDepartment) {
          return {
            success: false,
            message: 'Invalid department ID for Office assignment',
            code: 'INVALID_DEPARTMENT'
          };
        }
        // Find region from department mappings
        const officeDeptMappings = await DepartmentDivisionMapping.find({ departmentId: departmentId });
        let officeRegionId = null;
        if (officeDeptMappings.length > 0) {
          const firstMapping = officeDeptMappings[0];
          if (firstMapping.regionId) {
            const region = await Region.findById(firstMapping.regionId);
            if (region) {
              officeRegionId = firstMapping.regionId;
            }
          }
        }
        regions = officeRegionId ? [officeRegionId] : [];
        departments = [departmentId];
        divisions = [];
        
        // Get region name only if regionId exists
        const officeRegionName = officeRegionId ? (await Region.findById(officeRegionId))?.Region : null;
        
        hierarchicalStructure = {
          level: 'OFFICE',
          department: officeDepartment.Department,
          region: officeRegionName,
          consolidatesTo: 'REGION',
          ultimateRegion: officeRegionName
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
  buildHierarchicalAssignment,
  lookupUserFromMainDB
};

// ----- Internal helper utilities -----
const APPROVAL_ENABLED_LEVELS = ['REGION', 'FULL', 'OFFICE'];
const DEFAULT_WORKFLOW_ROLES_BY_LEVEL = {
  REGION: ['regionCreator', 'regionFinalVerifier', 'officeCreator', 'officeConsolidator', 'officeSubmission'],
  FULL: ['regionCreator', 'regionFinalVerifier', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier'],
  OFFICE: ['officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier'],
  DEPARTMENT: ['departmentCreator', 'departmentConsolidator', 'departmentSubmission'],
  DIVISION: ['divisionCreator', 'divisionApprover'],
  RESPONSIBILITY_CENTER: ['divisionCreator', 'divisionApprover']
};
const APPROVAL_WORKFLOW_ROLES = new Set(['officeConsolidator', 'officeFinalVerifier', 'regionFinalVerifier']);

/**
 * Ensure default workflow roles and approval flags align with assignment level.
 */
function applyOfficeDefaults(assignmentDoc, sanitizedWorkflowRoles, normalizedLevel, hasExplicitWorkflowRoles) {
  if (!assignmentDoc) return;

  const level = normalizedLevel || assignmentDoc.assignmentLevel || '';
  const userRole = assignmentDoc.userRole;
  
  // If explicit workflow roles provided, use them (must be from VALID_WORKFLOW_ROLES)
  if (hasExplicitWorkflowRoles) {
    assignmentDoc.workflowRoles = sanitizedWorkflowRoles;
  } else if (userRole) {
    // ✅ ONLY accept standardized 6-STEP WORKFLOW role names
  if (DEBUG) console.debug('🔍 Auto-assigning workflow roles based on userRole:', { userRole, level });
    
    if (userRole === 'BUDGET_PREPARER') {
      // STEP 1: BUDGET_PREPARER (no internal roles assigned - they just create proposals)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'BUDGET_REVIEWER') {
      // STEP 2: BUDGET_REVIEWER (no internal roles - they just review)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'BUDGET_APPROVER') {
      // STEP 3: BUDGET_APPROVER (no internal roles - they just approve)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'BUDGET_PLANNING_ANALYST') {
      // STEP 4: BUDGET_PLANNING_ANALYST (no internal roles - they provide technical analysis)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'BUDGET_OFFICER') {
      // STEP 5: BUDGET_OFFICER (no internal roles - they manage at officer level)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'OVERALL_BUDGET_APPROVER') {
      // STEP 6: OVERALL_BUDGET_APPROVER (no internal roles - they provide final approval)
      assignmentDoc.workflowRoles = [];
    } else if (userRole === 'BUDGET_ADMIN' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      // ADMIN roles have no internal workflow roles (full access overrides)
      assignmentDoc.workflowRoles = [];
    }
    
  if (DEBUG) console.debug('✅ Auto-assigned workflow roles:', assignmentDoc.workflowRoles);
  } else {
    // No userRole provided - start with empty (cannot auto-assign without role)
    assignmentDoc.workflowRoles = [];
  if (DEBUG) console.debug('⚠️ No userRole provided, workflow roles set to empty');
  }

  ensureApprovalFlagConsistency(assignmentDoc, sanitizedWorkflowRoles, normalizedLevel, hasExplicitWorkflowRoles);
}

/**
 * Guarantee `ApproveProposals` and `canApproveProposals` stay in sync.
 */
function ensureApprovalFlagConsistency(assignmentDoc, sanitizedWorkflowRoles, normalizedLevel, hasExplicitWorkflowRoles) {
  if (!assignmentDoc?.rolePermissions) {
    assignmentDoc.rolePermissions = {};
  }

  const level = normalizedLevel || assignmentDoc.assignmentLevel || '';
  const hasApprovalByLevel = APPROVAL_ENABLED_LEVELS.includes(level);
  const workflows = hasExplicitWorkflowRoles ? sanitizedWorkflowRoles : assignmentDoc.workflowRoles || [];
  const hasApprovalByWorkflow = Array.isArray(workflows) && workflows.some(role => APPROVAL_WORKFLOW_ROLES.has(role));

  const canApprove = Boolean(hasApprovalByLevel || hasApprovalByWorkflow);
  assignmentDoc.rolePermissions.ApproveProposals = canApprove;
  assignmentDoc.rolePermissions.canApproveProposals = canApprove;
}
