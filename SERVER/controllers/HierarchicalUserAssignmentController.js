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
const User = require('../models/User');
const mongoose = require('mongoose');
const { mainConnection } = require('../config/mongo_db');

// Import new workflow constants (September 2025 refactoring)
const { WORKFLOW_ROLES } = require('../constants/workflowConstants');
const DEBUG = process.env.DEBUG_LOGS === 'true';

const getNormalizedAuthenticatedUserIds = (user = {}) => {
  return [
    String(user?.Id || ''),
    String(user?.id || ''),
    String(user?.userId || ''),
    String(user?.UserId || ''),
    ...(Array.isArray(user?.Username) ? user.Username.map((value) => String(value || '')) : [String(user?.Username || '')]),
    ...(Array.isArray(user?.username) ? user.username.map((value) => String(value || '')) : [String(user?.username || '')]),
  ]
    .map((value) => value.trim())
    .filter((value) => value !== '');
};

const getCanonicalEmailFromRequestUser = (req = {}) => {
  const user = req?.user || {};
  const fromUser =
    user?.email ||
    user?.Email ||
    user?.userEmail ||
    user?.UserEmail ||
    user?.mail ||
    null;

  if (fromUser && String(fromUser).trim() !== '') {
    return String(fromUser).trim();
  }

  const fromHeaders =
    req?.headers?.['x-dev-email'] ||
    req?.headers?.['X-Dev-Email'] ||
    null;

  return fromHeaders && String(fromHeaders).trim() !== ''
    ? String(fromHeaders).trim()
    : null;
};

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

    // Historically this endpoint returned basic user info for the UI's lookup
    // field even for non-budget staff. Restricting it caused the UI to stop
    // auto-populating the User Name / Roles when typing a User ID.
    // Keep role detection for logging, but allow authenticated users to
    // perform a read-only lookup so the client can display basic info.
    const hasBudgetRole = currentUserRoles.some(role => roleHierarchy[role] !== undefined);
    const hasAdminRole = currentUserRoles.some(role => 
      role.includes('ADMIN') || role.includes('SUPER') || role.includes('MANAGER')
    );
    if (!hasBudgetRole && !hasAdminRole) {
      if (DEBUG) console.debug('ℹ️ Non-budget user performing user-lookup; allowing lookup for UI convenience', { userId: currentUserId, Roles: currentUserRoles });
      // Note: if you want to re-introduce stricter controls, gate this
      // behavior behind a configuration flag or require an explicit
      // permission in the future.
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
        if (DEBUG) console.debug('Processing role item:', roleItem, 'type:', typeof roleItem);
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
      // Email is not stored in assigned_roles; we'll try to enrich it from the budget DB's User collection below.
      roles: roleNames, // Return actual role names, not just IDs
      department: userData.department || userData.departmentName,
      division: userData.division || userData.divisionName,
      region: userData.region || userData.regionName
    };

    // 🔍 Try to enrich with the canonical email from the User collection (budget DB)
    try {
      const identifiers = [];
      const pushId = (v) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          identifiers.push(String(v).trim());
        }
      };
      // From assigned_roles
      pushId(userData.user);
      // From request param (in case of type differences)
      pushId(userId);

      if (identifiers.length > 0) {
        const stringIds = Array.from(new Set(identifiers.map((v) => String(v))));
        const numericIds = Array.from(
          new Set(
            stringIds
              .map((v) => {
                const n = Number(v);
                return Number.isNaN(n) ? null : n;
              })
              .filter((v) => v !== null)
          )
        );
        const allIds = [...stringIds, ...numericIds];

        const userDoc = await User.findOne({
          userId: { $in: allIds }
        }).lean();

        const niaEmail =
          userDoc?.email ||
          userDoc?.Email ||
          userDoc?.userEmail ||
          userDoc?.UserEmail ||
          null;

        if (niaEmail) {
          userInfo.email = niaEmail;
        }
      }
    } catch (emailErr) {
      if (DEBUG) {
        console.debug(
          'ℹ️ Failed to enrich user email from User collection in lookupUserFromMainDB:',
          emailErr?.message
        );
      }
    }

    // Determine the appropriate budget role based on user's main roles
    // Following the 6-step workflow hierarchy, but now supporting MULTIPLE LEGITIMATE ROLES
    //  ONLY accept these role names - 6-step workflow + 3 admin roles
    // Map ANY incoming role name to standardized versions ONLY (with underscores)
    let budgetRoles = []; // Array to hold multiple roles
    let primaryRole = 'BUDGET_PREPARER'; // default (STEP 1)

  if (DEBUG) console.debug(`🔍 User ${userId} roles from DB:`, roleNames);

    // Normalize for case-insensitive matching (FMIS may store "Budget Manager", "BUDGET MANAGER", etc.)
    const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const roleSet = new Set(roleNames.map(norm));

    const has = (...variants) => variants.some((v) => roleSet.has(norm(v)));

    if (has('SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN')) {
      budgetRoles.push('SUPER_ADMIN');
      primaryRole = 'SUPER_ADMIN';
    } else {
      // Check for OVERALL_BUDGET_APPROVER / BUDGET MANAGER first (highest budget role)
      if (has('OVERALL_BUDGET_APPROVER', 'OVERALL BUDGET APPROVER', 'BUDGET_MANAGER', 'BUDGET MANAGER')) {
        budgetRoles.push('OVERALL_BUDGET_APPROVER');
        primaryRole = 'OVERALL_BUDGET_APPROVER';
      }

      if (has('BUDGET OFFICER', 'BUDGET_OFFICER')) {
        budgetRoles.push('BUDGET_OFFICER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_OFFICER';
      }

      if (has('BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST')) {
        budgetRoles.push('BUDGET_PLANNING_ANALYST');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_PLANNING_ANALYST';
      }

      if (has('BUDGET APPROVER', 'BUDGET_APPROVER')) {
        budgetRoles.push('BUDGET_APPROVER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_APPROVER';
      }

      if (has('BUDGET REVIEWER', 'BUDGET_REVIEWER')) {
        budgetRoles.push('BUDGET_REVIEWER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_REVIEWER';
      }

      if (has('BUDGET PREPARER', 'BUDGET_PREPARER')) {
        budgetRoles.push('BUDGET_PREPARER');
      }

      // IMPORTANT:
      // ❌ Huwag nang mag-auto-assign ng default budget role (BUDGET_PREPARER)
      //     kapag wala talagang tugmang role sa `assigned_roles`.
      //     Ito ang nagdudulot na may lumalabas na role sa UI na hindi naman
      //     existing sa fmis_main.assigned_roles.
      //
      // ✅ Bagong behavior:
      //     - Kapag walang na-detect na 6-step workflow role, iwanan ang
      //       `budgetRoles` na empty array.
      //     - Sa UI, makikita pa rin ang "FMIS Main System Roles" (raw roles),
      //       pero ang "Determined Budget Roles" / selectable workflow roles
      //       ay magiging blank maliban kung may totoong mapping.
      //
      // Kung kailangan ng fallback sa hinaharap, dapat ito ay i-configure
      // nang malinaw at hindi basta-basta nag-a-assign ng role na wala sa DB.
    }

  if (DEBUG) console.debug(`📋 Determined budgetRoles for user ${userId}:`, budgetRoles, `primaryRole: ${primaryRole}`);

    // Only expose budget-related roles to the UI (exclude CASH CHECK PREPARER, etc.)
    const BUDGET_ROLE_PATTERNS = [
      'SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'BUDGET ADMIN', 'BUDGET_ADMIN', 'BUDGET ANALYST', 'BUDGET_ANALYST',
      'OVERALL BUDGET APPROVER', 'OVERALL_BUDGET_APPROVER', 'BUDGET MANAGER', 'BUDGET_MANAGER',
      'BUDGET OFFICER', 'BUDGET_OFFICER', 'BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST',
      'BUDGET APPROVER', 'BUDGET_APPROVER', 'BUDGET REVIEWER', 'BUDGET_REVIEWER', 'BUDGET PREPARER', 'BUDGET_PREPARER'
    ];
    const normalizeForMatch = (name) => String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
    userInfo.roles = roleNames; // keep full list for internal use if needed
    userInfo.budgetRelevantRoles = roleNames.filter((r) => {
      const n = normalizeForMatch(r);
      return BUDGET_ROLE_PATTERNS.some((p) => normalizeForMatch(p) === n || n.includes(p.replace(/_/g, ' ')));
    });
    if (userInfo.budgetRelevantRoles.length === 0 && roleNames.length > 0) {
      userInfo.budgetRelevantRoles = roleNames.filter((r) =>
        /BUDGET|ADMIN|SUPER|APPROVER|REVIEWER|PREPARER|ANALYST|OFFICER/i.test(String(r))
      );
    }

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

    // NEW: Check if officeId/effectiveDepartmentId is actually a regionId (direct Region assignment)
    // This supports assigning users to a "Full Region" from the Office Level selection
    if (normalizedEffectiveLevel === 'OFFICE' && effectiveDepartmentId) {
      // If we received an officeId with an underscore, it is DEFINITELY a department mapping, NEVER a full region
      const isCompositeOfficeId = req.body.officeId && String(req.body.officeId).includes('_');
      // If the frontend explicitly sent a regionId that differs from departmentId, it's a department mapping
      const hasDifferentRegion = regionId && String(regionId) !== String(effectiveDepartmentId);
      
      if (!isCompositeOfficeId && !hasDifferentRegion) {
        // Only then do we fallback to checking the DB
        try {
          // Only query if it's a valid ObjectId to prevent CastError
          if (mongoose.Types.ObjectId.isValid(effectiveDepartmentId)) {
            const isActuallyRegion = await Region.exists({ _id: effectiveDepartmentId });
            if (isActuallyRegion) {
              if (DEBUG) console.debug('📍 Office ID detected as Region ID, switching to REGION level');
              modelAssignmentLevel = 'REGION';
            }
          }
        } catch (e) {
          // Ignore CastError if it's not an ObjectId
        }
      }
    }

    if (!userId || !userName || !email || !normalizedEffectiveLevel) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userName, email, assignmentLevel/accessScope',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    // Validate assignment level (BUDGET_AND_REVENUE_DIVISION for BPA, BUDGET_OFFICER, OVERALL_BUDGET_APPROVER)
    const validLevels = ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL', 'OWN_ONLY', 'RESPONSIBILITY_CENTER', 'OFFICE', 'BUDGET_AND_REVENUE_DIVISION'];
    if (!validLevels.includes(normalizedEffectiveLevel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid assignment level. Must be one of: ${validLevels.join(', ')}`,
        code: 'INVALID_ASSIGNMENT_LEVEL'
      });
    }

    // Build hierarchical assignment based on level
    // For BUDGET_PLANNING_ANALYST with BUDGET_AND_REVENUE_DIVISION, department/division are optional (assignedRegions drives access)
    let assignmentData;
    if (normalizedEffectiveLevel === 'BUDGET_AND_REVENUE_DIVISION') {
      assignmentData = { success: true, regions: [], departments: [], divisions: [], hierarchicalStructure: { level: 'BUDGET_AND_REVENUE_DIVISION', consolidatesTo: 'BUDGET_AND_REVENUE_DIVISION' } };
    } else {
      if (DEBUG) console.debug('🔍 Building hierarchical assignment with:', {
        assignmentLevel: modelAssignmentLevel,
        regionId: modelAssignmentLevel === 'REGION' ? effectiveDepartmentId : regionId,
        departmentId: modelAssignmentLevel === 'REGION' ? null : effectiveDepartmentId,
        divisionName: effectiveDivisionName
      });
      assignmentData = await buildHierarchicalAssignment({
        assignmentLevel: modelAssignmentLevel,
        regionId: modelAssignmentLevel === 'REGION' ? effectiveDepartmentId : regionId,
        departmentId: modelAssignmentLevel === 'REGION' ? null : effectiveDepartmentId,
        divisionName: effectiveDivisionName
      });
      if (!assignmentData.success) {
        console.error('❌ Failed to build hierarchical assignment:', assignmentData);
        return res.status(400).json(assignmentData);
      }
    }
    
  if (DEBUG) console.debug('✅ Hierarchical assignment built successfully:', assignmentData);
    // Find existing assignment or create new one
    let assignment = await HierarchicalUserAssignment.findOne({ userId, isActive: true });

    const approvalLevels = ['REGION', 'FULL', 'OFFICE', 'RESPONSIBILITY_CENTER', 'BUDGET_AND_REVENUE_DIVISION'];
    
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
    
    // Try to override email with the canonical value from User collection when available
    let resolvedEmail = email;
    try {
      const idCandidates = [];
      const pushId = (v) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          idCandidates.push(String(v).trim());
        }
      };
      pushId(userId);
      const stringIds = Array.from(new Set(idCandidates.map((v) => String(v))));
      const numericIds = Array.from(
        new Set(
          stringIds
            .map((v) => {
              const n = Number(v);
              return Number.isNaN(n) ? null : n;
            })
            .filter((v) => v !== null)
        )
      );
      const allIds = [...stringIds, ...numericIds];
      if (allIds.length > 0) {
        const userDoc = await User.findOne({ userId: { $in: allIds } }).lean();
        const canonicalEmail =
          userDoc?.email ||
          userDoc?.Email ||
          userDoc?.userEmail ||
          userDoc?.UserEmail ||
          null;
        if (canonicalEmail) {
          resolvedEmail = canonicalEmail;
        }
      }
    } catch (emailResolveErr) {
      if (DEBUG) {
        console.debug(
          'ℹ️ Failed to resolve canonical email in createOrUpdateHierarchicalAssignment:',
          emailResolveErr?.message
        );
      }
    }

    const assignmentPayload = {
      userId,
      userName,
      email: resolvedEmail,
      // NEW: Support multiple roles from FMIS main system
      userRoles: req.body.userRoles || [], // Array of roles from FMIS main
      // Keep backward compatibility - primary role (highest in hierarchy)
      userRole: userRole || undefined,
      assignmentLevel: modelAssignmentLevel,
      regionId: assignmentData.regions?.[0] || null,
      departmentId: assignmentData.departments?.[0] || null,
      divisionName: assignmentData.divisions?.[0] || null,
      regions: assignmentData.regions || [],
      departments: assignmentData.departments || [],
      divisions: assignmentData.divisions || [],
      hierarchicalStructure: assignmentData.hierarchicalStructure,
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
    const authenticatedUserIds = getNormalizedAuthenticatedUserIds(req.user);
    const requestUserEmail = getCanonicalEmailFromRequestUser(req);
    
    const isOwnAssignment = authenticatedUserIds.includes(String(userId));
    
    if (!hasFullAccess(currentUserRoles) && !isOwnAssignment) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own assignment.',
        code: 'ACCESS_DENIED'
      });
    }
    let assignment = await HierarchicalUserAssignment
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
    
    // Ensure assignment email stays in sync with the latest canonical email.
    // Priority 1: authenticated request user's email when accessing own assignment.
    // Priority 2: latest User collection email.
    try {
      let latestEmail = null;

      if (isOwnAssignment && requestUserEmail) {
        latestEmail = requestUserEmail;
      } else {
        const userDoc = await User.findOne({
          userId: {
            $in: [
              String(userId),
              Number(userId),
            ].filter(v => v !== undefined && v !== null && String(v).trim() !== '' && !Number.isNaN(v))
          }
        }).lean();

        latestEmail =
          userDoc?.email ||
          userDoc?.Email ||
          userDoc?.userEmail ||
          userDoc?.UserEmail ||
          null;
      }

      if (latestEmail && latestEmail !== assignment.email) {
        // Update in-memory assignment (for current response)
        assignment.email = latestEmail;
        // Persist to DB without blocking the main response flow
        HierarchicalUserAssignment.updateOne(
          { userId },
          { $set: { email: latestEmail } }
        ).catch(err => {
          console.warn('Failed to sync HierarchicalUserAssignment email:', err.message);
        });
      }
    } catch (syncErr) {
      console.warn('Email sync check failed in getHierarchicalAssignment:', syncErr.message);
    }
    
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
    let userRoles = req.user.Roles || [];

    // If userRoles is empty, try to enrich from fmis_main.assigned_roles (main DB)
    if ((!userRoles || userRoles.length === 0) && req.user) {
      try {
        const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
        const Role = mainConnection.model('roles', new mongoose.Schema({}, { strict: false }), 'roles');
        const queryUser = req.user.id || req.user.userId || req.user.user || req.user.username;
        if (queryUser) {
          const assignedDoc = await AssignedRole.findOne({
            $or: [ { user: queryUser }, { user: parseInt(queryUser) } ]
          }).lean();
          if (assignedDoc && assignedDoc.roles && assignedDoc.roles.length > 0) {
            const roleNames = [];
            for (const roleItem of assignedDoc.roles) {
              if (roleItem && roleItem._bsontype === 'ObjectId') {
                const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
                if (roleDoc && roleDoc.name) roleNames.push(roleDoc.name);
              } else if (typeof roleItem === 'string') {
                if (roleItem.match(/^[0-9a-fA-F]{24}$/)) {
                  const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
                  if (roleDoc && roleDoc.name) roleNames.push(roleDoc.name);
                } else {
                  roleNames.push(roleItem);
                }
              } else if (roleItem && typeof roleItem === 'object' && roleItem.name) {
                roleNames.push(roleItem.name);
              }
            }
            if (roleNames.length > 0) {
              req.user.Roles = roleNames;
              userRoles = req.user.Roles;
              if (DEBUG) console.debug('🔁 Augmented req.user.Roles from main DB for user', queryUser, userRoles);
            }
          }
        }
      } catch (augmentErr) {
        if (DEBUG) console.warn('Failed to augment user roles from main DB:', augmentErr.message);
      }
    }
    
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
      .find({})
      .populate('regionId', 'Region regionName RegionName RegionCode _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id')
      .sort({ assignmentLevel: 1, userName: 1 })
      .lean();

    const authenticatedUserIds = new Set(getNormalizedAuthenticatedUserIds(req.user));
    const requestUserEmail = getCanonicalEmailFromRequestUser(req);

    // Build canonical email lookup map from User collection (synced from auth/get-user)
    const canonicalEmailsByUserId = new Map();
    try {
      const stringIds = Array.from(
        new Set(
          assignments
            .map((assignment) => String(assignment?.userId || '').trim())
            .filter((id) => id.length > 0)
        )
      );
      const numericIds = Array.from(
        new Set(
          stringIds
            .map((id) => {
              const parsed = Number(id);
              return Number.isNaN(parsed) ? null : parsed;
            })
            .filter((id) => id !== null)
        )
      );
      const allIds = [...stringIds, ...numericIds];

      if (allIds.length > 0) {
        const users = await User.find(
          { userId: { $in: allIds } },
          { userId: 1, email: 1, Email: 1, userEmail: 1, UserEmail: 1 }
        ).lean();

        users.forEach((userDoc) => {
          const canonicalEmail =
            userDoc?.email ||
            userDoc?.Email ||
            userDoc?.userEmail ||
            userDoc?.UserEmail ||
            null;

          const normalizedUserId = String(userDoc?.userId || '').trim();
          if (!canonicalEmail || !normalizedUserId) return;

          canonicalEmailsByUserId.set(normalizedUserId, canonicalEmail);

          const numericVariant = Number(normalizedUserId);
          if (!Number.isNaN(numericVariant)) {
            canonicalEmailsByUserId.set(String(numericVariant), canonicalEmail);
          }
        });
      }
    } catch (emailLookupErr) {
      console.warn('Canonical email lookup failed in getAllHierarchicalAssignments:', emailLookupErr?.message);
    }

    const pendingEmailSyncWrites = [];
    // Add consolidation info to each assignment
    const assignmentsWithConsolidation = await Promise.all(
      assignments.map(async (assignment) => {
        try {
          const assignmentDoc = await HierarchicalUserAssignment.findById(assignment._id);
          const consolidationInfo = assignmentDoc ? assignmentDoc.getConsolidationTarget() : null;
          const normalizedAssignmentUserId = String(assignment?.userId || '').trim();
          const canonicalEmail = normalizedAssignmentUserId
            ? canonicalEmailsByUserId.get(normalizedAssignmentUserId)
            : null;
          const isOwnAssignment = authenticatedUserIds.has(normalizedAssignmentUserId);
          const resolvedEmail = (isOwnAssignment && requestUserEmail) || canonicalEmail || assignment.email;

          if (resolvedEmail && resolvedEmail !== assignment.email) {
            pendingEmailSyncWrites.push({
              updateOne: {
                filter: { _id: assignment._id },
                update: { $set: { email: resolvedEmail } }
              }
            });
          }
          
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
            email: resolvedEmail,
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
            email: (authenticatedUserIds.has(String(assignment?.userId || '').trim()) && requestUserEmail) || canonicalEmailsByUserId.get(String(assignment?.userId || '').trim()) || assignment.email,
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

    if (pendingEmailSyncWrites.length > 0) {
      HierarchicalUserAssignment.bulkWrite(pendingEmailSyncWrites, { ordered: false }).catch((syncErr) => {
        console.warn('Failed to persist canonical email sync for assignments list:', syncErr?.message);
      });
    }
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
    const assignment = await HierarchicalUserAssignment.findOne({ userId });
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
    const assignment = await HierarchicalUserAssignment.findOne({ userId });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Hierarchical assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }
    await HierarchicalUserAssignment.deleteOne({ userId });
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
const buildHierarchicalAssignment = async ({
  assignmentLevel,
  regionId,
  departmentId,
  divisionName,
  isActuallyRegion = false
}) => {
  try {
    let regions = [];
    let departments = [];
    let divisions = [];
    let hierarchicalStructure = {};
    switch (assignmentLevel) {
      case 'DIVISION': {
        // Division assignment requires department and division
        if (!departmentId || !divisionName) {
          return {
            success: false,
            message: 'Division assignment requires departmentId, and divisionName',
            code: 'MISSING_DIVISION_REQUIREMENTS'
          };
        }
        // Validate department exists
        const department = await Department.findById(departmentId);
        let region = null;
        if (regionId) {
          region = await Region.findById(regionId);
        }
        
        if (!department || (regionId && !region)) {
          return {
            success: false,
            message: 'Invalid region or department ID',
            code: 'INVALID_REGION_DEPARTMENT'
          };
        }
        
        regions = regionId ? [regionId] : [];
        departments = [departmentId];
        divisions = [divisionName];
        hierarchicalStructure = {
          level: 'DIVISION',
          division: divisionName,
          department: department.Department,
          region: region ? region.Region : 'All Regions',
          consolidatesTo: 'DEPARTMENT',
          ultimateRegion: region ? region.Region : 'All Regions'
        };
        break;
      }
      case 'DEPARTMENT': {
        // Department assignment requires department
        if (!departmentId) {
          return {
            success: false,
            message: 'Department assignment requires departmentId',
            code: 'MISSING_DEPARTMENT_REQUIREMENTS'
          };
        }
        
        if (isActuallyRegion) {
          const deptRegion = await Region.findById(departmentId);
          if (!deptRegion) {
            return {
              success: false,
              message: 'Invalid region ID',
              code: 'INVALID_REGION'
            };
          }
          regions = [departmentId];
          departments = [departmentId]; // Use regionId as departmentId to pass schema validation for DEPARTMENT_REGIONAL_LEVEL
          divisions = [];
          hierarchicalStructure = {
            level: 'DEPARTMENT',
            department: 'FULL REGION',
            region: deptRegion.Region,
            consolidatesTo: 'REGION',
            ultimateRegion: deptRegion.Region
          };
          break;
        }

        let assignedDepartment = await Department.findById(departmentId).catch(() => null);
        
        // If not found with findById (maybe it's a Number ID), try native find
        if (!assignedDepartment && !mongoose.Types.ObjectId.isValid(departmentId)) {
          const rawDept = await mongoose.connection.db.collection('departments').findOne({
            $or: [
              { _id: departmentId },
              { _id: Number(departmentId) }
            ]
          }).catch(() => null);
          if (rawDept) {
            assignedDepartment = new Department(rawDept);
            assignedDepartment.isNew = false;
          }
        }

        let deptRegion = null;
        if (regionId) {
          deptRegion = await Region.findById(regionId).catch(() => null);
          if (!deptRegion && !mongoose.Types.ObjectId.isValid(regionId)) {
            const rawRegion = await mongoose.connection.db.collection('regions').findOne({
              $or: [
                { _id: regionId },
                { _id: Number(regionId) }
              ]
            }).catch(() => null);
            if (rawRegion) {
              deptRegion = new Region(rawRegion);
              deptRegion.isNew = false;
            }
          }
        }
        
        if (!assignedDepartment || (regionId && !deptRegion)) {
          return {
            success: false,
            message: 'Invalid region or department ID',
            code: 'INVALID_REGION_DEPARTMENT'
          };
        }
        
        regions = regionId ? [regionId] : [];
        departments = [departmentId];
        divisions = [];
        hierarchicalStructure = {
          level: 'DEPARTMENT',
          department: assignedDepartment.Department,
          region: deptRegion ? deptRegion.Region : 'All Regions',
          consolidatesTo: deptRegion ? 'REGION' : 'FULL',
          ultimateRegion: deptRegion ? deptRegion.Region : 'All Regions'
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

        // NEW: Prioritize the provided regionId if available
        let rcRegionId = regionId;
        
        // Find region from department mappings if not provided
        if (!rcRegionId) {
          const deptMappings = await DepartmentDivisionMapping.find({ departmentId: departmentId });
          if (deptMappings.length > 0) {
            const firstMapping = deptMappings[0];
            if (firstMapping.regionIds && firstMapping.regionIds.length > 0) {
              const region = await Region.findById(firstMapping.regionIds[0]);
              if (region) {
                rcRegionId = firstMapping.regionIds[0];
              }
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

        // NEW: Prioritize the provided regionId if available
        let officeRegionId = regionId;

        // Find region from department mappings if not provided
        if (!officeRegionId) {
          const officeDeptMappings = await DepartmentDivisionMapping.find({ departmentId: departmentId });
          if (officeDeptMappings.length > 0) {
            const firstMapping = officeDeptMappings[0];
            if (firstMapping.regionIds && firstMapping.regionIds.length > 0) {
              const region = await Region.findById(firstMapping.regionIds[0]);
              if (region) {
                officeRegionId = firstMapping.regionIds[0];
              }
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
/**
 * Update the active status of a hierarchical assignment
 */
const updateAssignmentStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const adminUserRoles = req.user.Roles;
    
    if (!hasFullAccess(adminUserRoles)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        code: 'ADMIN_REQUIRED'
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isActive status is required'
      });
    }

    const assignment = await HierarchicalUserAssignment.findOneAndUpdate(
      { userId },
      { $set: { isActive, lastModifiedBy: req.user.id } },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Assignment status updated to ${isActive ? 'Active' : 'Inactive'}`,
      assignment
    });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating assignment status',
      error: error.message
    });
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
  lookupUserFromMainDB,
  updateAssignmentStatus
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
