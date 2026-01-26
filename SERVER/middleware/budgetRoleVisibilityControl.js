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
const fs = require('fs');
const path = require('path');

// Log to file
const logToFile = (message) => {
  const logPath = path.join(__dirname, '..', 'logs', 'middleware-debug.log');
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
};

const budgetRoleVisibilityControl = () => {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    try {
      const userId = req.user?.id;
      // logToFile('🔍 BUDGET ROLE VISIBILITY MIDDLEWARE CALLED: ' + JSON.stringify({
      //   hasUser: !!req.user,
      //   userId: userId,
      //   userRoles: req.user?.Roles,
      //   url: req.url,
      //   method: req.method
      // }));

      // Load hierarchical assignment if not already loaded
      let hierarchicalAssignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      
      // Load hierarchical assignment if not already loaded
      if (!hierarchicalAssignment.userId) {
        try {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          let assignment = await HierarchicalUserAssignment.getUserPermissions(userId, userRoles);
          
          if (assignment) {
            // Check if it's a Mongoose document or a plain object (getUserPermissions can return both)
            hierarchicalAssignment = typeof assignment.toObject === 'function' ? assignment.toObject() : assignment;
            // Cache it on the request for other middleware
            req.userHierarchicalAssignment = hierarchicalAssignment;
          } 
        } catch (error) {
          console.error('❌ Error loading hierarchical assignment in visibility control:', error);
        }
      }
      const workflowRoles = hierarchicalAssignment.workflowRoles || [];
      const userRoles = req.user?.Roles || [];

      // Determine user's budget role (highest privilege takes precedence)
      // Check both main database roles and workflow roles from hierarchical assignment
      // CRITICAL: Check from highest to lowest privilege EXCEPT put PREPARER before REVIEWER
      // This ensures users with both REVIEWER and PREPARER roles get PREPARER access (can create/see Drafts)
      let budgetRole = null;
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN') || workflowRoles.includes('superAdmin')) {
        budgetRole = 'SUPER ADMIN';
      } else if (userRoles.includes('BUDGET MANAGER') || userRoles.includes('BUDGET_MANAGER') || workflowRoles.includes('budgetManager')) {
        budgetRole = 'BUDGET MANAGER';
      } else if (userRoles.includes('BUDGET OFFICER') || userRoles.includes('BUDGET_OFFICER') || workflowRoles.includes('BUDGET_OFFICER')) {
        budgetRole = 'BUDGET_OFFICER';
      } else if (userRoles.includes('BUDGET_PLANNING_ANALYST') || userRoles.includes('BUDGET PLANNING ANALYST') || workflowRoles.includes('BUDGET_PLANNING_ANALYST') || workflowRoles.includes('budgetAnalyst')) {
        budgetRole = 'BUDGET_PLANNING_ANALYST';
      } else if (userRoles.includes('BUDGET APPROVER') || userRoles.includes('BUDGET_APPROVER') || workflowRoles.includes('APPROVER') || workflowRoles.includes('divisionApprover') || workflowRoles.includes('officeApprover')) {
        budgetRole = 'BUDGET APPROVER';
      } else if (userRoles.includes('BUDGET PREPARER') || userRoles.includes('BUDGET_PREPARER') || workflowRoles.includes('divisionCreator') || workflowRoles.includes('officeCreator')) {
        budgetRole = 'BUDGET PREPARER';
      } else if (userRoles.includes('BUDGET REVIEWER') || userRoles.includes('BUDGET_REVIEWER') || workflowRoles.includes('divisionReviewer')) {
        budgetRole = 'BUDGET REVIEWER';
      }

      if (!budgetRole) {
        // No budget role, skip filtering
        return next();
      }

      // Build visibility filters based on role
      let visibilityFilter = {};

      // Get hierarchical assignment for organizational filtering
      const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const userDivision = assignment.divisionName || req.user?.division || null;
      
      // Populate department and region names from ObjectIds
      let userDepartment = null;
      let userRegion = null;
      
      if (assignment.departmentId) {
        try {
          const Department = require('../models/Department');
          const dept = await Department.findById(assignment.departmentId);
          userDepartment = dept ? dept.Department : null;
        } catch (error) {
          console.error('Error loading department name:', error);
        }
      }
      
      if (assignment.regionId) {
        try {
          const Region = require('../models/Region');
          const region = await Region.findById(assignment.regionId);
          userRegion = region ? region.Region : null;
        } catch (error) {
          console.error('Error loading region name:', error);
        }
      }

      console.log('🔍 BUDGET ROLE VISIBILITY DEBUG:', {
        userId: req.user?.id,
        userRoles: userRoles,
        budgetRole: budgetRole,
        userDivision: userDivision,
        userDepartment: userDepartment,
        userRegion: userRegion,
        assignmentLoaded: !!assignment.userId,
        hasHierarchicalAssignment: !!req.userHierarchicalAssignment
      });
      
      logToFile('DEBUG: ' + JSON.stringify({
        userId: req.user?.id, userRoles, budgetRole, userDivision, userDepartment, userRegion,
        assignmentLoaded: !!assignment.userId
      }));

      // Declare userName once for use in multiple cases
      const userName = req.user?.name || req.user?.Username || req.user?.displayName || req.user?.fullName;

      switch (budgetRole) {
        case 'BUDGET_PLANNING_ANALYST':
          // STEP 4 of 6-step workflow: PREPARER → BUDGET REVIEWER → BUDGET APPROVER → [BUDGET_PLANNING_ANALYST] → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET_PLANNING_ANALYST can see proposals forwarded by BUDGET APPROVER AND proposals they've worked on
          // WITH REGION FILTERING: Can only see proposals from assigned regions (or all if NIA-Wide)
          
          // Get region assignment for BUDGET_PLANNING_ANALYST
          const isNIAWide = hierarchicalAssignment.isNIAWide === true;
          const assignedRegions = hierarchicalAssignment.assignedRegions || [];
          
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
          } else if (assignedRegions && assignedRegions.length > 0) {
            // Specific regions: Can only see proposals from assigned regions
            visibilityFilter = {
              $and: [
                { region: { $in: assignedRegions } },  // Region must match assigned regions
                { $or: analystVisibilityOptions }       // And visibility rules must apply
              ]
            };
          } else {
            // No region assignment yet - show nothing for safety
            visibilityFilter = { _id: null }; // Return no proposals
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

        case 'SUPER ADMIN':
        case 'SUPER_ADMIN':
          // ADMIN: Can see only proposals they created, processed, or are assigned to
          // This prevents SUPER ADMIN from seeing proposals from other users/departments unless involved
          // NOTE: Different models use different field names:
          // - Proposal model uses: createdByUserId, processBy
          // - Entity models (PersonnelService, MooeProposal, etc.) use: processBy
          visibilityFilter = {
            $or: [
              // Proposals created by this user (Proposal model)
              { createdByUserId: userId },
              // Proposals processed by this user (used in both Proposal and entity models)
              { processBy: userId },
              { processBy: userName },
              // Proposals in their organizational scope
              ...(userDivision ? [{ division: userDivision }] : []),
              ...(userDepartment ? [{ department: userDepartment }] : []),
              ...(userRegion ? [{ region: userRegion }] : []),
              // Proposals assigned to them in workflow
              { 'workflowHistory.userId': userId }
            ]
          };
          break;

        case 'BUDGET PREPARER':
          // STEP 1 of 6-step workflow: [BUDGET PREPARER] → BUDGET REVIEWER → BUDGET APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_APPROVER
          // BUDGET PREPARER creates drafts and can see all their proposals
          visibilityFilter = {
            $or: [
              // Own proposals created by this user
              { createdByUserId: userId },
              // Proposals assigned/processed by this user (by ID or name)
              { $or: [
                { processBy: userId },
                { processBy: userName }
              ]},
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

        case 'BUDGET MANAGER':
          // STEP 6 of 6-step workflow: PREPARER → BUDGET REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → [BUDGET MANAGER]
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
      
      // Log the actual filter being applied for SUPER ADMIN
      if (budgetRole === 'SUPER ADMIN' || budgetRole === 'SUPER_ADMIN') {
        console.log('📋 SUPER ADMIN VISIBILITY FILTER:', JSON.stringify(visibilityFilter, null, 2));
        logToFile('SUPER ADMIN FILTER: ' + JSON.stringify(visibilityFilter));
      }
      
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