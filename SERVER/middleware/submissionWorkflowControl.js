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
const mongoose = require('mongoose');

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
        console.log(`🔍 [${userName}] Submission Workflow Access Check - Operation: ${operation}`);
      }

      // For submission workflow, DO NOT bypass based on roles alone
      // Even BUDGET ADMIN/ANALYST users must follow submission workflow if they have hierarchical assignments
      // Only bypass if user has SUPER_ADMIN role or no organizational constraints
      const isSuperAdmin = userRoles && userRoles.includes('SUPER_ADMIN');
      if (isSuperAdmin) {
        return next();
      }

      // Try to get user's assignment from new model first, fallback to old model
      let assignment = null;
      let isNewStructure = false;

      try {
        assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
        if (assignment) {
          isNewStructure = true;
        }
      } catch (error) {
        console.log('New assignment model not available, trying old model');
      }

      if (!assignment) {
        try {
          assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
          isNewStructure = false;
        } catch (error) {
          console.log('Old assignment model not available');
        }
      }

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
        await handleSubmissionWorkflowRead(req, res, next, assignment, { logAccess, userName, enforceSubmissionWorkflow, isNewStructure });
      } else if (['create', 'update', 'delete'].includes(operation)) {
        await handleSubmissionWorkflowWrite(req, res, next, assignment, operation, { logAccess, userName, strictMode, isNewStructure });
      } else {
        return next();
      }
    } catch (error) {
      console.error('Submission Workflow Control Error:', error);
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
            { responsibilityCenter: { $in: assignment.responsibilityCenters || [] } }
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
              { office: { $in: assignment.offices || [] } },
              {
                $or: [
                  // Own office-level data (no responsibility center specified, any status)
                  {
                    $and: [
                      { office: { $in: assignment.offices || [] } },
                      {
                        $or: [
                          { workflowLevel: 'OFFICE' },
                          { $or: [{ responsibilityCenter: { $exists: false } }, { responsibilityCenter: null }, { responsibilityCenter: "" }] }
                        ]
                      }
                    ]
                  },
                  // Responsibility Center data that has been submitted to office (Responsibility Center Submitted, Office Verified, or higher)
                  {
                    $and: [
                      { responsibilityCenter: { $exists: true, $ne: null, $ne: "" } },
                      { office: { $in: assignment.offices || [] } },
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
            office: { $in: assignment.offices || [] }
          };
          submissionFilters = hierarchicalFilters;
        }
        break;

      case 'FULL':
        // Full access users can see everything
        submissionFilters = {};
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
          // Division users see all their own data regardless of status
          // BUT only for records that originated at DIVISION level
          submissionFilters = {
            $and: [
              ...hierarchicalFilters.$and,
              { originalLevel: 'DIVISION' }
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
                          { status: { $in: ['Division Submitted', 'DIVISION SUBMITTED'] } },
                          { status: { $in: ['Department Verified', 'DEPARTMENT VERIFIED'] } },
                          { status: { $in: ['Department Submitted', 'DEPARTMENT SUBMITTED'] } },
                          { status: { $in: ['Region Approved', 'REGION APPROVED'] } },
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
  }

  // Add filters to request for use in controllers
  if (logAccess) {
    console.log(`🔍 [${userName}] Applied ${isNewStructure ? 'NEW' : 'OLD'} structure filters:`, {
      hierarchicalFilters,
      submissionFilters,
      accessScope: isNewStructure ? assignment.accessScope : assignment.assignmentLevel
    });
  }

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
  if (logAccess) {
    console.log(`✅ [${userName}] ${operation.toUpperCase()} access granted - Level: ${isNewStructure ? assignment.accessScope : assignment.assignmentLevel}`);
  }

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
            console.log('Invalid ObjectId format:', id);
            return id;
          }
        }
        return id;
      });

      console.log('Converted IDs:', objectIds);

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
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'RESPONSIBILITY_CENTER_TO_OFFICE'
          }
        }
      );

      console.log('Responsibility Center Submit Result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged
      });

      return res.status(200).json({
        message: 'Successfully submitted to Office for verification',
        modified: result.modifiedCount,
        matched: result.matchedCount
      });
    } catch (e) {
      console.error('Responsibility Center submission error:', e);
      return res.status(500).json({
        message: 'Responsibility Center submission failed',
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

      console.log('Office Verify Debug:', {
        ids,
        entity,
        userId,
        verificationNote
      });

      // Convert string IDs to ObjectId if needed
      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return mongoose.Types.ObjectId(id);
          } catch (e) {
            console.log('Invalid ObjectId format:', id);
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
            { originalLevel: { $exists: false } },
            { originalLevel: null },
            { originalLevel: '' }
          ],
          status: {
            $in: ['Responsibility Center Submitted', 'RESPONSIBILITY_CENTER SUBMITTED', 'Office Verified', 'OFFICE VERIFIED']
          }
        },
        {
          $set: {
            status: 'Office Verified',
            originalLevel: 'RESPONSIBILITY_CENTER', // Ensure originalLevel is set
            verifiedByOfficeAt: new Date(),
            verifiedByOfficeBy: userId,
            verificationNote: verificationNote || '',
            lastWorkflowTransition: 'OFFICE_VERIFICATION'
          } 
        }
      );
      console.log('Office Verify Result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged
      });

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
            submittedToOfficeAt: new Date(),
            submittedToOfficeBy: userId,
            approvalNote: approvalNote || '',
            lastWorkflowTransition: 'OFFICE_TO_FINALIZE'
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
            officeApprovalNote: officeApprovalNote || '',
            lastWorkflowTransition: 'OFFICE_APPROVAL'
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
          status: { $in: ['Office Approved', 'OFFICE APPROVED'] }
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
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching record to finalize. Ensure items are Office Approved.',
          code: 'NO_MATCH_FINALIZE',
        });
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
