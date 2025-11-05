/**
 * 🔐 Budget Role Visibility Control Middleware
 * 
 * Implements 6-step workflow role-based data visibility rules:
 * - STEP 1 (PREPARER): Can see own proposals and division proposals (all statuses)
 * - STEP 2 (BUDGET REVIEWER): Can see proposals forwarded to review
 * - STEP 3 (BUDGET APPROVER): Can see proposals forwarded to approval
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
      
      console.log('🔐 [budgetRoleVisibilityControl] DEBUG REQUEST:', {
        userId,
        userRoles,
        userObject: req.user ? {
          id: req.user.id,
          Roles: req.user.Roles,
          roles: req.user.roles,
          Role: req.user.Role,
          role: req.user.role,
          hierarchicalAssignment: req.user.hierarchicalAssignment
        } : 'NO USER',
        hierarchicalAssignment: req.userHierarchicalAssignment ? {
          workflowRoles: req.userHierarchicalAssignment.workflowRoles,
          assignmentLevel: req.userHierarchicalAssignment.assignmentLevel
        } : 'NO HIERARCHICAL ASSIGNMENT'
      });
      
      // Super admins bypass all filters - check for both 'SUPER_ADMIN' (with underscore) and 'SUPER ADMIN' (with space)
      if (userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN')) {
        return next();
      }

      // Get hierarchical assignment for workflow roles
      const hierarchicalAssignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const workflowRoles = hierarchicalAssignment.workflowRoles || [];

      // Determine user's budget role (highest privilege takes precedence)
      // Check both main database roles and workflow roles from hierarchical assignment
      // CRITICAL: Check from highest to lowest privilege EXCEPT put PREPARER before REVIEWER
      // This ensures users with both REVIEWER and PREPARER roles get PREPARER access (can create/see Drafts)
      let budgetRole = null;
      if (userRoles.includes('BUDGET_ADMIN') || workflowRoles.includes('BUDGET_ADMIN')) {
        budgetRole = 'BUDGET_ADMIN';
      } else if (userRoles.includes('OVERALL_BUDGET_APPROVER') || workflowRoles.includes('OVERALL_BUDGET_APPROVER')) {
        budgetRole = 'OVERALL_BUDGET_APPROVER';
      } else if (userRoles.includes('BUDGET_OFFICER') || workflowRoles.includes('BUDGET_OFFICER')) {
        budgetRole = 'BUDGET_OFFICER';
      } else if (userRoles.includes('BUDGET_PLANNING_ANALYST') || workflowRoles.includes('BUDGET_PLANNING_ANALYST')) {
        budgetRole = 'BUDGET_PLANNING_ANALYST';
      } else if (userRoles.includes('BUDGET APPROVER') || userRoles.includes('BUDGET_APPROVER') || workflowRoles.includes('APPROVER') || workflowRoles.includes('divisionApprover') || workflowRoles.includes('officeApprover')) {
        budgetRole = 'BUDGET APPROVER';
      } else if (userRoles.includes('BUDGET PREPARER') || userRoles.includes('BUDGET_PREPARER') || workflowRoles.includes('BUDGET PREPARER') || workflowRoles.includes('BUDGET_PREPARER') || workflowRoles.includes('divisionCreator') || workflowRoles.includes('officeCreator')) {
        budgetRole = 'BUDGET PREPARER';
      } else if (userRoles.includes('BUDGET REVIEWER') || userRoles.includes('BUDGET_REVIEWER') || workflowRoles.includes('BUDGET REVIEWER') || workflowRoles.includes('BUDGET_REVIEWER') || workflowRoles.includes('divisionReviewer')) {
        budgetRole = 'BUDGET REVIEWER';
      }

      if (!budgetRole) {
        // No budget role, skip filtering
        console.log('[budgetRoleVisibilityControl] No budget or workflow role detected, skipping filters');
        return next();
      }

      console.log('🔐 [budgetRoleVisibilityControl] Role determined:', {
        userId,
        budgetRole,
        userRoles,
        workflowRoles,
        hasPreparer: userRoles.includes('BUDGET PREPARER') || userRoles.includes('BUDGET_PREPARER') || workflowRoles.includes('BUDGET PREPARER') || workflowRoles.includes('divisionCreator'),
        hasReviewer: userRoles.includes('BUDGET REVIEWER') || workflowRoles.includes('BUDGET REVIEWER') || workflowRoles.includes('divisionReviewer')
      });

      // Build visibility filters based on role
      let visibilityFilter = {};

      // Get hierarchical assignment for organizational filtering
      const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const userDivision = assignment.divisionName || req.user?.division || null;
      const userDepartment = assignment.departmentId || req.user?.department || null;
      const userRegion = assignment.regionId || req.user?.region || null;

      switch (budgetRole) {
        case 'BUDGET_PLANNING_ANALYST':
          // STEP 4 of 6-step workflow: PREPARER → BUDGET REVIEWER → BUDGET APPROVER → [BUDGET_PLANNING_ANALYST] → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET_PLANNING_ANALYST can see proposals forwarded by BUDGET APPROVER AND proposals they've worked on
          // WITH REGION FILTERING: Can only see proposals from assigned regions (or all if NIA-Wide)
          
          // Get region assignment for BUDGET_PLANNING_ANALYST
          const isNIAWide = hierarchicalAssignment.isNIAWide === true;
          const assignedRegions = hierarchicalAssignment.assignedRegions || [];
          
          console.log('🔐 [budgetRoleVisibilityControl] BUDGET_PLANNING_ANALYST region filtering:', {
            userId,
            isNIAWide,
            assignedRegions,
            hierarchicalAssignment: hierarchicalAssignment
          });
          
          // Build base visibility filter
          const analystVisibilityOptions = [
            // Proposals currently assigned to BUDGET_PLANNING_ANALYST
            {
              $and: [
                { $or: [
                  { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
                  { pendingWithRoles: 'BUDGET_PLANNING_ANALYST' }
                ]},
                { status: { $ne: 'Draft' } }
              ]
            },
            {
              status: {
                $in: [
                  'Forwarded to Budget Planning Analyst',
                  'Forwarded to Analyst', // legacy
                  'FORWARDED_TO_ANALYST'
                ]
              }
            },
            // Proposals BUDGET_PLANNING_ANALYST has previously worked on (retain visibility) - but not Drafts
            {
              $and: [
                { 'workflowHistory.userId': userId },
                { status: { $ne: 'Draft' } }
              ]
            },
            // Own proposals - but only if submitted (not Draft)
            {
              $and: [
                { $or: [
                  { createdByUserId: userId },
                  { processBy: userId }
                ]},
                { status: { $ne: 'Draft' } }
              ]
            },
            // Organizational division scope - but only if submitted (not Draft)
            ...(userDivision ? [{
              $and: [
                { division: userDivision },
                { status: { $ne: 'Draft' } }
              ]
            }] : [])
          ];
          
          // Apply region filtering based on assignment
          if (isNIAWide) {
            // NIA-Wide: No region restriction - can see all proposals
            visibilityFilter = { $or: analystVisibilityOptions };
            console.log('🌍 BUDGET_PLANNING_ANALYST has NIA-Wide access - showing all regions');
          } else if (assignedRegions && assignedRegions.length > 0) {
            // Specific regions: Can only see proposals from assigned regions
            visibilityFilter = {
              $and: [
                { region: { $in: assignedRegions } },  // Region must match assigned regions
                { $or: analystVisibilityOptions }       // And visibility rules must apply
              ]
            };
            console.log(`🔒 BUDGET_PLANNING_ANALYST restricted to regions: ${assignedRegions.join(', ')}`);
          } else {
            // No region assignment yet - show nothing for safety
            visibilityFilter = { _id: null }; // Return no proposals
            console.log('⚠️  BUDGET_PLANNING_ANALYST has no region assignment - showing no proposals');
          }
          break;

        case 'BUDGET_OFFICER':
          // STEP 5 of 6-step workflow: PREPARER → BUDGET REVIEWER → BUDGET APPROVER → BUDGET_ANALYST → [BUDGET_OFFICER] → OVERALL_APPROVER
          // BUDGET_OFFICER can see proposals forwarded by BUDGET_ANALYST AND proposals they've worked on
          // BUT: Cannot see Draft proposals (must be submitted first)
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to BUDGET_OFFICER
              {
                status: {
                  $in: [
                    'Forwarded to Budget Officer',
                    'FORWARDED_TO_BUDGET_OFFICER',
                    'Forwarded to Overall Budget Approver',
                    'Forwarded to Manager', // legacy
                    'FORWARDED_TO_MANAGER',
                    'Officer Approved',
                    'OFFICER_APPROVED',
                    'Finalized',
                    'Approved'
                  ]
                }
              },
              {
                $and: [
                  { $or: [
                    { currentAssigneeRole: 'BUDGET_OFFICER' },
                    { pendingWithRoles: 'BUDGET_OFFICER' }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Proposals BUDGET_OFFICER has previously worked on (retain visibility) - but not Drafts
              {
                $and: [
                  { 'workflowHistory.userId': userId },
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Own proposals - but only if submitted (not Draft)
              {
                $and: [
                  { $or: [
                    { createdByUserId: userId },
                    { processBy: userId }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
              }
            ]
          };
          break;

        case 'BUDGET_ADMIN':
          // ADMIN: Can see all proposals regardless of status
          visibilityFilter = {}; // No filter for admins
          break;

        case 'BUDGET PREPARER':
          // STEP 1 of 6-step workflow: [BUDGET PREPARER] → BUDGET REVIEWER → BUDGET APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET PREPARER creates drafts and can see all their proposals
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

        case 'BUDGET REVIEWER':
          // STEP 2 of 6-step workflow: PREPARER → [BUDGET REVIEWER] → BUDGET APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET REVIEWER can see proposals forwarded to them AND proposals they've previously worked on
          // CRITICAL: Cannot see Draft proposals AT ALL (must be submitted first)
          // This ensures clear role separation between PREPARER (creates) and REVIEWER (reviews submitted)
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to BUDGET REVIEWER
              {
                $and: [
                  { status: { $ne: 'Draft' } },
                  {
                    $or: [
                      { currentAssigneeRole: 'BUDGET REVIEWER' },
                      { pendingWithRoles: 'BUDGET REVIEWER' },
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
              // Proposals BUDGET REVIEWER has previously worked on (retain visibility) - but NEVER Drafts
              {
                $and: [
                  { 'workflowHistory.userId': userId },
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Own submitted proposals ONLY - NEVER Drafts (even if they created it)
              {
                $and: [
                  { $or: [
                    { createdByUserId: userId },
                    { processBy: userId }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
              }
            ]
          };
          break;

        case 'BUDGET APPROVER':
          // STEP 3 of 6-step workflow: PREPARER → BUDGET REVIEWER → [BUDGET APPROVER] → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // APPROVER can see proposals forwarded to them AND proposals they've previously worked on
          // BUT: Cannot see Draft proposals (must be submitted first)
          visibilityFilter = {
            $or: [
              // Proposals currently assigned to APPROVER
              {
                $and: [
                  { status: { $ne: 'Draft' } },
                  {
                    $or: [
                      { currentAssigneeRole: { $in: ['BUDGET_OFFICER', 'BUDGET APPROVER'] } },
                      { pendingWithRoles: { $in: ['BUDGET_OFFICER', 'BUDGET APPROVER'] } },
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
              // Proposals APPROVER has previously worked on (retain visibility) - but not Drafts
              {
                $and: [
                  { 'workflowHistory.userId': userId },
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Own proposals - but only if submitted (not Draft)
              {
                $and: [
                  { $or: [
                    { createdByUserId: userId },
                    { processBy: userId }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
              }
            ]
          };
          break;

        case 'OVERALL_BUDGET_APPROVER':
          // STEP 6 of 6-step workflow: PREPARER → BUDGET REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → [OVERALL_APPROVER]
          // Final approval step - sees proposals forwarded by BUDGET_OFFICER AND proposals they've worked on
          // BUT: Cannot see Draft proposals (must be submitted first)
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
                    'Forwarded to Overall Budget Approver',
                    'Forwarded to Manager',
                    'FORWARDED_TO_MANAGER',
                    'Officer Approved',
                    'OFFICER_APPROVED',
                    'Region Approved',
                    'REGION APPROVED'
                  ]
                }
              },
              {
                $and: [
                  { $or: [
                    { currentAssigneeRole: 'OVERALL_BUDGET_APPROVER' },
                    { pendingWithRoles: 'OVERALL_BUDGET_APPROVER' }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Proposals OVERALL_BUDGET_APPROVER has previously worked on (retain visibility) - but not Drafts
              {
                $and: [
                  { 'workflowHistory.userId': userId },
                  { status: { $ne: 'Draft' } }
                ]
              },
              // Own proposals - but only if submitted (not Draft)
              {
                $and: [
                  { $or: [
                    { createdByUserId: userId },
                    { processBy: userId }
                  ]},
                  { status: { $ne: 'Draft' } }
                ]
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
      
      console.log('🔐 [budgetRoleVisibilityControl] Filter applied:', {
        budgetRole,
        filterKeys: Object.keys(visibilityFilter),
        filterOrCount: visibilityFilter.$or?.length || 'N/A',
        sampleFilter: JSON.stringify(visibilityFilter).substring(0, 200) + '...'
      });
      
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