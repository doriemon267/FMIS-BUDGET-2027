/**
 * 🔄 Submission Workflow Control Middleware
 * 
 * This middleware implements submission-based visibility control where:
 * - Division level data is only visible to Department level AFTER submission
 * - Department level data is only visible to Region level AFTER submission  
 * - Each level needs proper approval users to review and approve submissions
 * 
 * Hierarchy: Division → Submit → Department → Submit → Region
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { hasFullAccess } = require('./securityMiddleware');
/**
 * Enhanced hierarchical access control with submission workflow
 * @param {string} operation - The operation type: 'create', 'read', 'update', 'delete'
 * @param {object} options - Additional options
 */
const submissionWorkflowControl = (operation = 'read', options = {}) => {
  const { 
    strictMode = false, 
    logAccess = true, 
    enforceSubmissionWorkflow = true 
  } = options;
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      const userName = req.user.FirstName + ' ' + req.user.LastName;

      // Debug logging for overtime pay debugging
      if (logAccess) {
        // User access logging
      }

      // For submission workflow, DO NOT bypass based on roles alone
      // Even BUDGET ADMIN/ANALYST users must follow submission workflow if they have hierarchical assignments
      // Only bypass if user has SUPER_ADMIN role or no organizational constraints
      const isSuperAdmin = userRoles && userRoles.includes('SUPER_ADMIN');
      if (isSuperAdmin) {
        return next();
      }
      // Get user's hierarchical assignment
      const assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
      if (!assignment) {
        // If user has full access roles but no hierarchical assignment, allow full access
        if (hasFullAccess(userRoles)) {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: 'No organizational assignment found. Please contact administrator.',
          code: 'NO_ORG_ASSIGNMENT'
        });
      }

      // User has hierarchical assignment, applying submission workflow control
      // Handle different operations
      if (operation === 'read') {
        await handleSubmissionWorkflowRead(req, res, next, assignment, { logAccess, userName, enforceSubmissionWorkflow });
      } else if (['create', 'update', 'delete'].includes(operation)) {
        await handleSubmissionWorkflowWrite(req, res, next, assignment, operation, { logAccess, userName, strictMode });
      } else {
        return next();
      }
    } catch (error) {
      // Submission Workflow Control Error
      return res.status(500).json({
        success: false,
        message: 'Error in submission workflow control',
        error: error.message
      });
    }
  };
};
/**
 * Handle read operations with submission workflow filtering
 */
