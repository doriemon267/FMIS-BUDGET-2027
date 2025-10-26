/**
 * 🔐 Budget Role Visibility Control Middleware
 * 
 * Implements 6-step workflow role-based data visibility rules:
 * - STEP 1 (PREPARER): Can see own proposals and division proposals (all statuses)
 * - STEP 2 (REVIEWER): Can see proposals forwarded to review
 * - STEP 3 (APPROVER): Can see proposals forwarded to approval
 * - STEP 4 (BUDGET_PLANNING_ANALYST): Can see proposals forwarded for analysis
 * - STEP 5 (BUDGET_OFFICER): Can see proposals for final decision
 * - STEP 6 (OVERALL_APPROVER): Can see submitted proposals (after officer submission)
 */

const { hasFullAccess } = require('./securityMiddleware');

/**
 * Apply budget role-based visibility filters
 */
const budgetRoleVisibilityControl = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.Roles || [];
      
      // Super admins bypass all filters - check for both 'SUPER_ADMIN' (with underscore) and 'SUPER ADMIN' (with space)
      if (userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN')) {
        console.log('[budgetRoleVisibilityControl] SUPER ADMIN detected, bypassing filters');
        return next();
      }

      // Get hierarchical assignment for workflow roles
      const hierarchicalAssignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const workflowRoles = hierarchicalAssignment.workflowRoles || [];

      // Determine user's budget role (highest privilege takes precedence)
      // Check both main database roles and workflow roles from hierarchical assignment
      let budgetRole = null;
      if (userRoles.includes('BUDGET_ADMIN') || workflowRoles.includes('BUDGET_ADMIN')) {
        budgetRole = 'BUDGET_ADMIN';
      } else if (userRoles.includes('OVERALL_BUDGET_APPROVER') || workflowRoles.includes('OVERALL_BUDGET_APPROVER')) {
        budgetRole = 'OVERALL_BUDGET_APPROVER';
      } else if (userRoles.includes('BUDGET_OFFICER') || workflowRoles.includes('BUDGET_OFFICER')) {
        budgetRole = 'BUDGET_OFFICER';
      } else if (userRoles.includes('BUDGET_PLANNING_ANALYST') || workflowRoles.includes('BUDGET_PLANNING_ANALYST')) {
        budgetRole = 'BUDGET_PLANNING_ANALYST';
      } else if (userRoles.includes('APPROVER') || workflowRoles.includes('APPROVER') || workflowRoles.includes('divisionApprover') || workflowRoles.includes('officeApprover')) {
        budgetRole = 'APPROVER';
      } else if (userRoles.includes('REVIEWER') || workflowRoles.includes('REVIEWER') || workflowRoles.includes('divisionReviewer')) {
        budgetRole = 'REVIEWER';
      } else if (userRoles.includes('PREPARER') || workflowRoles.includes('PREPARER') || workflowRoles.includes('divisionCreator') || workflowRoles.includes('officeCreator')) {
        budgetRole = 'PREPARER';
      }

      if (!budgetRole) {
        // No budget role, skip filtering
        console.log('[budgetRoleVisibilityControl] No budget or workflow role detected, skipping filters');
        return next();
      }

      // Build visibility filters based on role
      let visibilityFilter = {};

      // Get hierarchical assignment for organizational filtering
      const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const userDivision = assignment.divisionName || req.user?.division || null;
      const userDepartment = assignment.departmentId || req.user?.department || null;
      const userRegion = assignment.regionId || req.user?.region || null;

      switch (budgetRole) {
        case 'BUDGET_PLANNING_ANALYST':
          // STEP 4 of 6-step workflow: PREPARER → REVIEWER → APPROVER → [BUDGET_PLANNING_ANALYST] → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET_PLANNING_ANALYST can see proposals forwarded by APPROVER AND proposals they've worked on
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to BUDGET_PLANNING_ANALYST
              { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
              { pendingWithRoles: 'BUDGET_PLANNING_ANALYST' },
              {
                status: {
                  $in: [
                    'Forwarded to Analyst',
                    'FORWARDED_TO_ANALYST'
                  ]
                }
              },
              // Proposals BUDGET_PLANNING_ANALYST has previously worked on (retain visibility)
              { 'workflowHistory.userId': userId },
              // Own proposals and organizational scope
              { createdByUserId: userId },
              { processBy: userId },
              ...(userDivision ? [{ division: userDivision }] : [])
            ]
          };
          break;

        case 'BUDGET_OFFICER':
          // STEP 5 of 6-step workflow: PREPARER → REVIEWER → APPROVER → BUDGET_ANALYST → [BUDGET_OFFICER] → OVERALL_APPROVER
          // BUDGET_OFFICER can see proposals forwarded by BUDGET_ANALYST AND proposals they've worked on
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to BUDGET_OFFICER
              {
                status: {
                  $in: [
                    'Forwarded to Budget Officer',
                    'FORWARDED_TO_BUDGET_OFFICER',
                    'Forwarded to Manager',
                    'FORWARDED_TO_MANAGER',
                    'Officer Approved',
                    'OFFICER_APPROVED',
                    'Finalized',
                    'Approved'
                  ]
                }
              },
              { currentAssigneeRole: 'BUDGET_OFFICER' },
              { pendingWithRoles: 'BUDGET_OFFICER' },
              // Proposals BUDGET_OFFICER has previously worked on (retain visibility)
              { 'workflowHistory.userId': userId },
              // Own proposals
              { createdByUserId: userId },
              { processBy: userId }
            ]
          };
          break;

        case 'BUDGET_ADMIN':
          // ADMIN: Can see all proposals regardless of status
          visibilityFilter = {}; // No filter for admins
          break;

        case 'PREPARER':
          // STEP 1 of 6-step workflow: [PREPARER] → REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // PREPARER creates drafts and can see all their proposals
          visibilityFilter = {
            $or: [
              // Own proposals created by this user
              { createdByUserId: userId },
              // Proposals assigned/processed by this user
              { processBy: userId },
              // Organizational scope proposals
              ...(userDivision ? [{ division: userDivision }] : []),
              ...(userDepartment ? [{ department: userDepartment }] : []),
              ...(userRegion ? [{ region: userRegion }] : [])
            ]
          };
          break;

        case 'REVIEWER':
          // STEP 2 of 6-step workflow: PREPARER → [REVIEWER] → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // REVIEWER can see proposals forwarded to them AND proposals they've previously worked on
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to REVIEWER
              {
                $and: [
                  { status: { $ne: 'Draft' } },
                  {
                    $or: [
                      { currentAssigneeRole: 'REVIEWER' },
                      { pendingWithRoles: 'REVIEWER' },
                      {
                        status: {
                          $in: [
                            'Forwarded to Reviewer',
                            'Under Review by Reviewer',
                            'Division Submitted',
                            'DIVISION SUBMITTED',
                            'Department Submitted',
                            'DEPARTMENT SUBMITTED'
                          ]
                        }
                      }
                    ]
                  }
                ]
              },
              // Proposals REVIEWER has previously worked on (retain visibility)
              { 'workflowHistory.userId': userId },
              // Own proposals
              { createdByUserId: userId },
              { processBy: userId }
            ]
          };
          break;

        case 'APPROVER':
          // STEP 3 of 6-step workflow: PREPARER → REVIEWER → [APPROVER] → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // APPROVER can see proposals forwarded to them AND proposals they've previously worked on
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to APPROVER
              {
                $and: [
                  { status: { $ne: 'Draft' } },
                  {
                    $or: [
                      { currentAssigneeRole: { $in: ['BUDGET_OFFICER', 'APPROVER'] } },
                      { pendingWithRoles: { $in: ['BUDGET_OFFICER', 'APPROVER'] } },
                      {
                        status: {
                          $in: [
                            'Forwarded to Approver',
                            'Forwarded to Officer',
                            'Under Review by Officer',
                            'UNDER REVIEW BY OFFICER',
                            'Department Verified',
                            'DEPARTMENT VERIFIED',
                            'Department Submitted',
                            'DEPARTMENT SUBMITTED'
                          ]
                        }
                      }
                    ]
                  }
                ]
              },
              // Proposals APPROVER has previously worked on (retain visibility)
              { 'workflowHistory.userId': userId },
              // Own proposals
              { createdByUserId: userId },
              { processBy: userId }
            ]
          };
          break;

        case 'OVERALL_BUDGET_APPROVER':
          // STEP 6 of 6-step workflow: PREPARER → REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → [OVERALL_APPROVER]
          // Final approval step - sees proposals forwarded by BUDGET_OFFICER AND proposals they've worked on
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to OVERALL_BUDGET_APPROVER
              {
                status: {
                  $in: [
                    'Division Submitted',
                    'DIVISION SUBMITTED',
                    'Department Verified',
                    'DEPARTMENT VERIFIED',
                    'Department Submitted',
                    'DEPARTMENT SUBMITTED',
                    'Responsibility Center Submitted',
                    'RESPONSIBILITY_CENTER_SUBMITTED',
                    'Office Verified',
                    'OFFICE VERIFIED',
                    'Forwarded to Manager',
                    'FORWARDED_TO_MANAGER',
                    'Officer Approved',
                    'OFFICER_APPROVED',
                    'Region Approved',
                    'REGION APPROVED'
                  ]
                }
              },
              { currentAssigneeRole: 'OVERALL_BUDGET_APPROVER' },
              { pendingWithRoles: 'OVERALL_BUDGET_APPROVER' },
              // Proposals OVERALL_BUDGET_APPROVER has previously worked on (retain visibility)
              { 'workflowHistory.userId': userId },
              // Own proposals
              { createdByUserId: userId },
              { processBy: userId }
            ]
          };
          break;

        default:
          // Unknown role, no additional filtering
          break;
      }

      // Attach visibility filter to request for use in controllers
      req.budgetRoleVisibilityFilter = visibilityFilter;
      
      next();
    } catch (error) {
      console.error('Error in budget role visibility control:', error);
      return res.status(500).json({
        success: false,
        message: 'Error applying role-based visibility',
        error: error.message
      });
    }
  };
};

module.exports = {
  budgetRoleVisibilityControl
};