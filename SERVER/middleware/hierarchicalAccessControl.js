/**
 * 🏢 Hierarchical Access Control Middleware
 * 
 * This middleware implements the hierarchical consolidation system where:
 * - Division users' proposals save to their Department records
 * - Department users' proposals save to their Region records
 * - Region users save directly to their Region
 * 
 * Hierarchy: Division → Department → Region
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');
const { hasFullAccess } = require('./securityMiddleware');
/**
 * Main hierarchical access control middleware
 * @param {string} operation - The operation type: 'create', 'read', 'update', 'delete'
 * @param {object} options - Additional options
 */
const hierarchicalAccessControl = (operation = 'read', options = {}) => {
  const { 
    strictMode = false, 
    logAccess = true, 
    enableConsolidation = true 
  } = options;
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      const userName = req.user.username || req.user.name || `User-${userId}`;
      if (logAccess) {
        // Logging removed as requested
      }
      // Full access users no longer bypass hierarchical restrictions; they still follow assigned scope
      if (hasFullAccess(userRoles)) {
        // SUPER ADMIN gets full access regardless of assignment
        if (userRoles.includes('SUPER_ADMIN')) {
          req.hierarchicalAccess = {
            scope: 'FULL',
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            canRead: true,
            canAccessAllRegions: true,
            canAccessAllDepartments: true,
            canAccessAllDivisions: true,
            filters: {} // No filters for SUPER ADMIN
          };
          return next();
        }
        if (logAccess) {
          // Logging removed as requested
        }
        // Do not return here; continue to load assignment
      }
      // Get user's hierarchical assignments
      const assignment = await HierarchicalUserAssignment.getUserPermissions(userId, req.user?.Roles);
      if (!assignment || assignment.assignmentLevel === 'NONE') {
        if (strictMode) {
          return res.status(403).json({
            message: 'Access denied. No organizational assignments found.',
            code: 'NO_ORG_ASSIGNMENT'
          });
        }
        // Allow but with own-only restrictions
        req.hierarchicalAccess = {
          scope: 'OWN_ONLY',
          canCreate: operation === 'create',
          filters: { createdBy: userId }
        };
        return next();
      }
      // Get consolidation information
      const consolidationInfo = assignment.getConsolidationTarget();
      // const effectiveRegion = assignment.getEffectiveRegion(); // Not implemented; avoid calling
      // Handle different operations
      switch (operation) {
        case 'read':
          return handleHierarchicalRead(req, res, next, assignment, consolidationInfo, { logAccess, userName });
        case 'create':
        case 'update':
        case 'delete':
          return handleHierarchicalWrite(req, res, next, assignment, consolidationInfo, operation, { 
            strictMode, 
            logAccess, 
            userName,
            enableConsolidation 
          });
        default:
          return res.status(400).json({ 
            message: 'Invalid operation type for hierarchical access control',
            code: 'INVALID_OPERATION'
          });
      }
    } catch (error) {
      console.error('🚨 Hierarchical Access Control Error:', error);
      return res.status(500).json({ 
        message: 'Internal server error in hierarchical access control',
        code: 'HIERARCHICAL_INTERNAL_ERROR'
      });
    }
  };
};
/**
 * Handle read operations with hierarchical filtering
 */
