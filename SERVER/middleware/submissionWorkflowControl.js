/**
 * 🔄 Submission Workflow Control Middleware
 *
 * This middleware implements submission-based visibility control where:
 * - Responsibility Center level data is only visible to Office level AFTER submission
 * - Office level data is only visible to Office level (final) AFTER submission
 * - Each level needs proper approval users to review and approve submissions
 *
 * Hierarchy: Responsibility Center → Submit → Office → Finalize
 *
 * BACKWARD COMPATIBILITY: Supports both old (HierarchicalUserAssignment) and new (UserOrganizationalAssignment) structures
 */
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const { hasFullAccess } = require('./securityMiddleware');
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

      // For submission workflow reads, do not bypass even for FULL ACCESS if enforceSubmissionWorkflow=true
      // Check for both 'SUPER_ADMIN' (with underscore) and 'SUPER ADMIN' (with space) from database
      const isSuperAdmin = userRoles && (userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN'));
      const hasFullAccessPrivileges = hasFullAccess(userRoles);
      if (isSuperAdmin || hasFullAccessPrivileges) {
        // FULL access users should bypass submission workflow controls entirely
        return next();
      }

      // Check if user has budget role - budget roles use budgetRoleAccessControl middleware instead
      const hasBudgetRole = userRoles && (
        userRoles.includes('BUDGET_ADMIN') ||
        userRoles.includes('BUDGET_MANAGER') ||
        userRoles.includes('BUDGET_OFFICER') ||
        userRoles.includes('BUDGET_ANALYST')
      );
      
      if (hasBudgetRole) {
        // Budget role users bypass submission workflow control
        // They will be filtered by budgetRoleAccessControl middleware instead
        console.log(`[submissionWorkflowControl] User has budget role, bypassing submission workflow control`);
        return next();
      }

      // Try to get user's assignment from new model first, fallback to old model
      let assignment = null;
      let isNewStructure = false;

      try {
        assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
        // Check if this is a real database record or just defaults
        if (assignment && assignment._id) {
          isNewStructure = true;
        } else {
          // This is just default values, skip to old structure
          assignment = null;
        }
      } catch (error) {
        assignment = null;
      }

      if (!assignment) {
        try {
          assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
          isNewStructure = false;
        } catch (error) {
          // Old assignment model not available
        }
      }

      if (!assignment) {
        // If user has full access roles but no hierarchical assignment, allow full access
        // (This case should be rare since full access users now bypass above)
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
        await handleSubmissionWorkflowRead(req, res, next, assignment, { logAccess, userName, enforceSubmissionWorkflow, isNewStructure });
      } else if (['create', 'update', 'delete'].includes(operation)) {
        await handleSubmissionWorkflowWrite(req, res, next, assignment, operation, { logAccess, userName, strictMode, isNewStructure });
      } else {
        return next();
      }
    } catch (error) {
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
  const { logAccess, userName, enforceSubmissionWorkflow, isNewStructure } = options;

  // Build base hierarchical filters
  let hierarchicalFilters = {};
  let submissionFilters = {};

  if (isNewStructure) {
    // NEW STRUCTURE: Responsibility Center → Office
    switch (assignment.accessScope) {
      case 'RESPONSIBILITY_CENTER':
        // Responsibility Center users can only see their own responsibility center data (any status)
        // AND submitted data from their level (but not other responsibility centers)
        hierarchicalFilters = {
          $and: [
            { department: { $in: assignment.responsibilityCenters || [] } }
          ]
        };
        if (enforceSubmissionWorkflow) {
          // Responsibility Center users see all their own data regardless of status
          // BUT only for records that originated at RESPONSIBILITY_CENTER level
          submissionFilters = {
            $and: [
              ...hierarchicalFilters.$and,
              { originalLevel: 'RESPONSIBILITY_CENTER' }
            ]
          };
        }
        break;

      case 'OFFICE':
        // Office users can see:
        // 1. Their own office data (any status)
        // 2. SUBMITTED data from responsibility centers within their office
        if (enforceSubmissionWorkflow) {
          submissionFilters = {
            $and: [
              { region: { $in: assignment.offices || [] } },
              {
                $or: [
                  // Own office-level data (no responsibility center specified, any status)
                  {
                    $and: [
                      { region: { $in: assignment.offices || [] } },
                      {
                        $or: [
                          { workflowLevel: 'OFFICE' },
                          { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
                        ]
                      }
                    ]
                  },
                  // Responsibility Center data that has been submitted to office (Responsibility Center Submitted, Office Verified, or higher)
                  {
                    $and: [
                      { department: { $exists: true, $ne: null, $ne: "" } },
                      { region: { $in: assignment.offices || [] } },
                      { workflowLevel: 'RESPONSIBILITY_CENTER' },
                      {
                        $or: [
                          { status: { $in: ['Responsibility Center Submitted', 'RESPONSIBILITY_CENTER_SUBMITTED'] } },
                          { status: { $in: ['Office Verified', 'OFFICE_VERIFIED'] } },
                          { status: { $in: ['Office Submitted', 'OFFICE_SUBMITTED'] } },
                          { status: { $in: ['Final Approved', 'FINAL_APPROVED'] } },
                          { status: 'Finalized' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          };
          hierarchicalFilters = submissionFilters; // Fix: set hierarchicalFilters for controller use
        } else {
          // Fallback to standard hierarchical filtering
          hierarchicalFilters = {
            region: { $in: assignment.offices || [] }
          };
          submissionFilters = hierarchicalFilters;
        }
        break;

      case 'FULL':
        // Full access users see submitted-only across all offices; hide unsubmitted lower-level drafts
        if (enforceSubmissionWorkflow) {
          submissionFilters = {
            $or: [
              // Office-level data (no responsibility center specified)
              {
                $and: [
                  {
                    $or: [
                      { workflowLevel: 'OFFICE' },
                      { $or: [ { department: { $exists: false } }, { department: null }, { department: "" } ] }
                    ]
                  }
                ]
              },
              // Responsibility Center data that has been submitted upward
              {
                $and: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { workflowLevel: 'RESPONSIBILITY_CENTER' },
                  {
                    $or: [
                      { status: { $in: ['Responsibility Center Submitted', 'RESPONSIBILITY_CENTER_SUBMITTED'] } },
                      { status: { $in: ['Office Verified', 'OFFICE_VERIFIED'] } },
                      { status: { $in: ['Office Submitted', 'OFFICE_SUBMITTED'] } },
                      { status: { $in: ['Final Approved', 'FINAL_APPROVED'] } },
                      { status: 'Finalized' }
                    ]
                  }
                ]
              }
            ]
          };
          hierarchicalFilters = submissionFilters;
        } else {
          submissionFilters = {};
        }
        break;

      case 'OWN_ONLY':
        // Users with own-only access - restrict to their own data only
        submissionFilters = {
          createdBy: req.user.id
        };
        break;

      default:
        return res.status(403).json({
          success: false,
          message: 'Invalid access scope',
          code: 'INVALID_ACCESS_SCOPE'
        });
    }
  } else {
    // OLD STRUCTURE: Division → Department → Region (BACKWARD COMPATIBILITY)
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
          // Division users see all their own data regardless of status.
          // Compatibility: many legacy records lack originalLevel/workflowLevel;
          // treat presence of division as DIVISION-level.
          submissionFilters = {
            $and: [
              ...hierarchicalFilters.$and,
              {
                $or: [
                  { originalLevel: 'DIVISION' },
                  { workflowLevel: 'DIVISION' },
                  { draftStage: 'DIVISION' },
                  { division: { $exists: true, $ne: null, $ne: '' } },
                  { createdByUserId: req.user.id },
                  { status: { $in: ['Draft', 'Responsibility Center Draft', 'Division Draft'] } }
                ]
              }
            ]
          };
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
                      {
                        $or: [
                          { workflowLevel: 'DEPARTMENT' },
                          { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                        ]
                      }
                    ]
                  },
                  // Division data that has been submitted to department (Division Submitted, Department Verified, or higher)
                  {
                    $and: [
                      { division: { $exists: true, $ne: null, $ne: "" } },
                      { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
                      { workflowLevel: 'DIVISION' },
                      {
                        $or: [
                          // Legacy status labels
                          { status: { $in: ['Division Submitted', 'DIVISION SUBMITTED'] } },
                          { status: { $in: ['Department Verified', 'DEPARTMENT VERIFIED'] } },
                          { status: { $in: ['Department Submitted', 'DEPARTMENT SUBMITTED'] } },
                          // Accept both legacy 'Region Approved' and the Office-level label 'Office Approved'
                          { status: { $in: ['Region Approved', 'REGION APPROVED', 'Office Approved', 'OFFICE APPROVED', 'Finalized'] } },
                          // Newer labels (Responsibility Center/Office workflow)
                          { status: { $in: ['Responsibility Center Submitted', 'RESPONSIBILITY_CENTER_SUBMITTED'] } },
                          { status: { $in: ['Office Verified', 'OFFICE_VERIFIED'] } },
                          { status: { $in: ['Office Submitted', 'OFFICE_SUBMITTED'] } },
                          { status: { $in: ['Final Approved', 'FINAL_APPROVED'] } },
                          { status: 'Finalized' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          };
          hierarchicalFilters = submissionFilters; // Fix: set hierarchicalFilters for controller use
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
                      { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] },
                      { workflowLevel: 'REGION' }
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
                          // Legacy labels
                          { status: { $in: ['Department Submitted', 'DEPARTMENT SUBMITTED'] } },
                          // Allow either Region Approved (legacy entity label) or Office Approved (workflow label)
                          { status: { $in: ['Region Approved', 'REGION APPROVED', 'Office Approved', 'OFFICE APPROVED', 'Finalized'] } },
                          // Newer labels
                          { status: { $in: ['Office Submitted', 'OFFICE_SUBMITTED'] } },
                          { status: { $in: ['Final Approved', 'FINAL_APPROVED'] } },
                          { status: 'Finalized' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          };
          hierarchicalFilters = submissionFilters; // Fix: set hierarchicalFilters for controller use
        } else {
          // Fallback to standard hierarchical filtering
          hierarchicalFilters = {
            region: assignment.regionId?.Region || assignment.regions[0]?.regionName
          };
          submissionFilters = hierarchicalFilters;
        }
        break;

      case 'FULL':
        // Full access users see submitted-only across all regions; hide unsubmitted lower-level drafts
        if (enforceSubmissionWorkflow) {
          submissionFilters = {
            $or: [
              // Region-level data (no department/division specified)
              {
                $and: [
                  { $or: [ { department: { $exists: false } }, { department: null }, { department: '' } ] },
                  { $or: [ { division: { $exists: false } }, { division: null }, { division: '' } ] },
                  { workflowLevel: 'REGION' }
                ]
              },
              // Department/Division data that has been submitted upward
              {
                $and: [
                  { $or: [
                    { department: { $exists: true, $ne: null, $ne: '' } },
                    { division: { $exists: true, $ne: null, $ne: '' } }
                  ] },
                  {
                    $or: [
                      // Legacy labels
                      { status: { $in: ['Division Submitted','DIVISION SUBMITTED'] } },
                      { status: { $in: ['Department Verified','DEPARTMENT VERIFIED'] } },
                      { status: { $in: ['Department Submitted','DEPARTMENT SUBMITTED'] } },
                      // Ensure both naming variants are accepted
                      { status: { $in: ['Region Approved','REGION APPROVED','Office Approved','OFFICE APPROVED'] } },
                      // Newer labels
                      { status: { $in: ['Responsibility Center Submitted','RESPONSIBILITY_CENTER_SUBMITTED'] } },
                      { status: { $in: ['Office Verified','OFFICE_VERIFIED'] } },
                      { status: { $in: ['Office Submitted','OFFICE_SUBMITTED'] } },
                      { status: { $in: ['Final Approved','FINAL_APPROVED'] } },
                      { status: 'Finalized' }
                    ]
                  }
                ]
              }
            ]
          };
          hierarchicalFilters = submissionFilters;
        } else {
          submissionFilters = {};
        }
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
  }

  // Add filters to request for use in controllers
  req.submissionWorkflowFilters = submissionFilters;
  req.hierarchicalFilters = hierarchicalFilters;
  req.hierarchicalAccessInfo = {
    scope: isNewStructure ? assignment.accessScope : assignment.assignmentLevel,
    hasFullAccess: (isNewStructure ? assignment.accessScope : assignment.assignmentLevel) === 'FULL',
    accessibleRegions: assignment.regions || [],
    accessibleDepartments: assignment.departments || [],
    accessibleDivisions: assignment.divisions || [],
    accessibleOffices: assignment.offices || [],
    accessibleResponsibilityCenters: assignment.responsibilityCenters || [],
    rolePermissions: assignment.rolePermissions,
    submissionWorkflowEnabled: enforceSubmissionWorkflow,
    isNewStructure
  };

  next();
};
/**
 * Handle write operations with submission workflow validation
 */
const handleSubmissionWorkflowWrite = async (req, res, next, assignment, operation, options) => {
  const { logAccess, userName, strictMode, isNewStructure } = options;

  // Check basic permissions
  const permissions = assignment.rolePermissions || {};
  let canPerformOperation = true;

  switch (operation) {
    case 'create':
      canPerformOperation = permissions.CreateProposals !== false;
      break;
    case 'update':
      canPerformOperation = permissions.EditOwnProposals !== false || permissions.EditAllProposals === true;
      break;
    case 'delete':
      canPerformOperation = permissions.DeleteProposals === true;
      break;
  }

  if (!canPerformOperation) {
    return res.status(403).json({
      success: false,
      message: `Access denied. You don't have permission to ${operation} data`,
      code: 'INSUFFICIENT_PERMISSIONS',
      operation,
      userLevel: isNewStructure ? assignment.accessScope : assignment.assignmentLevel
    });
  }

  // Validate hierarchical access
  const isValidAccess = await validateHierarchicalAccess(req, assignment, isNewStructure);
  if (!isValidAccess) {
    if (strictMode) {
      const accessInfo = isNewStructure ? {
        userLevel: assignment.accessScope,
        allowedOffices: assignment.offices || [],
        allowedResponsibilityCenters: assignment.responsibilityCenters || []
      } : {
        userLevel: assignment.assignmentLevel,
        allowedRegions: assignment.regions?.map(r => r.regionName) || [],
        allowedDepartments: assignment.departments?.map(d => d.departmentName) || [],
        allowedDivisions: assignment.divisions || []
      };

      return res.status(403).json({
        message: `Access denied. You cannot ${operation} data outside your assigned organizational units`,
        code: 'INVALID_HIERARCHICAL_ACCESS',
        operation,
        ...accessInfo
      });
    }
  }

  // Log successful access
  // Apply submission workflow consolidation for create operations
  if (operation === 'create') {
    applySubmissionWorkflowConsolidation(req, assignment);
  }

  // Provide submission workflow data to controllers that expect it
  try {
    const regionName = isNewStructure ?
      (assignment.offices?.[0] || req.body.office) :
      (assignment.regionId?.Region || assignment.regions[0]?.regionName || req.body.region);
    const departmentName = isNewStructure ?
      (assignment.responsibilityCenters?.[0] || req.body.responsibilityCenter) :
      (assignment.departmentId?.Department || assignment.departments[0]?.departmentName || req.body.department);
    const divisionName = isNewStructure ? null : (assignment.divisions?.[0] || req.body.division || null);

    req.submissionWorkflowData = {
      region: req.body.region ?? regionName,
      department: req.body.department ?? departmentName,
      division: req.body.division ?? divisionName,
      office: req.body.office ?? (isNewStructure ? regionName : null),
      responsibilityCenter: req.body.responsibilityCenter ?? (isNewStructure ? departmentName : null),
      originalLevel: req.body.originalLevel,
      workflowLevel: req.body.workflowLevel,
      userLevel: isNewStructure ? assignment.accessScope : assignment.assignmentLevel,
      isNewStructure
    };
  } catch (_) {
    // no-op
  }

  next();
};
/**
 * Apply submission workflow consolidation logic
 */
const applySubmissionWorkflowConsolidation = (req, assignment, isNewStructure = false) => {
  if (isNewStructure) {
    // NEW STRUCTURE: Apply consolidation for Office/Responsibility Center
    const officeName = assignment.offices?.[0] || null;
    const responsibilityCenterName = assignment.responsibilityCenters?.[0] || null;

    // Store original organizational context
    req.originalOrgContext = {
      office: req.body.office,
      responsibilityCenter: req.body.responsibilityCenter
    };

    // Set default values if not provided
    if (!req.body.office && officeName) {
      req.body.office = officeName;
    }
    if (!req.body.responsibilityCenter && responsibilityCenterName) {
      req.body.responsibilityCenter = responsibilityCenterName;
    }

    // Apply consolidation based on user's access scope
    switch (assignment.accessScope) {
      case 'RESPONSIBILITY_CENTER':
        // Responsibility Center submissions stay at responsibility center level
        req.body.originalLevel = 'RESPONSIBILITY_CENTER';
        req.body.responsibilityCenter = responsibilityCenterName;
        req.body.office = officeName;
        req.body.workflowLevel = 'RESPONSIBILITY_CENTER';
        req.body.status = req.body.status || 'Draft';
        break;

      case 'OFFICE':
        // Office submissions stay at office level
        req.body.originalLevel = 'OFFICE';
        req.body.office = officeName;
        req.body.workflowLevel = 'OFFICE';
        req.body.status = req.body.status || 'Draft';
        break;

      case 'FULL':
        // Full access - no consolidation needed
        req.body.originalLevel = req.body.originalLevel || 'FULL';
        req.body.workflowLevel = req.body.workflowLevel || 'FULL';
        req.body.status = req.body.status || 'Draft';
        break;

      case 'OWN_ONLY':
        // Own only - restrict to user's own data
        req.body.originalLevel = 'OWN_ONLY';
        req.body.createdBy = req.user.id;
        req.body.workflowLevel = 'OWN_ONLY';
        req.body.status = req.body.status || 'Draft';
        break;
    }
  } else {
    // OLD STRUCTURE: Apply consolidation for Region/Department/Division
    const regionName = assignment.regionId?.Region || assignment.regions?.[0]?.regionName;
    const departmentName = assignment.departmentId?.Department || assignment.departments?.[0]?.departmentName;
    const divisionName = assignment.divisions?.[0] || null;

    // Store original organizational context
    req.originalOrgContext = {
      region: req.body.region,
      department: req.body.department,
      division: req.body.division
    };

    // Set default values if not provided
    if (!req.body.region && regionName) {
      req.body.region = regionName;
    }
    if (!req.body.department && departmentName) {
      req.body.department = departmentName;
    }
    if (!req.body.division && divisionName) {
      req.body.division = divisionName;
    }

    // Apply consolidation based on user's access scope
    switch (assignment.assignmentLevel) {
      case 'DIVISION':
        // Division submissions stay at division level (not consolidated until submitted)
        req.body.originalLevel = 'DIVISION';
        req.body.originalDivision = divisionName;
        req.body.division = divisionName;
        req.body.department = departmentName;
        req.body.region = regionName;
        req.body.workflowLevel = 'DIVISION';
        req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
        break;
      case 'DEPARTMENT':
        // Department submissions stay at department level (not consolidated until submitted)
        req.body.originalLevel = 'DEPARTMENT';
        req.body.originalDepartment = departmentName;
        req.body.department = departmentName;
        req.body.region = regionName;
        // Clear division for department-origin records to avoid leaking to division scope filters
        req.body.division = null;
        req.body.workflowLevel = 'DEPARTMENT';
        req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
        break;
      case 'REGION':
        // Region submissions stay at region level
        req.body.originalLevel = 'REGION';
        req.body.region = regionName || req.body.region || null;
        req.body.workflowLevel = 'REGION';
        req.body.status = req.body.status || 'Draft'; // Default to Draft for new submissions
        break;
      case 'FULL':
        // Full access - no consolidation needed
        req.body.originalLevel = req.body.originalLevel || 'FULL';
        req.body.workflowLevel = req.body.workflowLevel || 'FULL';
        req.body.status = req.body.status || 'Draft';
        break;
      case 'NONE':
        // No assignment - restrict access
        req.body.originalLevel = 'NONE';
        req.body.workflowLevel = 'NONE';
        req.body.status = req.body.status || 'Draft';
        break;
    }
  }

  // Add submission workflow metadata
  req.body.submissionWorkflowMetadata = {
    submittedBy: req.user.id,
    submittedByScope: isNewStructure ? assignment.accessScope : assignment.assignmentLevel,
    submissionTimestamp: new Date(),
    workflowApplied: true,
    originalContext: req.originalOrgContext,
    currentContext: isNewStructure ? {
      office: req.body.office,
      responsibilityCenter: req.body.responsibilityCenter
    } : {
      region: req.body.region,
      department: req.body.department,
      division: req.body.division
    },
    isNewStructure
  };
};
/**
 * Validate hierarchical access permissions
 */
const validateHierarchicalAccess = async (req, assignment, isNewStructure = false) => {
  if (isNewStructure) {
    // NEW STRUCTURE: Validate Office and Responsibility Center access
    const { office, responsibilityCenter } = req.body;

    // Check office access if office is specified
    if (office) {
      const hasOfficeAccess = assignment.offices && assignment.offices.includes(office);
      if (!hasOfficeAccess) {
        return false;
      }
    }

    // Check responsibility center access if responsibility center is specified
    if (responsibilityCenter) {
      const hasResponsibilityCenterAccess = assignment.responsibilityCenters && assignment.responsibilityCenters.includes(responsibilityCenter);
      if (!hasResponsibilityCenterAccess) {
        return false;
      }
    }

    return true;
  } else {
    // OLD STRUCTURE: Validate Region, Department, Division access
    const { region, department, division } = req.body;

    // Check region access if region is specified
    if (region) {
      const hasRegionAccess = assignment.hasRegionAccess ? assignment.hasRegionAccess(region) :
        (assignment.regions && assignment.regions.some(r => r.regionName === region));
      if (!hasRegionAccess) {
        return false;
      }
    }

    // Check department access if department is specified
    if (department) {
      const hasDepartmentAccess = assignment.hasDepartmentAccess ? assignment.hasDepartmentAccess(department) :
        (assignment.departments && assignment.departments.some(d => d.departmentName === department));
      if (!hasDepartmentAccess) {
        return false;
      }
    }

    // Check division access if division is specified
    if (division) {
      const hasDivisionAccess = assignment.hasDivisionAccess ? assignment.hasDivisionAccess(division) :
        (assignment.divisions && assignment.divisions.includes(division));
      if (!hasDivisionAccess) {
        return false;
      }
    }

    return true;
  }
};
/**
 * New 6-Step Submission Workflow:
 * Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const submissionWorkflowTransitions = {
  // Step 1→2: Responsibility Center submits to Office (Draft → Responsibility Center Submitted)
  responsibilityCenterSubmitToOffice: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);

      // Convert string IDs to ObjectId if needed
      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return mongoose.Types.ObjectId(id);
          } catch (e) {
            return id;
          }
        }
        return id;
      });

      // More flexible query - allow various status values and originalLevel conditions
      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          $or: [
            { originalLevel: 'RESPONSIBILITY_CENTER' },
            { originalLevel: { $exists: false } },
            { originalLevel: null },
            { originalLevel: '' }
          ],
          status: {
            $in: ['Draft', 'Not Submitted', 'DRAFT', 'NOT SUBMITTED', 'Responsibility Center Submitted', 'RESPONSIBILITY_CENTER SUBMITTED']
          }
        },
        {
          $set: {
            status: 'Responsibility Center Submitted',
            originalLevel: 'RESPONSIBILITY_CENTER', // Ensure originalLevel is set
            submittedToOfficeAt: new Date(),
            submittedToOfficeBy: userId,
            submittedToOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'RESPONSIBILITY_CENTER_TO_OFFICE'
          },
          $push: {
            workflowHistory: {
              action: 'RC_SUBMIT',
              toStatus: 'Responsibility Center Submitted',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: submissionNote || ''
            }
          }
        }
      );

      // Create notifications for Office consolidators in same org
      try {
        const Notification = require('../models/Notification');
        const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

        // sample record for org context
        const sample = await Model.findOne({ _id: { $in: objectIds } })
          .select('region department division').lean();

        // Support both new ('officeConsolidator') and legacy ('departmentConsolidator') role names
        const officeUsersPrimary = await getUsersWithWorkflowRole('departmentConsolidator');
        const officeUsersLegacy = await getUsersWithWorkflowRole('departmentConsolidator');
        const officeUsers = [...officeUsersPrimary, ...officeUsersLegacy];

        // Prefer org-matched users; if none match (naming mismatch), fall back to all office consolidators
        let recipients = officeUsers.filter(u => (
          (!sample?.region || String(u.region || '').trim().toUpperCase() === String(sample.region || '').trim().toUpperCase()) &&
          (!sample?.department || String(u.department || '').trim().toUpperCase() === String(sample.department || '').trim().toUpperCase())
        ));
        if (!recipients.length) recipients = officeUsers;

        if (recipients.length) {
          const creatorName = (req.user?.FirstName && req.user?.LastName)
            ? `${req.user.FirstName} ${req.user.LastName}`
            : (req.user?.name || req.user?.username || 'User');

          const pickRecipientId = (u) => {
            const first = (v) => Array.isArray(v) ? v[0] : v;
            const candidates = [
              u.userId, u.UserId, u.UserID,
              first(u.Username), u.username,
              u.userCode, u.UserCode,
              u.employeeCode, u.EmployeeCode,
              u.empCode, u.EmpCode,
              u.id, u.Id, u.ID
            ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
            return candidates[0] || String(u.id || '');
          };

          const docs = recipients.map(u => ({
            recipientUserId: pickRecipientId(u),
            title: 'New Responsibility Center submission',
            message: `${creatorName} submitted ${objectIds.length} item(s) for Office verification.`,
            entity,
            recordIds: objectIds,
            org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
            createdBy: { userId: req.user?.id, name: creatorName }
          }));
          await Notification.insertMany(docs);
        }
      } catch (notifyErr) {
        // Non-blocking
        console.error('Notify error (RC submit):', notifyErr?.message);
      }

      return res.status(200).json({
        message: 'Successfully submitted to Office for verification',
        modified: result.modifiedCount,
        matched: result.matchedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Responsibility Center submission failed',
        error: e.message
      });
    }
  },

  // NEW: Office returns submission back to Responsibility Center (RC Submitted or Office Verified → Returned)
  officeReturnToResponsibilityCenter: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', returnReason } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);

      // Convert string IDs to ObjectId if needed
      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try { return mongoose.Types.ObjectId(id); } catch (e) { return id; }
        }
        return id;
      });

      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'DIVISION'] }, // legacy support
          status: { $in: [
            'Responsibility Center Submitted','RESPONSIBILITY_CENTER SUBMITTED','RESPONSIBILITY_CENTER_SUBMITTED',
            'Office Verified','OFFICE VERIFIED','OFFICE_VERIFIED',
            'Division Submitted','DIVISION_SUBMITTED'
          ]}
        },
        {
          $set: {
            status: 'Returned',
            returnedByOfficeAt: new Date(),
            returnedByOfficeBy: userId,
            returnedByOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            returnReason: returnReason || '',
            lastWorkflowTransition: 'OFFICE_RETURN'
          },
          $push: {
            workflowHistory: {
              action: 'OFFICE_RETURN',
              toStatus: 'Returned',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: returnReason || ''
            }
          }
        }
      );

      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to return. Ensure items are RC Submitted or Office Verified.',
          code: 'NO_MATCH_RETURN',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Returned to Responsibility Center',
        modified: result.modifiedCount,
        matched: result.matchedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Office return failed',
        error: e.message
      });
    }
  },

  // Step 2→3: Office verifies responsibility center submission (Responsibility Center Submitted → Office Verified)
  officeVerifySubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', verificationNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);

      // Convert string IDs to ObjectId if needed
      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return mongoose.Types.ObjectId(id);
          } catch (e) {
            return id;
          }
        }
        return id;
      });

      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          $or: [
            { originalLevel: 'RESPONSIBILITY_CENTER' },
            { originalLevel: 'DIVISION' }, // legacy support
            { originalLevel: { $exists: false } },
            { originalLevel: null },
            { originalLevel: '' }
          ],
          status: {
            $in: [
              // Responsibility Center variants
              'Responsibility Center Submitted',
              'RESPONSIBILITY_CENTER SUBMITTED',
              'RESPONSIBILITY_CENTER_SUBMITTED',
              // Office verified variants
              'Office Verified',
              'OFFICE VERIFIED',
              'OFFICE_VERIFIED',
              // Legacy Division submissions
              'Division Submitted',
              'DIVISION_SUBMITTED'
            ]
          }
        },
        {
          $set: {
            status: 'Office Verified',
            originalLevel: 'RESPONSIBILITY_CENTER', // Normalize level for legacy data
            verifiedByOfficeAt: new Date(),
            verifiedByOfficeBy: userId,
            verifiedByOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            verificationNote: verificationNote || '',
            lastWorkflowTransition: 'OFFICE_VERIFICATION'
          },
          $push: {
            workflowHistory: {
              action: 'OFFICE_VERIFY',
              toStatus: 'Office Verified',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: verificationNote || ''
            }
          }
        }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to verify. Ensure items are Responsibility Center level and status is Responsibility Center Submitted.',
          code: 'NO_MATCH_VERIFY',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Successfully verified responsibility center submissions',
        modified: result.modifiedCount,
        matched: result.matchedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Office verification failed',
        error: e.message
      });
    }
  },

  // Step 3→4: Office submits own (Office Verified → Office Submitted)
  officeSubmitOwn: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', approvalNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
          status: { $in: ['Office Verified', 'OFFICE VERIFIED', 'Draft', 'DRAFT'] }
        },
        { 
          $set: { 
            status: 'Office Submitted',
            approvedByOfficeAt: new Date(),
            approvedByOfficeBy: userId,
            approvedByOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            submittedToOfficeAt: new Date(),
            submittedToOfficeBy: userId,
            submittedToOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            approvalNote: approvalNote || '',
            lastWorkflowTransition: 'OFFICE_TO_FINALIZE'
          },
          $push: {
            workflowHistory: {
              action: 'OFFICE_SUBMIT',
              toStatus: 'Office Submitted',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: approvalNote || ''
            }
          }
        }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to submit. Ensure items are verified or drafts at Office level.',
          code: 'NO_MATCH_SUBMIT',
        });
      }

      // Create notifications for Office finalizers
      try {
        const Notification = require('../models/Notification');
        const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

        // sample record for org context
        const sample = await Model.findOne({ _id: { $in: ids } })
          .select('region department division').lean();

        // Get office finalizers (users who can finalize submissions)
        const officeFinalizers = await getUsersWithWorkflowRole('regionFinalVerifier');

        // Prefer org-matched users; if none match, fall back to all office finalizers
        let recipients = officeFinalizers.filter(u => (
          (!sample?.region || String(u.region || '').trim().toUpperCase() === String(sample.region || '').trim().toUpperCase()) &&
          (!sample?.department || String(u.department || '').trim().toUpperCase() === String(sample.department || '').trim().toUpperCase())
        ));
        if (!recipients.length) recipients = officeFinalizers;

        if (recipients.length) {
          const creatorName = (req.user?.FirstName && req.user?.LastName)
            ? `${req.user.FirstName} ${req.user.LastName}`
            : (req.user?.name || req.user?.username || 'User');

          const pickRecipientId = (u) => {
            const first = (v) => Array.isArray(v) ? v[0] : v;
            const candidates = [
              u.userId, u.UserId, u.UserID,
              first(u.Username), u.username,
              u.userCode, u.UserCode,
              u.employeeCode, u.EmployeeCode,
              u.empCode, u.EmpCode,
              u.id, u.Id, u.ID
            ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
            return candidates[0] || String(u.id || '');
          };

          const docs = recipients.map(u => ({
            recipientUserId: pickRecipientId(u),
            title: 'Office submissions ready for finalization',
            message: `${creatorName} submitted ${ids.length} item(s) for final Office approval.`,
            entity,
            recordIds: ids,
            org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
            createdBy: { userId: req.user?.id, name: creatorName }
          }));
          await Notification.insertMany(docs);
        }
      } catch (notifyErr) {
        // Non-blocking
        console.error('Notify error (office submit):', notifyErr?.message);
      }

      return res.status(200).json({ 
        success: true,
        message: 'Successfully submitted for finalization', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Office submission failed',
        error: e.message
      });
    }
  },

  // Step 4→5: Office approves submission (Office Submitted → Office Approved)
  officeApproveSubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', officeApprovalNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
          status: { $in: ['Office Submitted', 'OFFICE SUBMITTED'] }
        },
        { 
          $set: { 
            status: 'Office Approved',
            approvedByOfficeAt: new Date(),
            approvedByOfficeBy: userId,
            approvedByOfficeName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            officeApprovalNote: officeApprovalNote || '',
            lastWorkflowTransition: 'OFFICE_APPROVAL'
          },
          $push: {
            workflowHistory: {
              action: 'OFFICE_APPROVE',
              toStatus: 'Office Approved',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: officeApprovalNote || ''
            }
          }
        }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to approve. Ensure items are Office Submitted.',
          code: 'NO_MATCH_APPROVE',
        });
      }

      // Create notifications for final approvers (could be regional or system admins)
      try {
        const Notification = require('../models/Notification');
        const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

        // sample record for org context
        const sample = await Model.findOne({ _id: { $in: ids } })
          .select('region department division').lean();

        // Get final approvers (users who can finalize submissions)
        const finalApprovers = await getUsersWithWorkflowRole('regionFinalVerifier');

        // Prefer org-matched users; if none match, fall back to all final approvers
        let recipients = finalApprovers.filter(u => (
          (!sample?.region || String(u.region || '').trim().toUpperCase() === String(sample.region || '').trim().toUpperCase()) &&
          (!sample?.department || String(u.department || '').trim().toUpperCase() === String(sample.department || '').trim().toUpperCase())
        ));
        if (!recipients.length) recipients = finalApprovers;

        if (recipients.length) {
          const creatorName = (req.user?.FirstName && req.user?.LastName)
            ? `${req.user.FirstName} ${req.user.LastName}`
            : (req.user?.name || req.user?.username || 'User');

          const pickRecipientId = (u) => {
            const first = (v) => Array.isArray(v) ? v[0] : v;
            const candidates = [
              u.userId, u.UserId, u.UserID,
              first(u.Username), u.username,
              u.userCode, u.UserCode,
              u.employeeCode, u.EmployeeCode,
              u.empCode, u.EmpCode,
              u.id, u.Id, u.ID
            ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
            return candidates[0] || String(u.id || '');
          };

          const docs = recipients.map(u => ({
            recipientUserId: pickRecipientId(u),
            title: 'Office approved submissions ready for finalization',
            message: `${creatorName} approved ${ids.length} item(s) at Office level. Ready for final approval.`,
            entity,
            recordIds: ids,
            org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
            createdBy: { userId: req.user?.id, name: creatorName }
          }));
          await Notification.insertMany(docs);
        }
      } catch (notifyErr) {
        // Non-blocking
        console.error('Notify error (office approve):', notifyErr?.message);
      }

      return res.status(200).json({ 
        success: true,
        message: 'Successfully approved submissions at Office level', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Office approval failed',
        error: e.message
      });
    }
  },

  // Step 5→6: Final approval - Finalize submissions (Office Approved → Finalized)
  officeFinalizeSubmission: async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', finalizationNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
          status: { $in: ['Office Approved', 'OFFICE APPROVED', 'Office Submitted', 'OFFICE SUBMITTED'] }
        },
        { 
          $set: { 
            status: 'Finalized',
            finalizedAt: new Date(),
            finalizedBy: userId,
            finalizedByName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            finalizationNote: finalizationNote || '',
            lastWorkflowTransition: 'FINALIZATION'
          },
          $push: {
            workflowHistory: {
              action: 'OFFICE_FINALIZE',
              toStatus: 'Finalized',
              byUserId: userId,
              byName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
              date: new Date(),
              note: finalizationNote || ''
            }
          }
        }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to finalize. Ensure items are Office Approved.',
          code: 'NO_MATCH_FINALIZE',
        });
      }

      // Create notifications for submitters and relevant stakeholders about finalization
      try {
        const Notification = require('../models/Notification');

        // sample record for org context
        const sample = await Model.findOne({ _id: { $in: ids } })
          .select('region department division processBy').lean();

        if (sample?.processBy) {
          // Notify the original submitter
          const submitterQuery = {
            $or: [
              { _id: sample.processBy },
              { FirstName: { $regex: new RegExp(`^${sample.processBy.split(' ')[0]}$`, 'i') } },
              { username: sample.processBy },
              { userCode: sample.processBy }
            ]
          };

          const User = require('../models/User');
          const submitter = await User.findOne(submitterQuery).select('_id FirstName LastName').lean();

          if (submitter) {
            const finalizerName = (req.user?.FirstName && req.user?.LastName)
              ? `${req.user.FirstName} ${req.user.LastName}`
              : (req.user?.name || req.user?.username || 'User');

            const notificationDoc = {
              recipientUserId: submitter._id.toString(),
              title: 'Your proposal has been finalized',
              message: `${finalizerName} has finalized ${ids.length} of your submitted item(s). The budget proposal is now complete.`,
              entity,
              recordIds: ids,
              org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
              createdBy: { userId: req.user?.id, name: finalizerName }
            };
            await Notification.create(notificationDoc);
          }
        }
      } catch (notifyErr) {
        // Non-blocking
        console.error('Notify error (finalize):', notifyErr?.message);
      }

      return res.status(200).json({ 
        success: true,
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
      return require('../models/PersonnelServices');
    case 'mooe':
      return require('../models/mooeProposals');
    case 'capital':
      return require('../models/CapitalOutlay');
    case 'income':
      return require('../models/Income');
    case 'budgetarySupport':
      return require('../models/BudgetarySupport');
    default:
      return require('../models/PersonnelServices');
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