const handleSubmissionWorkflowRead = async (req, res, next, assignment, options) => {
  const { logAccess, userName, enforceSubmissionWorkflow } = options;



  // Build base hierarchical filters
  let hierarchicalFilters = {};
  let submissionFilters = {};
  switch (assignment.assignmentLevel) {
    case 'DIVISION':
      // Division users can only see their own division data (any status)
      // AND submitted data from their level (but not other divisions)
      hierarchicalFilters = {
        $and: [
          { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
          { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
          { division: assignment.divisionName || assignment.divisions[0] }
        ]
      };
      if (enforceSubmissionWorkflow) {
        // Division users see all their own data regardless of status
        submissionFilters = hierarchicalFilters;
      }
      break;
    case 'DEPARTMENT':
      // Department users can see:
      // 1. Their own department data (any status)
      // 2. SUBMITTED data from divisions within their department

      if (enforceSubmissionWorkflow) {
        submissionFilters = {
          $and: [
            { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
            { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
            {
              $or: [
                // Own department-level data (no division specified, any status)
                { 
                  $and: [
                    { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
                    { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                  ]
                },
                // Division data that has been submitted to department (Division Submitted, Department Verified, or higher)
                { 
                  $and: [
                    { division: { $exists: true, $ne: null, $ne: "" } },
                    { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
                    { 
                      $or: [
                        { status: 'Division Submitted' },
                        { status: 'Department Verified' },
                        { status: 'Department Submitted' },
                        { status: 'Region Approved' },
                        { status: 'Finalized' }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

      } else {
        // Fallback to standard hierarchical filtering
        hierarchicalFilters = {
          $and: [
            { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
            { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName }
          ]
        };
        submissionFilters = hierarchicalFilters;
      }

      break;
    case 'REGION':
      // Region users can see:
      // 1. Their own region data (any status)
      // 2. SUBMITTED data from departments within their region
      if (enforceSubmissionWorkflow) {
        submissionFilters = {
          $and: [
            { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
            {
              $or: [
                // Own region-level data (no department/division specified, any status)
                { 
                  $and: [
                    { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
                    { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
                  ]
                },
                // Department/division data that has been submitted to region (Department Submitted, Region Approved, or Finalized)
                { 
                  $and: [
                    { $or: [
                      { department: { $exists: true, $ne: null, $ne: "" } },
                      { division: { $exists: true, $ne: null, $ne: "" } }
                    ] },
                    { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
                    { 
                      $or: [
                        { status: 'Department Submitted' },
                        { status: 'Region Approved' },
                        { status: 'Finalized' }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };
      } else {
        // Fallback to standard hierarchical filtering
        hierarchicalFilters = {
          region: assignment.regionId?.Region || assignment.regions[0]?.regionName
        };
        submissionFilters = hierarchicalFilters;
      }
      break;
    case 'FULL':
      // Full access users can see everything
      submissionFilters = {};
      break;
    case 'NONE':
      // Users with no assignment - restrict to department-level data only (no division data)
      // This prevents NONE users from seeing unsubmitted division-level data
      submissionFilters = {
        $or: [
          { division: { $exists: false } },
          { division: null },
          { division: "" }
        ]
      };
      break;
    default:
      return res.status(403).json({
        success: false,
        message: 'Invalid assignment level',
        code: 'INVALID_ASSIGNMENT_LEVEL'
      });
  }
  // Add filters to request for use in controllers
  if (logAccess) {
    // Setting filters for user
  }
  req.submissionWorkflowFilters = submissionFilters;
  req.hierarchicalFilters = hierarchicalFilters;
  req.hierarchicalAccessInfo = {
    scope: assignment.assignmentLevel,
    hasFullAccess: assignment.assignmentLevel === 'FULL',
    accessibleRegions: assignment.regions || [],
    accessibleDepartments: assignment.departments || [],
    accessibleDivisions: assignment.divisions || [],
    rolePermissions: assignment.rolePermissions,
    submissionWorkflowEnabled: enforceSubmissionWorkflow
  };


  
  next();
};
/**
 * Handle write operations with submission workflow validation
 */
const handleSubmissionWorkflowWrite = async (req, res, next, assignment, operation, options) => {
  const { logAccess, userName, strictMode } = options;
  // Check basic permissions
  const permissions = assignment.rolePermissions || {};
  let canPerformOperation = true;
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
    return res.status(403).json({
      success: false,
      message: `Access denied. You don't have permission to ${operation} data`,
      code: 'INSUFFICIENT_PERMISSIONS',
      operation,
      userLevel: assignment.assignmentLevel
    });
  }
  // Validate hierarchical access
  const isValidAccess = await validateHierarchicalAccess(req, assignment);
  if (!isValidAccess) {
    if (strictMode) {
      return res.status(403).json({
        message: `Access denied. You cannot ${operation} data outside your assigned organizational units`,
        code: 'INVALID_HIERARCHICAL_ACCESS',
        operation,
        userLevel: assignment.assignmentLevel,
        allowedRegions: assignment.regions?.map(r => r.regionName) || [],
        allowedDepartments: assignment.departments?.map(d => d.departmentName) || [],
        allowedDivisions: assignment.divisions || []
      });
    }
  }
  // Apply submission workflow consolidation for create operations
  if (operation === 'create') {
    applySubmissionWorkflowConsolidation(req, assignment);
  }
  next();
};
/**
 * Apply submission workflow consolidation logic
 */
const applySubmissionWorkflowConsolidation = (req, assignment) => {
  const regionName = assignment.regionId?.Region || assignment.regions[0]?.regionName;
  const departmentName = assignment.departmentId?.Department || assignment.departments[0]?.departmentName;
  const divisionName = assignment.divisions?.[0] || null;
  // Store original organizational context
  req.originalOrgContext = {
    region: req.body.region,
    department: req.body.department,
    division: req.body.division
  };
  // Apply consolidation based on user's access scope
  switch (assignment.assignmentLevel) {
    case 'DIVISION':
      // Division submissions stay at division level (not consolidated until submitted)
      req.body.originalLevel = 'DIVISION';
      req.body.originalDivision = divisionName;
      req.body.division = divisionName;
      req.body.department = departmentName;
      req.body.region = regionName;
      req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
      break;
    case 'DEPARTMENT':
      // Department submissions stay at department level (not consolidated until submitted)
      req.body.originalLevel = 'DEPARTMENT';
      req.body.originalDepartment = departmentName;
      req.body.department = departmentName;
      req.body.region = regionName;
      req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
      break;
    case 'REGION':
      // Region submissions stay at region level
      req.body.originalLevel = 'REGION';
      req.body.region = regionName || req.body.region || null;
      req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
      break;
  }
  // Add submission workflow metadata
  req.body.submissionWorkflowMetadata = {
    submittedBy: req.user.id,
    submittedByScope: assignment.assignmentLevel,
    submissionTimestamp: new Date(),
    workflowApplied: true,
    originalContext: req.originalOrgContext,
    currentContext: {
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
 * New 6-Step Submission Workflow:
 * Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const submissionWorkflowTransitions = {
  // Step 1→2: Division submits to Department (Draft → Division Submitted)
  divisionSubmitToDepartment: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: 'DIVISION',
          status: { $in: ['Draft', 'Not Submitted'] }
        },
        { 
          $set: { 
            status: 'Division Submitted',
            submittedToDepartmentAt: new Date(),
            submittedToDepartmentBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'DIVISION_TO_DEPARTMENT'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully submitted to Department for verification', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Division submission failed',
        error: e.message
      });
    }
  },

  // Step 2→3: Department verifies division submission (Division Submitted → Department Verified)
  departmentVerifySubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', verificationNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: 'DIVISION',
          status: 'Division Submitted'
        },
        { 
          $set: { 
            status: 'Department Verified',
            verifiedByDepartmentAt: new Date(),
            verifiedByDepartmentBy: userId,
            verificationNote: verificationNote || '',
            lastWorkflowTransition: 'DEPARTMENT_VERIFICATION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully verified division submissions', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Department verification failed',
        error: e.message
      });
    }
  },

  // Step 3→4: Department submits to Region (Department Verified → Department Submitted)
  departmentSubmitToRegion: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', approvalNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['DIVISION', 'DEPARTMENT'] },
          status: { $in: ['Department Verified', 'Draft'] } // Include department's own drafts
        },
        { 
          $set: { 
            status: 'Department Submitted',
            approvedByDepartmentAt: new Date(),
            approvedByDepartmentBy: userId,
            submittedToRegionAt: new Date(),
            submittedToRegionBy: userId,
            approvalNote: approvalNote || '',
            lastWorkflowTransition: 'DEPARTMENT_TO_REGION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully submitted to Region for approval', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Department submission failed',
        error: e.message
      });
    }
  },

  // Step 4→5: Region approves submission (Department Submitted → Region Approved)
  regionApproveSubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', regionApprovalNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['DIVISION', 'DEPARTMENT'] },
          status: 'Department Submitted'
        },
        { 
          $set: { 
            status: 'Region Approved',
            approvedByRegionAt: new Date(),
            approvedByRegionBy: userId,
            regionApprovalNote: regionApprovalNote || '',
            lastWorkflowTransition: 'REGION_APPROVAL'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully approved submissions at Region level', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Region approval failed',
        error: e.message
      });
    }
  },

  // Step 5→6: Final approval - Finalize submissions (Region Approved → Finalized)
  regionFinalizeSubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', finalizationNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['DIVISION', 'DEPARTMENT', 'REGION'] },
          status: 'Region Approved'
        },
        { 
          $set: { 
            status: 'Finalized',
            finalizedAt: new Date(),
            finalizedBy: userId,
            finalizationNote: finalizationNote || '',
            lastWorkflowTransition: 'FINALIZATION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully finalized submissions', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Finalization failed',
        error: e.message
      });
    }
  }
};
/**
 * Helper function to get model by entity type
 */
const getModelByEntity = (entity) => {
  switch (entity) {
    case 'personnel':
      return require('../models/personnelServices');
    case 'mooe':
      return require('../models/mooeProposals');
    case 'capital':
      return require('../models/CapitalOutlay');
    case 'income':
      return require('../models/Income');
    case 'budgetarySupport':
      return require('../models/BudgetarySupport');
    default:
      return require('../models/personnelServices');
  }
};
module.exports = {
  submissionWorkflowControl,
  submissionWorkflowTransitions,
  handleSubmissionWorkflowRead,
  handleSubmissionWorkflowWrite,
  applySubmissionWorkflowConsolidation,
  validateHierarchicalAccess
};