const handleHierarchicalRead = async (req, res, next, assignment, consolidationInfo, options) => {
  const { logAccess, userName } = options;
  // Build hierarchical filters based on user's assignment level
  let hierarchicalFilters = {};
  switch (assignment.assignmentLevel) {
    case 'DIVISION':
      // Division users can only access their specific division data
      hierarchicalFilters = {
        $and: [
          { region: assignment.regions[0]?.regionName },
          { department: assignment.departments[0]?.departmentName },
          { division: assignment.divisions[0] }
        ]
      };
      break;
    case 'DEPARTMENT':
      // Department users can access all divisions within their department
      hierarchicalFilters = {
        $and: [
          { region: assignment.regions[0]?.regionName },
          { department: assignment.departments[0]?.departmentName }
        ]
      };
      break;
    case 'REGION':
      // Region users can access all departments and divisions within their region
      hierarchicalFilters = {
        region: assignment.regions[0]?.regionName
      };
      break;
    case 'FULL':
      // Full access users can access everything, but if they have specific region assignments,
      // they should still be filtered to those regions (for better data isolation)
      if (assignment.regions && assignment.regions.length > 0) {
        hierarchicalFilters = {
          region: { $in: assignment.regions.map(r => r.regionName) }
        };
      } else {
        hierarchicalFilters = {};
      }
      break;
    default:
      // Default to own records only
      hierarchicalFilters = {
        userId: assignment.userId
      };
  }
  // Prune filters based on allowed fields (e.g., modules without department/division)
  const allowed = options?.allowedFields;
  if (Array.isArray(allowed) && allowed.length > 0) {
    const prune = (obj) => {
      const out = {};
      for (const key of Object.keys(obj)) {
        if (key === '$and' && Array.isArray(obj.$and)) {
          const prunedArray = obj.$and
            .map(cond => prune(cond))
            .filter(cond => Object.keys(cond).length > 0);
          if (prunedArray.length > 0) out.$and = prunedArray;
        } else if (allowed.includes(key)) {
          out[key] = obj[key];
        }
      }
      return out;
    };
    hierarchicalFilters = prune(hierarchicalFilters);
  }
  req.hierarchicalFilters = hierarchicalFilters;
  req.hierarchicalAccess = {
    scope: assignment.assignmentLevel,
    consolidationInfo,
    accessibleRegions: assignment.regions || [],
    accessibleDepartments: assignment.departments || [],
    accessibleDivisions: assignment.divisions || [],
    rolePermissions: assignment.rolePermissions
  };
  if (logAccess) {
    }
  next();
};
/**
 * Handle write operations with hierarchical consolidation
 */
const handleHierarchicalWrite = async (req, res, next, assignment, consolidationInfo, operation, options) => {
  const { strictMode, logAccess, userName, enableConsolidation } = options;
  // Check operation permissions (relaxed when strictMode is false)
  let canPerformOperation = true;
  if (strictMode) {
    const permissions = assignment.rolePermissions || {};
    switch (operation) {
      case 'create':
        canPerformOperation = permissions.canCreateProposals !== false;
        break;
      case 'update':
        canPerformOperation = permissions.canEditOwnProposals !== false || permissions.canEditAllProposals === true;
        break;
      case 'delete':
        canPerformOperation = permissions.canDeleteProposals === true;
        break;
    }
    if (!canPerformOperation) {
      if (logAccess) {
        // Logging removed as requested
      }
      return res.status(403).json({
        message: `Access denied. You don't have permission to perform ${operation} operations`,
        code: 'INSUFFICIENT_PERMISSIONS',
        operation,
        requiredPermissions: getRequiredPermissionsForOperation(operation)
      });
    }
  }
  // Apply hierarchical consolidation for create/update operations
  if (enableConsolidation && (operation === 'create' || operation === 'update')) {
    applyHierarchicalConsolidation(req, assignment, consolidationInfo);
  }
  // Validate that user can access the target organizational units (relaxed when strictMode is false)
  const isValidAccess = await validateHierarchicalAccess(req, assignment);
  if (!isValidAccess) {
    if (strictMode) {
      if (logAccess) {
        }
      return res.status(403).json({
        message: `Access denied. You cannot ${operation} data outside your assigned organizational units`,
        code: 'INVALID_HIERARCHICAL_ACCESS',
        operation,
        userLevel: assignment.assignmentLevel,
        allowedRegions: assignment.regions?.map(r => r.regionName) || [],
        allowedDepartments: assignment.departments?.map(d => d.departmentName) || [],
        allowedDivisions: assignment.divisions || []
      });
    } else if (logAccess) {
      }
  }
  req.hierarchicalAccess = {
    scope: assignment.assignmentLevel,
    consolidationInfo,
    originalData: { ...req.body }, // Store original before consolidation
    rolePermissions: assignment.rolePermissions
  };
  if (logAccess) {
    // Logging removed as requested
  }
  next();
};
/**
 * Apply hierarchical consolidation to request data
 */
