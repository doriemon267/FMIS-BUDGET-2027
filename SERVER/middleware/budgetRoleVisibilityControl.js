/**
 * 🔐 Budget Role Visibility Control Middleware
 * 
 * Implements role-based data visibility rules:
 * - BUDGET_ANALYST: Can see own proposals and division proposals (all statuses)
 * - BUDGET_OFFICER: Can see approved/submitted proposals only (no drafts from others)
 * - BUDGET_MANAGER/ADMIN: Can see submitted proposals only (after officer submission)
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
      } else if (userRoles.includes('BUDGET_MANAGER') || workflowRoles.includes('BUDGET_ADMIN')) {
        budgetRole = 'BUDGET_MANAGER';
      } else if (userRoles.includes('BUDGET_OFFICER') || workflowRoles.includes('BUDGET_OFFICER')) {
        budgetRole = 'BUDGET_OFFICER';
      } else if (userRoles.includes('BUDGET_ANALYST') || workflowRoles.includes('BUDGET_ANALYST')) {
        budgetRole = 'BUDGET_ANALYST';
      } else if (userRoles.includes('OVERALL_BUDGET_APPROVER') || workflowRoles.includes('OVERALL_BUDGET_APPROVER')) {
        budgetRole = 'OVERALL_BUDGET_APPROVER';
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
        case 'BUDGET_ANALYST':
          // BUDGET_ANALYST can see:
          // 1. Own proposals (any status)
          // 2. Division proposals within their division (any status)
          visibilityFilter = {
            $or: [
              // Own proposals (any status)
              { createdByUserId: userId },
              { processBy: userId },
              // Division proposals (if user has a division)
              ...(userDivision ? [{ division: userDivision }] : [])
            ]
          };
          break;

        case 'BUDGET_OFFICER':
          // BUDGET_OFFICER can see:
          // 1. Own proposals (any status)
          // 2. Approved/Submitted/Finalized proposals from others (no Drafts)
          visibilityFilter = {
            $or: [
              // Own proposals (any status)
              { createdByUserId: userId },
              { processBy: userId },
              // Submitted/approved proposals from others
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
                    'REGION APPROVED',
                    'Final Approved',
                    'FINAL_APPROVED',
                    'Finalized',
                    'Approved',
                    'Submitted'
                  ]
                }
              }
            ]
          };
          break;

        case 'BUDGET_MANAGER':
        case 'BUDGET_ADMIN':
          // BUDGET_MANAGER/ADMIN can see:
          // Only submitted/approved/finalized proposals (no drafts from any level)
          // This enforces that they only see proposals after officer submission
          visibilityFilter = {
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
                'REGION APPROVED',
                'Final Approved',
                'FINAL_APPROVED',
                'Finalized',
                'Approved',
                'Submitted'
              ]
            }
          };
          break;

        case 'PREPARER':
          // PREPARER can see:
          // 1. Their own proposals (created by them) - any status including drafts
          // 2. Proposals in their workflow queue
          // 3. Proposals within their organizational scope (division/department/region)
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
          // REVIEWER can see:
          // 1. Their own proposals (created by them) - any status including drafts
          // 2. Proposals in their review workflow queue
          // 3. Proposals in specific statuses for review
          visibilityFilter = {
            $or: [
              // Own proposals created by this user
              { createdByUserId: userId },
              // Proposals assigned/processed by this user
              { processBy: userId },
              // Proposals in submitted/review statuses
              {
                status: {
                  $in: [
                    'Division Submitted',
                    'DIVISION SUBMITTED',
                    'Department Verified',
                    'DEPARTMENT VERIFIED',
                    'Department Submitted',
                    'DEPARTMENT SUBMITTED'
                  ]
                }
              }
            ]
          };
          break;

        case 'APPROVER':
          // APPROVER can see:
          // 1. Their own proposals (created by them) - any status including drafts
          // 2. Proposals in their approval workflow queue
          // 3. Proposals in submitted/verification statuses for approval
          visibilityFilter = {
            $or: [
              // Own proposals created by this user
              { createdByUserId: userId },
              // Proposals assigned/processed by this user
              { processBy: userId },
              // Proposals in submitted/verification statuses
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
                    'OFFICE VERIFIED'
                  ]
                }
              }
            ]
          };
          break;

        case 'OVERALL_BUDGET_APPROVER':
          // OVERALL_BUDGET_APPROVER can see:
          // 1. Their own proposals (created by them) - any status including drafts
          // 2. All submitted/verified/approved proposals for final approval
          visibilityFilter = {
            $or: [
              // Own proposals created by this user
              { createdByUserId: userId },
              // Proposals assigned/processed by this user
              { processBy: userId },
              // Proposals in any submitted/verified/approved status
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
              }
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