const applyHierarchicalConsolidation = (req, assignment, consolidationInfo) => {
  // Prefer names for identifiers as per project standard
  const regionName = assignment?.regions?.[0]?.regionName || req.body.region || null;
  const departmentName = assignment?.departments?.[0]?.departmentName || req.body.department || null;
  const divisionName = assignment?.divisions?.[0] || req.body.division || null;
  // Store original organizational context
  req.originalOrgContext = {
    region: req.body.region,
    department: req.body.department,
    division: req.body.division
  };
  // Apply consolidation based on user's assignment level
  switch (assignment.assignmentLevel) {
    case 'DIVISION':
      // Division submissions consolidate to Department level (names)
      req.body.originalLevel = 'DIVISION';
      req.body.originalDivision = divisionName;
      req.body.division = divisionName; // persist division for filtering
      req.body.department = departmentName; // Consolidate to department name
      req.body.region = regionName; // Ensure region name is set
      req.body.consolidatedFrom = 'DIVISION';
      break;
    case 'DEPARTMENT':
      // Department submissions consolidate to Region level (names)
      req.body.originalLevel = 'DEPARTMENT';
      req.body.originalDepartment = departmentName;
      req.body.department = departmentName; // persist department on record for filtering
      req.body.region = regionName; // Consolidate to region name
      req.body.consolidatedFrom = 'DEPARTMENT';
      break;
    case 'REGION':
      // Region submissions stay at region level (names)
      req.body.originalLevel = 'REGION';
      req.body.region = regionName || req.body.region || null;
      break;
  }
  // Add consolidation metadata
  req.body.consolidationMetadata = {
    submittedBy: req.user.id,
    submittedByLevel: assignment.assignmentLevel,
    submissionTimestamp: new Date(),
    consolidationApplied: true, // Using name-based consolidation
    originalContext: req.originalOrgContext,
    consolidatedContext: {
      region: req.body.region,
      department: req.body.department,
      division: req.body.division
    }
  };
};
/**
 * Validate hierarchical access permissions
 */
const validateHierarchicalAccess = async (req, assignment) => {
  const { region, department, division } = req.body;
  // Check region access if region is specified
  if (region) {
    const hasRegionAccess = assignment.hasRegionAccess(region);
    if (!hasRegionAccess) {
      return false;
    }
  }
  // Check department access if department is specified
  if (department) {
    const hasDepartmentAccess = assignment.hasDepartmentAccess(department);
    if (!hasDepartmentAccess) {
      return false;
    }
  }
  // Check division access if division is specified
  if (division) {
    const hasDivisionAccess = assignment.hasDivisionAccess(division);
    if (!hasDivisionAccess) {
      return false;
    }
  }
  return true;
};
/**
 * Get required permissions for operation
 */
const getRequiredPermissionsForOperation = (operation) => {
  switch (operation) {
    case 'create':
      return ['canCreateProposals'];
    case 'update':
      return ['canEditOwnProposals', 'canEditAllProposals'];
    case 'delete':
      return ['canDeleteProposals'];
    default:
      return [];
  }
};
/**
 * Convenience wrapper for strict hierarchical control
 */
const strictHierarchicalControl = (operation, options = {}) => {
  return hierarchicalAccessControl(operation, { 
    strictMode: true, 
    logAccess: true, 
    enableConsolidation: true,
    ...options 
  });
};
/**
 * Middleware to get user's hierarchical access information
 */
const getHierarchicalAccessInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.Roles;
    
    // 🔥 SUPER ADMIN gets FULL scope immediately - bypass all database checks
    if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
      req.hierarchicalAccessInfo = {
        scope: 'FULL',
        hasFullAccess: true,
        canAccessAllRegions: true,
        canAccessAllDepartments: true,
        canAccessAllDivisions: true,
        accessibleRegions: [],
        accessibleDepartments: [],
        accessibleDivisions: [],
        consolidationInfo: null,
        rolePermissions: {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: true,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: true,
          ManageSettings: true
        },
        workflowRoles: ['divisionCreator', 'divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier', 'regionCreator', 'superAdmin', 'regionFinalVerifier'],
        restrictions: null
      };
      return next();
    }
    
    // Load the hierarchical assignment (single source of truth)
    let assignmentDoc = await HierarchicalUserAssignment
      .findOne({ userId, isActive: true })
      .populate('regionId', 'regionName RegionName Region')
      .populate('departmentId', 'Department departmentName DepartmentName');
    // Fallback: handle potential type mismatches (numeric vs string userId)
    if (!assignmentDoc) {
      try {
        const mongoose = require('mongoose');
        const raw = await mongoose.connection.db
          .collection('hierarchicaluserassignments')
          .findOne({
            isActive: true,
            userId: { $in: [userId, Number(userId), String(userId), String(userId).trim ? String(userId).trim() : String(userId)] }
          });
        if (raw?._id) {
          assignmentDoc = await HierarchicalUserAssignment
            .findById(raw._id)
            .populate('regionId', 'regionName RegionName Region')
            .populate('departmentId', 'Department departmentName DepartmentName');
        }
      } catch (e) {
        console.warn('⚠️ Hierarchical assignment fallback lookup failed:', e?.message);
      }
    }
    // If user has a full-access role, prefer returning concrete assignments when available
    if (hasFullAccess(userRoles)) {
      if (assignmentDoc) {
        const consolidationInfo = assignmentDoc.getConsolidationTarget();
        const accessibleRegions = assignmentDoc.regionId
          ? [{ _id: assignmentDoc.regionId._id, regionName: assignmentDoc.regionId.regionName || assignmentDoc.regionId.RegionName || assignmentDoc.regionId.Region }]
          : [];
        const accessibleDepartments = assignmentDoc.departmentId
          ? [{ _id: assignmentDoc.departmentId._id, departmentName: assignmentDoc.departmentId.Department || assignmentDoc.departmentId.departmentName || assignmentDoc.departmentId.DepartmentName || null }]
          : [];
        const accessibleDivisions = assignmentDoc.divisionName ? [assignmentDoc.divisionName] : [];
        
        // Auto-assign workflow roles based on user's main system roles if not already set
        let workflowRoles = assignmentDoc.workflowRoles || [];
        if (!workflowRoles || workflowRoles.length === 0) {
          // Determine workflow roles based on user's main roles
          const userMainRoles = userRoles || [];
          if (userMainRoles.includes('BUDGET PREPARER')) {
            // BUDGET PREPARER: Division or Office creator based on assignment level
            if (assignmentDoc.assignmentLevel === 'DIVISION' || assignmentDoc.assignmentLevel === 'RESPONSIBILITY_CENTER') {
              workflowRoles = ['divisionCreator'];
            } else if (assignmentDoc.assignmentLevel === 'OFFICE' || assignmentDoc.assignmentLevel === 'DEPARTMENT') {
              workflowRoles = ['officeCreator'];
            } else {
              workflowRoles = ['divisionCreator']; // Default to division creator
            }
          } else if (userMainRoles.includes('BUDGET REVIEWER')) {
            // BUDGET REVIEWER: Division reviewer
            workflowRoles = ['divisionReviewer'];
          } else if (userMainRoles.includes('APPROVER')) {
            // APPROVER: Division or Office approver based on assignment level
            if (assignmentDoc.assignmentLevel === 'DIVISION' || assignmentDoc.assignmentLevel === 'RESPONSIBILITY_CENTER') {
              workflowRoles = ['divisionApprover'];
            } else if (assignmentDoc.assignmentLevel === 'OFFICE' || assignmentDoc.assignmentLevel === 'DEPARTMENT') {
              workflowRoles = ['officeApprover'];
            } else {
              workflowRoles = ['divisionApprover']; // Default to division approver
            }
          } else if (userMainRoles.includes('BUDGET_PLANNING_ANALYST')) {
            // BUDGET_PLANNING_ANALYST: Budget planning analyst (from Budget and Revenue Division)
            workflowRoles = ['budgetAnalyst'];
          } else if (userMainRoles.includes('BUDGET_OFFICER') || userMainRoles.includes('SUPERVISOR')) {
            workflowRoles = ['officeFinalVerifier'];
          } else if (userMainRoles.includes('OVERALL_BUDGET_APPROVER') || userMainRoles.includes('DEPARTMENT_HEAD')) {
            workflowRoles = ['departmentConsolidator', 'regionFinalVerifier'];
          } else if (userMainRoles.includes('BUDGET_ADMIN') || userMainRoles.includes('SUPER ADMIN') || userMainRoles.includes('SUPER_ADMIN') || userMainRoles.includes('ADMIN')) {
            workflowRoles = ['divisionCreator', 'divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier', 'regionCreator', 'superAdmin','regionFinalVerifier'];
          }
          
          // Update the assignment document with auto-assigned workflow roles
          if (workflowRoles.length > 0) {
            assignmentDoc.workflowRoles = workflowRoles;
            assignmentDoc.save().catch(err => console.warn('Failed to save auto-assigned workflow roles:', err.message));
          }
        }
        
        // Ensure BUDGET_PLANNING_ANALYST role is included in workflowRoles if user has BUDGET_PLANNING_ANALYST role
        if (userRoles.includes('BUDGET_PLANNING_ANALYST') && !workflowRoles.includes('budgetAnalyst')) {
          workflowRoles = [...workflowRoles, 'budgetAnalyst'];
          // Update the assignment document
          assignmentDoc.workflowRoles = workflowRoles;
          assignmentDoc.save().catch(err => console.warn('Failed to save budgetAnalyst role:', err.message));
        }
        
        // Ensure rolePermissions are set based on assignment level
        let rolePermissions = assignmentDoc.rolePermissions || {};
        const effectiveAssignmentLevel = assignmentDoc.assignmentLevel;
        
        // Set default permissions based on assignment level
        rolePermissions = {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: effectiveAssignmentLevel === 'REGION' || effectiveAssignmentLevel === 'FULL' || effectiveAssignmentLevel === 'OFFICE',
          DeleteProposals: effectiveAssignmentLevel === 'FULL',
          ApproveProposals: effectiveAssignmentLevel === 'REGION' || effectiveAssignmentLevel === 'FULL' || effectiveAssignmentLevel === 'OFFICE',
          ViewReports: true,
          ManageUsers: effectiveAssignmentLevel === 'FULL',
          ManageSettings: effectiveAssignmentLevel === 'FULL',
          ...rolePermissions // Override with stored permissions if they exist
        };
        
        // Update the assignment document if permissions were missing
        if (!assignmentDoc.rolePermissions || !assignmentDoc.rolePermissions.ApproveProposals) {
          assignmentDoc.rolePermissions = rolePermissions;
          assignmentDoc.save().catch(err => console.warn('Failed to save updated role permissions:', err.message));
        }
        
        req.hierarchicalAccessInfo = {
          scope: assignmentDoc.assignmentLevel,
          hasFullAccess: true, // indicate elevated capability
          canAccessAllRegions: true,
          canAccessAllDepartments: true,
          canAccessAllDivisions: true,
          accessibleRegions,
          accessibleDepartments,
          accessibleDivisions,
          consolidationInfo,
          rolePermissions: rolePermissions,
          workflowRoles: workflowRoles,
          restrictions: assignmentDoc.restrictions // ✅ ADD RESTRICTIONS
        };
        return next();
      }
      // No assignment stored: provide appropriate defaults based on user role
      let defaultScope = 'OWN_ONLY';
      let defaultRolePermissions = {};
      let defaultWorkflowRoles = [];
      
      // Special handling for SUPER ADMIN - give them FULL scope and all permissions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        defaultScope = 'FULL';
        defaultRolePermissions = {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: true,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: true,
          ManageSettings: true
        };
        defaultWorkflowRoles = ['divisionCreator', 'divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier', 'regionCreator','superAdmin', 'regionFinalVerifier'];
      }
      // Special handling for BUDGET PREPARER - give them DIVISION scope and creator permissions
      else if (userRoles.includes('BUDGET PREPARER')) {
        defaultScope = 'DIVISION';
        defaultRolePermissions = {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: false,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        };
        defaultWorkflowRoles = ['divisionCreator'];
      }
      // Special handling for BUDGET REVIEWER - give them DIVISION scope and reviewer permissions
      else if (userRoles.includes('BUDGET REVIEWER')) {
        defaultScope = 'DIVISION';
        defaultRolePermissions = {
          CreateProposals: false,
          EditOwnProposals: false,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: false,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        };
        defaultWorkflowRoles = ['divisionReviewer'];
      }
      // Special handling for APPROVER - give them DIVISION scope and approver permissions
      else if (userRoles.includes('APPROVER')) {
        defaultScope = 'DIVISION';
        defaultRolePermissions = {
          CreateProposals: false,
          EditOwnProposals: false,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        };
        defaultWorkflowRoles = ['divisionApprover'];
      }
      // Special handling for BUDGET_PLANNING_ANALYST - give them appropriate scope and permissions
      else if (userRoles.includes('BUDGET_PLANNING_ANALYST')) {
        defaultScope = 'OFFICE';
        defaultRolePermissions = {
          CreateProposals: false,
          EditOwnProposals: false,
          EditAllProposals: true,
          DeleteProposals: false,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        };
        defaultWorkflowRoles = ['budgetAnalyst'];
      }
      // Special handling for BUDGET_OFFICER - give them OFFICE scope and permissions
      else if (userRoles.includes('BUDGET_OFFICER') || userRoles.includes('SUPERVISOR')) {
        defaultScope = 'OFFICE';
        defaultRolePermissions = {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: false,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        };
        defaultWorkflowRoles = ['officeFinalVerifier'];
      }
      
      req.hierarchicalAccessInfo = {
        scope: defaultScope,
        hasFullAccess: true,
        canAccessAllRegions: defaultScope === 'FULL',
        canAccessAllDepartments: defaultScope === 'FULL',
        canAccessAllDivisions: defaultScope === 'FULL',
        accessibleRegions: [],
        accessibleDepartments: [],
        accessibleDivisions: [],
        consolidationInfo: null,
        rolePermissions: defaultRolePermissions,
        workflowRoles: defaultWorkflowRoles,
        restrictions: null // ✅ ADD RESTRICTIONS
      };
      return next();
    }
    // Non-full access users
    if (!assignmentDoc) {
      req.hierarchicalAccessInfo = {
        scope: 'OWN_ONLY',
        hasFullAccess: false,
        accessibleRegions: [],
        accessibleDepartments: [],
        accessibleDivisions: [],
        consolidationInfo: null,
        restrictions: null // ✅ ADD RESTRICTIONS
      };
      return next();
    }
    const consolidationInfo = assignmentDoc.getConsolidationTarget();
    const accessibleRegions = assignmentDoc.regionId
      ? [{ _id: assignmentDoc.regionId._id, regionName: assignmentDoc.regionId.regionName || assignmentDoc.regionId.RegionName || assignmentDoc.regionId.Region }]
      : [];
    const accessibleDepartments = assignmentDoc.departmentId
      ? [{ _id: assignmentDoc.departmentId._id, departmentName: assignmentDoc.departmentId.Department || assignmentDoc.departmentId.departmentName || assignmentDoc.departmentId.DepartmentName || null }]
      : [];
    const accessibleDivisions = assignmentDoc.divisionName ? [assignmentDoc.divisionName] : [];
    
    // Auto-assign workflow roles based on user's main system roles if not already set
    let workflowRoles = assignmentDoc.workflowRoles || [];
    if (!workflowRoles || workflowRoles.length === 0) {
      // Determine workflow roles based on user's main roles
      const userMainRoles = userRoles || [];
      if (userMainRoles.includes('BUDGET_OFFICER') || userMainRoles.includes('SUPERVISOR')) {
        workflowRoles = ['officeFinalVerifier'];
      } else if (userMainRoles.includes('OVERALL_BUDGET_APPROVER') || userMainRoles.includes('DEPARTMENT_HEAD')) {
        workflowRoles = ['departmentConsolidator', 'regionFinalVerifier'];
      } else if (userMainRoles.includes('BUDGET_ADMIN') || userMainRoles.includes('SUPER ADMIN') || userMainRoles.includes('SUPER_ADMIN') || userMainRoles.includes('ADMIN')) {
        workflowRoles = ['divisionCreator', 'divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission', 'officeCreator', 'officeConsolidator', 'officeSubmission', 'officeFinalVerifier', 'regionCreator', 'superAdmin', 'regionFinalVerifier'];
      }
      
      // Update the assignment document with auto-assigned workflow roles
      if (workflowRoles.length > 0) {
        assignmentDoc.workflowRoles = workflowRoles;
        assignmentDoc.save().catch(err => console.warn('Failed to save auto-assigned workflow roles:', err.message));
      }
    }
    
    // Ensure rolePermissions are set based on assignment level
    let rolePermissions = assignmentDoc.rolePermissions || {};
    const effectiveAssignmentLevel = assignmentDoc.assignmentLevel;
    
    // Set default permissions based on assignment level
    rolePermissions = {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: effectiveAssignmentLevel === 'REGION' || effectiveAssignmentLevel === 'FULL' || effectiveAssignmentLevel === 'OFFICE',
      DeleteProposals: effectiveAssignmentLevel === 'FULL',
      ApproveProposals: effectiveAssignmentLevel === 'REGION' || effectiveAssignmentLevel === 'FULL' || effectiveAssignmentLevel === 'OFFICE',
      ViewReports: true,
      ManageUsers: effectiveAssignmentLevel === 'FULL',
      ManageSettings: effectiveAssignmentLevel === 'FULL',
      ...rolePermissions // Override with stored permissions if they exist
    };
    
    // Update the assignment document if permissions were missing
    if (!assignmentDoc.rolePermissions || !assignmentDoc.rolePermissions.ApproveProposals) {
      assignmentDoc.rolePermissions = rolePermissions;
      assignmentDoc.save().catch(err => console.warn('Failed to save updated role permissions:', err.message));
    }
    
    req.hierarchicalAccessInfo = {
      scope: assignmentDoc.assignmentLevel,
      hasFullAccess: false,
      accessibleRegions,
      accessibleDepartments,
      accessibleDivisions,
      consolidationInfo,
      rolePermissions: rolePermissions,
      workflowRoles: workflowRoles,
      restrictions: assignmentDoc.restrictions // ✅ ADD RESTRICTIONS
    };
    next();
  } catch (error) {
    console.error('🚨 Error getting hierarchical access info:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving hierarchical access information',
      error: error.message
    });
  }
};
// Enforce workflow transitions based on assignment level and workflowRoles
const enforceWorkflowTransition = (transition) => {
  const requiredRoleByTransition = {
    divisionApprove: 'divisionApprover',
    departmentConsolidate: 'departmentConsolidator',
    departmentSubmit: 'departmentSubmission',
    regionFinalVerify: 'regionFinalVerifier',
  };
  const requiredLevelByTransition = {
    divisionApprove: 'DIVISION',
    departmentConsolidate: 'DEPARTMENT',
    departmentSubmit: 'DEPARTMENT',
    regionFinalVerify: 'REGION',
  };
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user?.Roles || [];
      
      // SUPER ADMIN bypasses all workflow transition restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }
      
      // Reuse same source of truth for assignments
      const assignment = await HierarchicalUserAssignment.getUserPermissions(userId, req.user?.Roles);
      if (!assignment) {
        return res.status(403).json({ message: 'No organizational assignment', code: 'NO_ORG_ASSIGNMENT' });
      }
      const requiredRole = requiredRoleByTransition[transition];
      const requiredLevel = requiredLevelByTransition[transition];
      const roles = assignment.workflowRoles || [];
      const levelOk = assignment.assignmentLevel === requiredLevel || assignment.assignmentLevel === 'FULL';
      const roleOk = roles.includes(requiredRole);
      if (!levelOk || !roleOk) {
        return res.status(403).json({
          message: 'Insufficient workflow permissions',
          code: 'WORKFLOW_ROLE_REQUIRED',
          transition,
          requiredRole,
          requiredLevel
        });
      }
      next();
    } catch (e) {
      console.error('Workflow enforcement error', e);
      res.status(500).json({ message: 'Workflow enforcement error' });
    }
  };
};
module.exports = {
  hierarchicalAccessControl,
  strictHierarchicalControl,
  getHierarchicalAccessInfo,
  applyHierarchicalConsolidation,
  validateHierarchicalAccess,
  enforceWorkflowTransition
};
