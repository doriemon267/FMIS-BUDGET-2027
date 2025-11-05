const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Notification = require('../models/Notification');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Department = require('../models/Department');
const Region = require('../models/Region');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const Income = require('../models/Income');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const ProposalEditLog = require('../models/ProposalEditLog');
const { applyEditsToOriginalDocuments } = require('./budgetOfficerEditController');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');

// Labels used when reporting missing budget modules during analyst submission validation
const MODULE_LABELS = {
  personnel: 'Personnel Services',
  mooe: 'Maintenance and Other Operating Expenses (MOOE)',
  capital: 'Capital Outlay',
  income: 'Income'
};

function normalizeRoleValue(roleValue) {
  if (!roleValue) return '';
  const base = roleValue.toString().trim();
  if (!base) return '';
  return base
    .toUpperCase()
    .replace(/[\s/-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '_');
}

function extractUserRoles(user = {}) {
  const sources = [
    user.Roles,
    user.roles,
    user.role,
    user.workflowRoles,
    user.budgetRoles,
    user.additionalRoles,
    user.access?.roles,
    user.access?.Roles,
    user.access?.role,
    user.hierarchicalAccess?.roles,
    user.hierarchicalAccess?.Roles,
    user.hierarchicalAccess?.role,
    user.currentUser?.roles,
    user.currentUser?.Roles,
    user.currentUser?.role
  ];

  const roleSet = new Set();

  const addRole = (role) => {
    if (!role || (typeof role !== 'string' && typeof role !== 'number')) return;
    const raw = role.toString().trim();
    if (!raw) return;
    if (!roleSet.has(raw)) {
      roleSet.add(raw);
    }
    const normalized = normalizeRoleValue(raw);
    if (normalized && !roleSet.has(normalized)) {
      roleSet.add(normalized);
    }
  };

  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      source.forEach(addRole);
    } else if (typeof source === 'string') {
      source.split(/[;,]+/).forEach(addRole);
    } else {
      addRole(source);
    }
  }

  return Array.from(roleSet);
}

function hasRole(userRoles, ...targets) {
  if (!Array.isArray(userRoles) || !userRoles.length || !targets.length) return false;
  const normalizedSet = new Set(userRoles.map(normalizeRoleValue).filter(Boolean));
  return targets.some((target) => normalizedSet.has(normalizeRoleValue(target)));
}

/**
 * Budget Role Access Control Middleware
 * Implements visibility rules based on budget roles and proposal status
 */
const budgetRoleAccessControl = (operation = 'read') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
  const userRoles = extractUserRoles(req.user);

      // Define role hierarchy - 6-step workflow roles + legacy budget roles
      // Check both main database roles and workflow roles from hierarchical assignment
      const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
      const workflowRoles = assignment.workflowRoles || [];
      
      const isPreparer = userRoles.includes('PREPARER') || workflowRoles.includes('PREPARER') || workflowRoles.includes('divisionCreator') || workflowRoles.includes('officeCreator');
      const isReviewer = userRoles.includes('REVIEWER') || workflowRoles.includes('REVIEWER') || workflowRoles.includes('divisionReviewer');
      const isApprover = userRoles.includes('BUDGET APPROVER') || workflowRoles.includes('APPROVER') || workflowRoles.includes('divisionApprover') || workflowRoles.includes('officeApprover');
      const isBudgetPlanningAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST') || workflowRoles.includes('BUDGET_PLANNING_ANALYST');
      const isOverallBudgetApprover = userRoles.includes('OVERALL_BUDGET_APPROVER') || workflowRoles.includes('OVERALL_BUDGET_APPROVER');
  // Deprecated alias kept for backward-compatibility (no literal BUDGET_ANALYST role in system)
  const isBudgetAnalyst = isBudgetPlanningAnalyst;
      const isBudgetCoordinator = userRoles.includes('BUDGET_COORDINATOR');
      const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER') || workflowRoles.includes('BUDGET_OFFICER');
      const isOverallApprover = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN') || workflowRoles.includes('BUDGET_ADMIN');
      // Check for both 'SUPER_ADMIN' (with underscore) and 'SUPER ADMIN' (with space) from database
      const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN');

      // Super admin and budget admin can see everything
      if (isSuperAdmin || userRoles.includes('BUDGET_ADMIN') || userRoles.includes('BUDGET ADMIN')) {
        return next();
      }

      if (operation === 'read') {
        // Build visibility filter based on role
        let visibilityFilter = {};

        // Extract hierarchical assignment once so multiple roles can reuse it
        const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
        const userDivision = assignment.divisionName || req.user?.division || null;
        const userDepartment = assignment.departmentId || req.user?.department || null;
        const userRegion = assignment.regionId || req.user?.region || null;

        // 6-STEP WORKFLOW ROLES
        if (isPreparer) {
          // Preparers can see their own proposals and proposals within their organizational scope
          visibilityFilter.$or = [
            { createdByUserId: userId },
            { processBy: userId },
            ...(userDivision ? [{ division: userDivision }] : []),
            ...(userDepartment ? [{ department: userDepartment }] : []),
            ...(userRegion ? [{ region: userRegion }] : [])
          ];
        } else if (isReviewer) {
          // Reviewers can see only proposals pending their review or in reviewer-specific statuses
          // IMPORTANT: Exclude Drafts from reviewer view to avoid showing unsubmitted items
          visibilityFilter = {
            $and: [
              { status: { $ne: 'Draft' } },
              {
                $or: [
                  { currentAssigneeRole: 'REVIEWER' },
                  { pendingWithRoles: 'REVIEWER' },
                  {
                    status: {
                      $in: [
                        'Division Submitted',
                        'Under Review by Reviewer',
                        'Department Submitted'
                      ]
                    }
                  }
                ]
              }
            ]
          };
        } else if (isApprover) {
          // Approvers can see proposals pending approval
          visibilityFilter.status = { $in: ['Reviewed', 'Pending Approval', 'Approved', 'Forwarded to Approver', 'Approver Approved'] };
        } else if (isBudgetPlanningAnalyst) {
          // Budget Planning Analysts can see proposals forwarded by approver
          visibilityFilter.status = { $in: ['Approver Approved'] };
        } else if (isOverallBudgetApprover) {
          // Overall Budget Approvers can see all proposals
          visibilityFilter.status = { $in: ['Division Submitted', 'Under Review', 'Reviewed', 'Pending Approval', 'Approved', 'Finalized', 'Officer Approved', 'Forwarded to Overall Budget Approver', 'Forwarded to Manager'] };
        } else if (isPreparer) {
          // Preparers: prefer to show only own proposals, but also include other proposals
          // from the same division so that approvals by the Officer don't make them disappear.
          if (userDivision) {
            visibilityFilter.$or = [
              { createdByUserId: userId },
              { division: userDivision }
            ];
          } else {
            // Fallback: only show own proposals
            visibilityFilter.createdByUserId = userId;
          }
        } else if (isBudgetCoordinator) {
          // Budget Coordinators can see:
          // 1. Proposals submitted by analysts in their division/department (Division Submitted)
          // 2. Proposals they have forwarded to officer (Forwarded to Officer)
          // 3. Finalized proposals for reference
          // 4. Their own proposals
          if (userDivision) {
            visibilityFilter.$or = [
              { createdByUserId: userId },
              { division: userDivision, status: { $in: ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Finalized'] } }
            ];
          } else {
            // Fallback: show proposals needing coordinator action
            visibilityFilter.$or = [
              { createdByUserId: userId },
              { status: { $in: ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Overall Budget Approver', 'Forwarded to Manager'] } }
            ];
          }
        } else if (isBudgetOfficer) {
          // Budget Officers can see:
          // 1. Proposals forwarded to them by coordinators (Forwarded to Officer)
          // 2. Proposals they have approved (Officer Approved)
          // 3. Proposals they have forwarded to manager (Forwarded to Manager)
          // 4. Finalized proposals for reference
          visibilityFilter.status = { $in: ['Forwarded to Officer', 'Officer Approved', 'Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Finalized'] };
        } else if (isOverallApprover) {
          // Budget Managers: primarily see items forwarded to them (Forwarded to Manager)
          // Also allow viewing of items that reached 'Officer Approved' or 'Finalized' so managers can review completed items
          visibilityFilter.status = { $in: ['Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Officer Approved', 'Finalized'] };
        }

        // Apply the filter to the query
        if (!req.query.visibilityFilter) {
          req.query.visibilityFilter = visibilityFilter;
        } else {
          // Merge with existing filter
          req.query.visibilityFilter = {
            $and: [req.query.visibilityFilter, visibilityFilter]
          };
        }
      } else if (operation === 'create' || operation === 'update' || operation === 'delete') {
        // For write operations, check if user has permission for this proposal
        if (req.params.id) {
          const proposal = await Proposal.findById(req.params.id);
          if (proposal) {
            const canAccess = checkProposalAccess(proposal, userId, userRoles);
            if (!canAccess) {
              return res.status(403).json({
                success: false,
                message: 'You do not have permission to modify this proposal'
              });
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('Budget role access control error:', error);
      res.status(500).json({
        success: false,
        message: 'Access control error',
        error: error.message
      });
    }
  };
};

// Helper function to check if user can access a specific proposal
function checkProposalAccess(proposal, userId, userRoles) {
  // 6-step workflow roles
  const isPreparer = userRoles.includes('PREPARER');
  const isReviewer = userRoles.includes('REVIEWER');
  const isApprover = userRoles.includes('BUDGET APPROVER');
  const isBudgetPlanningAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST');
  const isOverallBudgetApprover = userRoles.includes('OVERALL_BUDGET_APPROVER');
  // Legacy budget roles
  // No literal BUDGET_ANALYST role; use BUDGET_PLANNING_ANALYST
  const isBudgetAnalyst = false;
  const isBudgetCoordinator = userRoles.includes('BUDGET_COORDINATOR');
  const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
  const isOverallApprover = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
  // Check for both 'SUPER_ADMIN' (with underscore) and 'SUPER ADMIN' (with space) from database
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN');

  // Super admin and budget admin can access everything
  if (isSuperAdmin || userRoles.includes('BUDGET_ADMIN') || userRoles.includes('BUDGET ADMIN')) {
    return true;
  }

  // Users can always access their own proposals
  if (proposal.createdByUserId === userId) {
    return true;
  }

  // 6-STEP WORKFLOW ROLE ACCESS
  if (isReviewer && ['Draft', 'Division Submitted', 'Under Review', 'Reviewed'].includes(proposal.status)) {
    return true;
  }

  if (isApprover && ['Reviewed', 'Pending Approval', 'Approved', 'Forwarded to Approver', 'Approver Approved'].includes(proposal.status)) {
    return true;
  }

  if (isBudgetPlanningAnalyst && ['Approver Approved'].includes(proposal.status)) {
    return true;
  }

  if (isOverallBudgetApprover) {
    return true;  // Executives can see everything
  }

  // LEGACY BUDGET ROLE ACCESS
  if (isBudgetOfficer && ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Finalized'].includes(proposal.status)) {
    return true;
  }

  if (isOverallApprover) {
    // Managers only have access when the proposal has been forwarded to them
  if (['Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Officer Approved', 'Finalized'].includes(proposal.status)) return true;
    return false;
  }

  return false;
}

function sanitizeFilterObject(filter) {
  return Object.entries(filter || {}).reduce((clean, [key, value]) => {
    if (value === undefined || value === null) {
      return clean;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return clean;
    }
    clean[key] = value;
    return clean;
  }, {});
}

function buildModuleFilter(proposal) {
  // 🔴 CRITICAL FIX v2: Use ORGANIZATIONAL FILTERS as PRIMARY (they're what's actually populated)
  // proposalId field is often NULL in module records, so we must use division/department/region/budgetType
  // This matches how modules are actually created and stored in the database
  
  const baseFilter = sanitizeFilterObject({
    budgetType: proposal.budgetType,
    region: proposal.region
  });

  const orFilters = [];

  const addOrganizationalFilter = (extraCriteria = {}) => {
    const candidate = sanitizeFilterObject({ ...baseFilter, ...extraCriteria });
    if (Object.keys(candidate).length > 0) {
      orFilters.push(candidate);
    }
  };

  // Build organizational hierarchy filters (these are what's actually populated in module records)
  addOrganizationalFilter({ division: proposal.division });
  addOrganizationalFilter({ division: proposal.originalDivision });
  addOrganizationalFilter({ department: proposal.department });
  addOrganizationalFilter({ department: proposal.originalDepartment });
  addOrganizationalFilter({ processBy: proposal.processBy });

  if (!orFilters.length && Object.keys(baseFilter).length) {
    orFilters.push(baseFilter);
  }

  let combinedFilter;
  if (orFilters.length === 0) {
    combinedFilter = {};
  } else if (orFilters.length === 1) {
    combinedFilter = orFilters[0];
  } else {
    combinedFilter = { $or: orFilters };
  }

  // Add fiscal year conditions
  const yearConditions = [];
  if (proposal.fiscalYear) {
    yearConditions.push({ fiscalYear: proposal.fiscalYear });
  }
  const numericFiscalYear = Number(proposal.fiscalYear);
  if (!Number.isNaN(numericFiscalYear)) {
    yearConditions.push({ fiscalYear: numericFiscalYear });
    yearConditions.push({ fiscal_year: numericFiscalYear });
  }

  if (yearConditions.length) {
    const yearFilter = yearConditions.length === 1 ? yearConditions[0] : { $or: yearConditions };
    if (!combinedFilter || !Object.keys(combinedFilter).length) {
      combinedFilter = yearFilter;
    } else {
      combinedFilter = { $and: [combinedFilter, yearFilter] };
    }
  }

  return combinedFilter || {};
}

function appendStatusGuard(filter) {
  const statusGuard = { status: { $ne: 'Returned' } };

  if (!filter || !Object.keys(filter).length) {
    return statusGuard;
  }

  if (filter.status) {
    return filter;
  }

  if (filter.$or) {
    return { $and: [filter, statusGuard] };
  }

  return { ...filter, ...statusGuard };
}

function buildGroupStage(amountFields) {
  const fields = Array.isArray(amountFields) && amountFields.length ? amountFields : ['amount'];

  let amountExpression;
  if (fields.length === 1) {
    amountExpression = { $ifNull: [`$${fields[0]}`, 0] };
  } else {
    amountExpression = {
      $add: fields.map((field) => ({ $ifNull: [`$${field}`, 0] }))
    };
  }

  return {
    $group: {
      _id: null,
      count: { $sum: 1 },
      total: { $sum: amountExpression }
    }
  };
}

async function evaluateModuleCompletion(model, filter, amountFields) {
  const effectiveFilter = appendStatusGuard(filter);

  try {
    const pipeline = [
      { $match: effectiveFilter },
      buildGroupStage(amountFields)
    ];

    const [stats] = await model.aggregate(pipeline);

    const count = Number(stats?.count || 0);
    const total = Number(stats?.total || 0);
    const hasPositiveTotal = Number.isFinite(total) && Math.abs(total) > 0.0001;
    const hasEntries = count > 0 && hasPositiveTotal;

    // 🔴 ENHANCED DEBUG LOGGING
    console.log(`📋 Module ${model.modelName} evaluation:`, {
      found: count,
      total,
      isComplete: hasEntries,
      hasPositiveTotal,
      amountFields,
      effectiveFilter: JSON.stringify(effectiveFilter)
    });
    
    // Additional debug: show what records are being matched
    if (count > 0) {
      const sampleRecords = await model.find(effectiveFilter).limit(2).select('_id division department region budgetType fiscalYear');
      console.log(`  📌 Sample records matched:`, sampleRecords.map(r => ({
        id: r._id,
        div: r.division,
        dept: r.department,
        region: r.region,
        budgetType: r.budgetType,
        fy: r.fiscalYear
      })));
    }

    return {
      count,
      total,
      hasEntries,
      hasPositiveTotal,
      filter: effectiveFilter
    };
  } catch (error) {
    console.error(`❌ Error evaluating module completion for ${model.modelName}:`, {
      message: error.message,
      effectiveFilter: JSON.stringify(effectiveFilter)
    });
    return {
      count: 0,
      total: 0,
      hasEntries: false,
      hasPositiveTotal: false,
      error: error.message,
      filter: effectiveFilter
    };
  }
}

// Function definition for validateAnalystSubmissionReadiness
async function validateAnalystSubmissionReadiness(proposal) {
  const filters = buildModuleFilter(proposal);
  const regionName = (proposal.region || '').trim().toUpperCase();
  const isCentralOffice = regionName.includes('CENTRAL') && regionName.includes('OFFICE');
  const requiresIncome = !isCentralOffice;

  const [personnelStats, mooeStats, capitalStats, incomeStats] = await Promise.all([
    evaluateModuleCompletion(PersonnelServices, filters, ['Total']),
    evaluateModuleCompletion(mooeProposals, filters, ['amount']),
    evaluateModuleCompletion(CapitalOutlay, filters, ['cost']),
    requiresIncome ? evaluateModuleCompletion(Income, filters, ['amount']) : Promise.resolve({
      count: 0,
      total: 0,
      hasEntries: true,
      hasPositiveTotal: true,
      note: 'Income not required for Central Office'
    })
  ]);

  const details = {
    personnel: personnelStats,
    mooe: mooeStats,
    capital: capitalStats,
    income: incomeStats
  };

  console.log('📊 Analyst submission readiness check', {
    proposalId: proposal._id,
    region: proposal.region,
    requiresIncome,
    budgetType: proposal.budgetType,
    division: proposal.division,
    department: proposal.department,
    fiscalYear: proposal.fiscalYear,
    stats: {
      personnel: { count: personnelStats.count, total: personnelStats.total, hasEntries: personnelStats.hasEntries },
      mooe: { count: mooeStats.count, total: mooeStats.total, hasEntries: mooeStats.hasEntries },
      capital: { count: capitalStats.count, total: capitalStats.total, hasEntries: capitalStats.hasEntries },
      income: { count: incomeStats.count, total: incomeStats.total, hasEntries: incomeStats.hasEntries }
    }
  });

  const missingModules = [];

  if (!personnelStats.hasEntries) {
    missingModules.push(MODULE_LABELS.personnel);
  }

  if (!mooeStats.hasEntries) {
    missingModules.push(MODULE_LABELS.mooe);
  }

  if (!capitalStats.hasEntries) {
    missingModules.push(MODULE_LABELS.capital);
  }

  if (requiresIncome && !incomeStats.hasEntries) {
    missingModules.push(MODULE_LABELS.income);
  }

  const requirementMessage = requiresIncome
    ? 'Regional proposals must include Personnel Services, MOOE, Capital Outlay, and Income before submitting to the Budget Officer.'
    : 'Central Office proposals must include Personnel Services, MOOE, and Capital Outlay before submitting to the Budget Officer.';

  const message = missingModules.length
    ? `${requirementMessage} Missing modules: ${missingModules.join(', ')}.`
    : null;

  return {
    missingModules,
    requiresIncome,
    requirementMessage,
    details,
    message
  };
}

exports.checkAnalystSubmissionPrerequisites = async (req, res) => {
  try {
  const { proposalId } = req.params;
  const userId = req.user.id;
  const userRoles = extractUserRoles(req.user);

    if (!proposalId) {
      return res.status(400).json({ success: false, message: 'Proposal ID is required' });
    }

  const isPreparer = hasRole(userRoles, 'PREPARER');
    if (!isPreparer) {
      return res.status(403).json({ success: false, message: 'Only Preparers can validate submission prerequisites' });
    }

    let proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      const personnelRecord = await PersonnelServices.findById(proposalId);

      if (personnelRecord && personnelRecord.status === 'Draft') {
        proposal = await Proposal.findOne({
          division: personnelRecord.division,
          fiscalYear: personnelRecord.fiscalYear,
          budgetType: personnelRecord.budgetType,
          region: personnelRecord.region,
          status: 'Draft'
        });
      }
    }

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.createdByUserId && proposal.createdByUserId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not have access to check this proposal' });
    }

    const readiness = await validateAnalystSubmissionReadiness(proposal);
    const ready = readiness.missingModules.length === 0;

    res.json({
      success: true,
      ready,
      readiness
    });
  } catch (error) {
    console.error('Error checking analyst submission prerequisites:', error);
    res.status(500).json({ success: false, message: 'Failed to check submission prerequisites', error: error.message });
  }
};

/**
 * Helper function to sync proposal status to all related budget items
 * Updates status and workflowLevel for PersonnelServices, CapitalOutlay, mooeProposals, and Income
 */
async function syncBudgetItemsStatus(proposal) {
  try {
    const { status, workflowLevel, region, department, division, fiscalYear, budgetType, processBy } = proposal;
    
    // Map Proposal workflow to Budget Item workflow
    // Proposal uses: COORDINATOR, OFFICER, MANAGER
    // Budget Items use: DIVISION, DEPARTMENT, REGION, FINALIZED
    const workflowMapping = {
      'ANALYST': 'DIVISION',
      'COORDINATOR': 'DIVISION',
      'OFFICER': 'DEPARTMENT', 
      'MANAGER': 'REGION',
      'FINALIZED': 'FINALIZED'
    };
    
    const mappedWorkflowLevel = workflowMapping[workflowLevel] || 'DIVISION';
    
    // Map Proposal status to Budget Item status
    const statusMapping = {
      'Draft': 'Draft',
      'Division Submitted': 'Division Submitted',
      'Forwarded to Officer': 'Department Verified',
      'Officer Approved': 'Department Submitted',
  'Forwarded to Manager': 'Region Approved', // legacy
  'Forwarded to Overall Budget Approver': 'Region Approved',
      'Finalized': 'Finalized',
      'Returned': 'Returned',
      // Legacy mappings for backward compatibility
      'Office': 'Department Verified',
      'Office Approved': 'Department Submitted',
      'Office Submitted': 'Region Approved'
    };
    
    const mappedStatus = statusMapping[status] || status;
    
    // Build MULTIPLE filter criteria to match related budget items
    // Primary criteria - direct match
    const primaryCriteria = {
      region,
      department,
      division,
      fiscalYear,
      budgetType
    };

    // Also try matching by processBy if available (for consolidated proposals)
    const processedByFilter = processBy ? {
      processBy,
      fiscalYear,
      budgetType
    } : null;

    console.log('🔄 Syncing budget items status:', {
      proposalId: proposal._id,
      proposalStatus: status,
      mappedStatus: mappedStatus,
      proposalWorkflowLevel: workflowLevel,
      mappedWorkflowLevel: mappedWorkflowLevel,
      primaryCriteria,
      processedByFilter
    });

    // Build combined filter - items must match EITHER primary criteria OR processBy
    let combinedFilter = primaryCriteria;
    if (processedByFilter) {
      combinedFilter = {
        $or: [
          primaryCriteria,
          processedByFilter
        ]
      };
    }

    // Count existing items before update for debugging
    const [psCount, coCount, mooeCount, incomeCount] = await Promise.all([
      PersonnelServices.countDocuments(combinedFilter),
      CapitalOutlay.countDocuments(combinedFilter),
      mooeProposals.countDocuments(combinedFilter),
      Income.countDocuments(combinedFilter)
    ]);

    console.log('📊 Found budget items to update:', {
      personnelServices: psCount,
      capitalOutlay: coCount,
      mooeProposals: mooeCount,
      income: incomeCount,
      filter: combinedFilter
    });

    // Update all related budget items in parallel
    const updatePromises = [
      PersonnelServices.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel,
          updatedAt: new Date()
        } 
      }),
      CapitalOutlay.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel,
          updatedAt: new Date()
        } 
      }),
      mooeProposals.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel,
          updatedAt: new Date()
        } 
      }),
      Income.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel,
          updatedAt: new Date()
        } 
      })
    ];

    const results = await Promise.all(updatePromises);
    
    console.log('✅ Budget items status synced:', {
      personnelServices: results[0].modifiedCount,
      capitalOutlay: results[1].modifiedCount,
      mooeProposals: results[2].modifiedCount,
      income: results[3].modifiedCount,
      totalModified: results.reduce((sum, r) => sum + r.modifiedCount, 0)
    });

    return {
      success: true,
      updated: {
        personnelServices: results[0].modifiedCount,
        capitalOutlay: results[1].modifiedCount,
        mooeProposals: results[2].modifiedCount,
        income: results[3].modifiedCount
      }
    };
  } catch (error) {
    console.error('❌ Error syncing budget items status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function validateAndNormalizeComment(comment, actionDescription) {
  const normalized = (comment ?? '').toString().trim();
  if (!normalized) {
    const message = actionDescription
      ? `Comment is required to ${actionDescription}.`
      : 'Comment is required for this action.';
    throw new Error(message);
  }
  return normalized;
}

function updateAssignment(proposal, { step, assigneeRole, pendingRoles }) {
  if (step) {
    proposal.currentStep = step;
  }
  if (assigneeRole) {
    proposal.currentAssigneeRole = assigneeRole;
  }
  if (pendingRoles) {
    proposal.pendingWithRoles = pendingRoles;
  }
}

function recordWorkflowEvent(proposal, {
  action,
  comment,
  userId,
  userName,
  previousStatus,
  newStatus,
  targetRole,
  metadata
}) {
  proposal.workflowHistory.push({
    action,
    comment,
    userId,
    userName,
    timestamp: new Date(),
    previousStatus,
    newStatus,
    targetRole,
    metadata
  });
  proposal.lastActionBy = userName;
  proposal.lastActionDate = new Date();
}

/**
 * Budget Proposal Workflow Controller
 * Implements hierarchical workflow with mandatory comments and user tracking
 */

// Submit proposal directly to Budget Manager (bypassing Officer)
exports.submitDirectToManager = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    // Only PREPARER can use this endpoint
    if (!hasRole(userRoles, 'PREPARER')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Preparers can submit directly to Budget Manager' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);

    // If not found and proposalId looks like a personnel service ID, try to find the consolidated proposal
    if (!proposal) {
      console.log('SubmitDirectToManager: Proposal not found by ID, checking if this is a personnel service ID:', proposalId);

      // Check if this ID belongs to a personnel service with Draft status
      const PersonnelServices = require('../models/PersonnelServices');
      const personnelRecord = await PersonnelServices.findById(proposalId);

      if (personnelRecord && personnelRecord.status === 'Draft') {
        console.log('SubmitDirectToManager: Found personnel service record with Draft status, looking for consolidated proposal');

        // Find the consolidated proposal based on organizational criteria
        proposal = await Proposal.findOne({
          division: personnelRecord.division,
          fiscalYear: personnelRecord.fiscalYear,
          budgetType: personnelRecord.budgetType,
          region: personnelRecord.region,
          status: 'Draft'
        });

        if (proposal) {
          console.log('SubmitDirectToManager: Found consolidated proposal:', proposal._id);
        } else {
          console.log('SubmitDirectToManager: No consolidated proposal found for personnel service criteria');
        }
      }
    }

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

  // Verify the preparer owns this proposal
    if (proposal.createdByUserId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only submit your own proposals' 
      });
    }

    // Verify the proposal is in Draft status
    if (proposal.status !== 'Draft') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only Draft proposals can be submitted directly to Budget Manager' 
      });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'submit the proposal directly to the Budget Manager');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    // Update proposal status - submit directly to Manager level
    const previousStatus = proposal.status;
  const newStatus = 'Forwarded to Overall Budget Approver';
    const workflowLevel = 'MANAGER';

    proposal.status = newStatus;
    proposal.workflowLevel = workflowLevel;
  proposal.submittedByRole = 'PREPARER';
    proposal.submittedDate = new Date();
    proposal.directSubmissionToManager = true; // Flag to indicate this bypassed Officer review
  proposal.bypassedOfficerReview = true;

    updateAssignment(proposal, {
      step: 'MANAGER_REVIEW',
      assigneeRole: 'BUDGET_MANAGER',
      pendingRoles: ['BUDGET_MANAGER']
    });

    recordWorkflowEvent(proposal, {
      action: 'SUBMIT_DIRECT_TO_MANAGER',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_MANAGER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Recalculate proposal totals so dashboards/overview are immediately accurate
    try {
      await recalculateAndSaveProposalTotals({ proposalId: proposal._id });
    } catch (recalcErr) {
      console.warn('⚠️ Totals recalculation failed after approver submit to officer:', recalcErr?.message || recalcErr);
    }

    // Send notification to Budget Manager
    await sendNotification({
      recipientRole: 'BUDGET_MANAGER',
      title: 'New Proposal Submitted (Direct)',
  message: `Proposal "${proposal.title}" submitted directly from ${proposal.division || proposal.department} by ${userName} (Preparer). Comment: ${sanitizedComment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal submitted directly to Budget Manager successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error submitting proposal directly to manager:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

// Save draft progress (Preparer)
exports.saveDraft = async (req, res) => {
  try {
    const { proposalId, comment, updates } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.FirstName} ${req.user.LastName}`;
  const userRoles = extractUserRoles(req.user);

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

  const isPreparer = hasRole(userRoles, 'PREPARER');
    const isCreator = proposal.createdByUserId === userId;

    if (!isPreparer && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned Preparer can save this draft'
      });
    }

    if (!['Draft', 'Returned'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Draft can only be saved while proposal is in Draft or Returned status. Current status: ${proposal.status}`
      });
    }

    const allowedFields = new Set([
      'title',
      'description',
      'categoryBreakdown',
      'proposedBudget',
      'totalExpenses',
      'totalIncome',
      'projectedCorporateIncome',
      'projectedSubsidy',
      'cobExpenditures'
    ]);

    const appliedFields = [];
    if (updates && typeof updates === 'object') {
      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.has(field)) {
          proposal[field] = value;
          appliedFields.push(field);
          if (field === 'categoryBreakdown') {
            proposal.markModified('categoryBreakdown');
          }
        }
      }
    }

    const now = new Date();
    const sanitizedComment = (comment ?? '').toString().trim();
    const historyComment = sanitizedComment || 'Draft saved';

    proposal.draftState = {
      lastSavedBy: userId,
      lastSavedByName: userName,
      lastSavedAt: now,
      note: sanitizedComment
    };

    const nextVersion = (proposal.version || 1) + 1;
    proposal.version = nextVersion;
    proposal.editHistory.push({
      version: nextVersion,
      editedBy: userId,
      editedByName: userName,
      editedAt: now,
      reason: historyComment,
      previousStatus: proposal.status
    });

    updateAssignment(proposal, {
      step: 'PREPARER_DRAFT',
      assigneeRole: 'PREPARER',
      pendingRoles: ['PREPARER']
    });

    recordWorkflowEvent(proposal, {
      action: 'SAVE_DRAFT',
      comment: historyComment,
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'PREPARER',
      metadata: {
        updatedFields: appliedFields
      }
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Draft saved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        draftState: proposal.draftState,
        version: proposal.version,
        updatedFields: appliedFields
      }
    });
  } catch (error) {
    console.error('Error saving proposal draft:', error);
    res.status(500).json({ success: false, message: 'Failed to save draft', error: error.message });
  }
};

// Submit proposal along the strict 6-step path
exports.submitProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.FirstName} ${req.user.LastName}`;
  const userRoles = extractUserRoles(req.user);

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'submit the proposal');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    let proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      const personnelRecord = await PersonnelServices.findById(proposalId);

      if (personnelRecord && personnelRecord.status === 'Draft') {
        proposal = await Proposal.findOne({
          division: personnelRecord.division,
          fiscalYear: personnelRecord.fiscalYear,
          budgetType: personnelRecord.budgetType,
          region: personnelRecord.region,
          status: 'Draft'
        });
      }
    }

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

  const isPreparer = hasRole(userRoles, 'PREPARER', 'BUDGET_PREPARER');
    const isBudgetAnalyst = hasRole(userRoles, 'BUDGET_PLANNING_ANALYST');
    const isCreator = proposal.createdByUserId === userId;

    if (!isPreparer && !isBudgetAnalyst && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned Preparer or Budget Planning Analyst can submit this proposal'
      });
    }

    // Branch by role and current status
    if (isPreparer) {
      if (proposal.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          message: `Proposal must be in Draft status before submission to Reviewer. Current status: ${proposal.status}`
        });
      }
    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Reviewer';

    proposal.status = newStatus;
  proposal.workflowLevel = 'REVIEWER';
      proposal.submittedByRole = 'PREPARER';
      proposal.submittedDate = new Date();
      proposal.bypassedOfficerReview = false;

      updateAssignment(proposal, {
        step: 'REVIEWER_REVIEW',
        assigneeRole: 'REVIEWER',
        pendingRoles: ['REVIEWER']
      });

      recordWorkflowEvent(proposal, {
        action: 'PREPARER_SUBMIT_TO_REVIEWER',
        comment: sanitizedComment,
        userId,
        userName,
        previousStatus,
        newStatus,
        targetRole: 'REVIEWER'
      });

      await proposal.save();

      await syncBudgetItemsStatus(proposal);

      await sendNotification({
        recipientRole: 'REVIEWER',
        title: 'Proposal Submitted for Review',
        message: `Proposal "${proposal.title}" from ${proposal.division || proposal.department} has been submitted by ${userName}. Comment: ${sanitizedComment}`,
        entity: 'proposal',
        recordIds: [proposal._id],
        org: {
          region: proposal.region,
          department: proposal.department,
          division: proposal.division
        },
        createdBy: { userId, name: userName }
      });

      return res.json({
        success: true,
        message: 'Proposal submitted to Budget Reviewer successfully',
        proposal: {
          id: proposal._id,
          status: proposal.status,
          workflowLevel: proposal.workflowLevel,
          currentStep: proposal.currentStep,
          pendingWithRoles: proposal.pendingWithRoles
        }
      });
    }

    // Analyst path: forward to Budget Officer after Approver stage
    if (!['Forwarded to Approver', 'Approver Approved', 'Forwarded to Budget Planning Analyst'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit at this stage. Current status: ${proposal.status}`
      });
    }

  if (isBudgetAnalyst) {
      const readiness = await validateAnalystSubmissionReadiness(proposal);

      if (readiness.missingModules.length) {
        console.warn('⛔ Analyst submission prevented due to incomplete modules', {
          proposalId,
          missingModules: readiness.missingModules,
          region: proposal.region,
          requiresIncome: readiness.requiresIncome
        });

        return res.status(400).json({
          success: false,
          code: 'ANALYST_SUBMISSION_PREREQUISITES_INCOMPLETE',
          message: readiness.message,
          missingModules: readiness.missingModules,
          details: readiness.details,
          requiresIncome: readiness.requiresIncome
        });
      }
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Budget Officer';

    proposal.status = newStatus;
    proposal.workflowLevel = 'OFFICER';
    proposal.submittedByRole = 'BUDGET_PLANNING_ANALYST';
    proposal.submittedDate = new Date();
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    recordWorkflowEvent(proposal, {
      action: 'ANALYST_SUBMIT_TO_OFFICER',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    await syncBudgetItemsStatus(proposal);

    // Ensure proposal overview totals are recalculated upon submission
    try {
      await recalculateAndSaveProposalTotals({ proposalId: proposal._id });
    } catch (recalcErr) {
      console.warn('⚠️ Totals recalculation failed after analyst submit:', recalcErr?.message || recalcErr);
    }

    await sendNotification({
      recipientRole: 'BUDGET_OFFICER',
      title: 'Proposal Submitted for Review',
      message: `Proposal "${proposal.title}" from ${proposal.division || proposal.department} has been submitted by ${userName}. Comment: ${sanitizedComment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Officer successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel,
        currentStep: proposal.currentStep,
        pendingWithRoles: proposal.pendingWithRoles
      }
    });

  } catch (error) {
    console.error('Error submitting proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

// Approve proposal (Budget Officer or Budget Manager)
exports.approveProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'approve this proposal');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    // First try to find by proposal ID (for consolidated proposals)
    let proposal = await Proposal.findById(proposalId);

    // If not found and proposalId looks like a personnel service ID, try to find the consolidated proposal
    if (!proposal) {
      console.log('Proposal not found by ID, checking if this is a personnel service ID:', proposalId);

      // Check if this ID belongs to a personnel service with Division Submitted status
      const PersonnelServices = require('../models/PersonnelServices');
      const personnelRecord = await PersonnelServices.findById(proposalId);

      if (personnelRecord && personnelRecord.status === 'Division Submitted') {
        console.log('Found personnel service record, looking for consolidated proposal');

        // Find the consolidated proposal based on organizational criteria
        proposal = await Proposal.findOne({
          division: personnelRecord.division,
          fiscalYear: personnelRecord.fiscalYear,
          budgetType: personnelRecord.budgetType,
          region: personnelRecord.region,
          status: 'Division Submitted'
        });

        if (proposal) {
          console.log('Found consolidated proposal:', proposal._id);
        } else {
          console.log('No consolidated proposal found for personnel service criteria');
        }
      }
    }

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    console.log('=== WORKFLOW APPROVAL DEBUG ===');
    console.log('Proposal ID:', proposal._id);
    console.log('Current Status:', proposal.status);
    console.log('User Roles:', userRoles);
    console.log('User ID:', userId);
    console.log('User Name:', userName);
    
  const previousStatus = proposal.status;
  let newStatus;
  let approvalField;
  let nextAssigneeRole = null;
  let nextPendingRoles = [];
  let nextStep = proposal.currentStep;
  let targetRole = null;

    // Determine the appropriate workflow action based on CURRENT STATUS and user roles
    // This prevents users with multiple roles from skipping workflow steps
    
    if ((previousStatus === 'Forwarded to Officer' || previousStatus === 'Office') && userRoles.includes('BUDGET_OFFICER')) {
      // BUDGET_OFFICER approves (from COORDINATOR) → Officer Approved
      newStatus = 'Officer Approved';
      approvalField = 'approvedByOfficer';
      proposal.workflowLevel = 'OFFICER';
      proposal.approvedByRole = 'BUDGET_OFFICER';
      console.log('✅ BUDGET_OFFICER approval (Forwarded to Officer → Officer Approved)');
      nextAssigneeRole = 'BUDGET_OFFICER';
      nextPendingRoles = ['BUDGET_OFFICER'];
      nextStep = 'OFFICER_REVIEW';
      targetRole = 'BUDGET_OFFICER';
    } else if (previousStatus === 'Officer Approved' && userRoles.includes('BUDGET_OFFICER')) {
      // BUDGET_OFFICER submits to OVERALL_BUDGET_APPROVER (Budget Manager)
      newStatus = 'Forwarded to Overall Budget Approver';
      approvalField = 'submittedByOfficer';
      proposal.workflowLevel = 'MANAGER';
      proposal.submittedByRole = 'BUDGET_OFFICER';
      console.log('✅ BUDGET_OFFICER submission to Manager (Officer Approved → Forwarded to Manager)');
      nextAssigneeRole = 'BUDGET_MANAGER';
      nextPendingRoles = ['BUDGET_MANAGER'];
      nextStep = 'MANAGER_REVIEW';
      targetRole = 'BUDGET_MANAGER';
  } else if ((previousStatus === 'Forwarded to Overall Budget Approver' || previousStatus === 'Forwarded to Manager' || previousStatus === 'Office Submitted') && (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN'))) {
      // BUDGET_MANAGER final approval
      newStatus = 'Finalized';
      approvalField = 'approvedByManager';
      proposal.workflowLevel = 'FINALIZED';
      console.log('✅ BUDGET_MANAGER final approval (Forwarded to Manager → Finalized)');
  nextAssigneeRole = 'BUDGET_MANAGER';
      nextPendingRoles = [];
      nextStep = 'FINALIZED';
    } else if (previousStatus === 'Division Submitted' && (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) && !userRoles.includes('BUDGET_OFFICER')) {
      // BUDGET_MANAGER directly approving (only if they don't have BUDGET_OFFICER role)
      newStatus = 'Finalized';
      approvalField = 'approvedByManager';
      proposal.workflowLevel = 'FINALIZED';
      console.log('✅ BUDGET_MANAGER direct approval (Division Submitted → Finalized)');
      nextAssigneeRole = 'BUDGET_MANAGER';
      nextPendingRoles = [];
      nextStep = 'FINALIZED';
    } else {
      console.log('❌ Invalid workflow transition:', {
        currentStatus: previousStatus,
        userRoles,
        message: 'Cannot approve proposal at this stage'
      });
      return res.status(403).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${previousStatus}". Expected status: ${
          userRoles.includes('BUDGET_OFFICER') ? 'Officer Approved' : 
      userRoles.includes('BUDGET_MANAGER') ? 'Forwarded to Overall Budget Approver' : 
          'Unknown'
        }` 
      });
    }

    proposal.status = newStatus;
    console.log('Status updated from', previousStatus, 'to', newStatus);
    proposal[approvalField] = {
      userId,
      userName,
      date: new Date(),
      comment: sanitizedComment
    };

    updateAssignment(proposal, {
      step: nextStep,
      assigneeRole: nextAssigneeRole,
      pendingRoles: nextPendingRoles
    });

    recordWorkflowEvent(proposal, {
      action: 'APPROVE',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole
    });

    const savedProposal = await proposal.save();
    console.log('✅ Proposal saved successfully');
    console.log('Saved proposal status:', savedProposal.status);
    console.log('Saved proposal workflowLevel:', savedProposal.workflowLevel);

    // 🔄 UPDATE RELATED ENTITY RECORDS 
    console.log('🔄 Updating related entity records...');
    
    // Build filter to find related entity records
    const entityFilter = {
      region: proposal.region,
      department: proposal.department,
      division: proposal.division || proposal.department,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      processBy: proposal.processBy
    };
    
    console.log('🔍 Entity filter criteria:', JSON.stringify(entityFilter, null, 2));
    
    // Map proposal status to entity status
    // BUDGET_OFFICER approves → 'Officer Approved' (approved by officer)
    // BUDGET_OFFICER submits → 'Forwarded to Manager' (pending MANAGER approval)
    // BUDGET_MANAGER approves → 'Finalized' (approved by manager)
    let entityStatus, entityWorkflowLevel;
    if (newStatus === 'Officer Approved') {
      // BUDGET_OFFICER approved the proposal
      entityStatus = 'Department Submitted';
      entityWorkflowLevel = 'OFFICER';
    } else if (newStatus === 'Forwarded to Overall Budget Approver') {
      // BUDGET_OFFICER submitted to BUDGET_MANAGER for approval
      entityStatus = 'Region Approved';
      entityWorkflowLevel = 'MANAGER';
    } else if (newStatus === 'Finalized') {
      entityStatus = 'Finalized';
      entityWorkflowLevel = 'FINALIZED';
    }

    const entityUpdate = {
      $set: {
        status: entityStatus,
        workflowLevel: entityWorkflowLevel,
        lastActionBy: userName,
        lastActionDate: new Date()
      }
    };

    try {
      // First, let's count how many records match our filter
      const psCount = await PersonnelServices.countDocuments(entityFilter);
      const coCount = await CapitalOutlay.countDocuments(entityFilter);
      const mooeCount = await mooeProposals.countDocuments(entityFilter);
      const incomeCount = await Income.countDocuments(entityFilter);
      
      console.log(`🔍 Found potential matches: PS=${psCount}, CO=${coCount}, MOOE=${mooeCount}, Income=${incomeCount}`);
      
      // If we have matches, let's also check their current status
      if (psCount > 0) {
        const samplePS = await PersonnelServices.findOne(entityFilter);
        console.log(`📋 Sample PersonnelServices record status: ${samplePS?.status}, division: ${samplePS?.division}`);
      }
      
      // Update PersonnelServices records
      const psResult = await PersonnelServices.updateMany(entityFilter, entityUpdate);
      console.log(`📊 Updated ${psResult.matchedCount} PersonnelServices records (${psResult.modifiedCount} modified)`);
      
      // Update CapitalOutlay records
      const coResult = await CapitalOutlay.updateMany(entityFilter, entityUpdate);
      console.log(`📊 Updated ${coResult.matchedCount} CapitalOutlay records (${coResult.modifiedCount} modified)`);
      
      // Update MOOE Proposals records
      const mooeResult = await mooeProposals.updateMany(entityFilter, entityUpdate);
      console.log(`📊 Updated ${mooeResult.matchedCount} MOOE Proposals records (${mooeResult.modifiedCount} modified)`);
      
      // Update Income records (if they have status field)
      const incomeResult = await Income.updateMany(entityFilter, entityUpdate);
      console.log(`📊 Updated ${incomeResult.matchedCount} Income records (${incomeResult.modifiedCount} modified)`);
      
      const totalMatched = psResult.matchedCount + coResult.matchedCount + mooeResult.matchedCount + incomeResult.matchedCount;
      const totalModified = psResult.modifiedCount + coResult.modifiedCount + mooeResult.modifiedCount + incomeResult.modifiedCount;
      
      console.log(`✅ Entity update summary: ${totalMatched} matched, ${totalModified} modified`);
    } catch (entityUpdateError) {
      console.error('⚠️ Error updating entity records:', entityUpdateError);
      // Don't fail the whole operation if entity updates fail
    }

    // Send notification to submitter
  const submitterMessage = `Your proposal "${proposal.title}" has been approved by ${userName} with comment: ${sanitizedComment}`;
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved',
      message: submitterMessage,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal approved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error approving proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to approve proposal', error: error.message });
  }
};

// Return proposal with comment (Budget Officer or Budget Manager)
exports.returnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'return this proposal');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';
    const performedByRole = (userRoles.find(role => String(role).toUpperCase().startsWith('BUDGET_')) || userRoles[0] || '').toUpperCase();
    let returnField;
  let returnToLevel = 'BUDGET_PLANNING_ANALYST';
    let notificationMessage;
    let targetRole = null;
    let assignmentStep = proposal.currentStep;
    let assignmentRole = proposal.currentAssigneeRole;
    let assignmentPendingRoles = proposal.pendingWithRoles;
    const notificationPayloads = [];
    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    // Determine return path based on current status and user role
    if (userRoles.includes('BUDGET_OFFICER')) {
      // BUDGET_OFFICER returns to BUDGET_PLANNING_ANALYST
      if (['Forwarded to Budget Officer', 'Officer Approved'].includes(proposal.status)) {
        returnField = 'returnedByOfficer';
  proposal.workflowLevel = 'BUDGET_PLANNING_ANALYST';
  returnToLevel = 'BUDGET_PLANNING_ANALYST';
        notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName} (Budget Officer) for revisions. Reason: ${sanitizedComment}`;
        targetRole = 'BUDGET_PLANNING_ANALYST';
        assignmentStep = 'BUDGET_PLANNING_ANALYST_REVIEW';
        assignmentRole = 'BUDGET_PLANNING_ANALYST';
        assignmentPendingRoles = ['BUDGET_PLANNING_ANALYST'];
        notificationPayloads.push({
          recipientRole: 'BUDGET_PLANNING_ANALYST',
          title: 'Proposal Returned by Officer',
          message: notificationMessage,
          ...baseNotificationFields,
          metadata: {
            proposalId: String(proposal._id),
            proposalTitle: proposal.title,
            fiscalYear: proposal.fiscalYear,
            budgetType: proposal.budgetType,
            region: proposal.region,
            department: proposal.department,
            division: proposal.division,
            action: 'RETURN',
            comment: sanitizedComment,
            previousStatus,
            newStatus,
            returnToLevel,
            targetRole: 'BUDGET_PLANNING_ANALYST',
            performedBy: {
              userId,
              name: userName,
              role: performedByRole
            },
            recipientType: 'ROLE'
          }
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot return proposal with status "${proposal.status}". Expected status: Forwarded to Budget Officer or Officer Approved` 
        });
      }
    } else if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) {
      // BUDGET_MANAGER returns based on who submitted
  if (proposal.status === 'Forwarded to Overall Budget Approver' || proposal.status === 'Forwarded to Manager' || proposal.status === 'Office Submitted') {
        returnField = 'returnedByManager';
        
        // Check if proposal bypassed officer review
        if (proposal.bypassedOfficerReview || proposal.submittedByRole === 'REVIEWER') {
          // Return to REVIEWER
          proposal.workflowLevel = 'REVIEWER';
          returnToLevel = 'REVIEWER';
          notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) for revisions. Reason: ${sanitizedComment}`;
          targetRole = 'REVIEWER';
          assignmentStep = 'REVIEWER_REVIEW';
          assignmentRole = 'REVIEWER';
          assignmentPendingRoles = ['REVIEWER'];
          notificationPayloads.push({
            recipientRole: 'REVIEWER',
            title: 'Proposal Returned by Manager',
            message: notificationMessage,
            ...baseNotificationFields,
            metadata: {
              proposalId: String(proposal._id),
              proposalTitle: proposal.title,
              fiscalYear: proposal.fiscalYear,
              budgetType: proposal.budgetType,
              region: proposal.region,
              department: proposal.department,
              division: proposal.division,
              action: 'RETURN',
              comment: sanitizedComment,
              previousStatus,
              newStatus,
              returnToLevel,
              targetRole: 'REVIEWER',
              performedBy: {
                userId,
                name: userName,
                role: performedByRole
              },
              recipientType: 'ROLE'
            }
          });
        } else {
          // Return to OFFICER
          proposal.workflowLevel = 'OFFICER';
          returnToLevel = 'OFFICER';
          notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) to Budget Officer for revisions. Reason: ${sanitizedComment}`;
          targetRole = 'BUDGET_OFFICER';
          assignmentStep = 'OFFICER_REVIEW';
          assignmentRole = 'BUDGET_OFFICER';
          assignmentPendingRoles = ['BUDGET_OFFICER'];
          notificationPayloads.push({
            recipientRole: 'BUDGET_OFFICER',
            title: 'Proposal Returned by Manager',
            message: notificationMessage,
            ...baseNotificationFields,
            metadata: {
              proposalId: String(proposal._id),
              proposalTitle: proposal.title,
              fiscalYear: proposal.fiscalYear,
              budgetType: proposal.budgetType,
              region: proposal.region,
              department: proposal.department,
              division: proposal.division,
              action: 'RETURN',
              comment: sanitizedComment,
              previousStatus,
              newStatus,
              returnToLevel,
              targetRole: 'BUDGET_OFFICER',
              performedBy: {
                userId,
                name: userName,
                role: performedByRole
              },
              recipientType: 'ROLE'
            }
          });
        }
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot return proposal with status "${proposal.status}". Expected status: Forwarded to Overall Budget Approver` 
        });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to return proposals' });
    }

    proposal.status = newStatus;
    proposal[returnField] = {
      userId,
      userName,
      date: new Date(),
      comment: sanitizedComment
    };

    if (!notificationMessage) {
      notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName}. Reason: ${sanitizedComment}`;
    }

    updateAssignment(proposal, {
      step: assignmentStep || 'RETURNED',
      assigneeRole: assignmentRole,
      pendingRoles: assignmentPendingRoles
    });

    recordWorkflowEvent(proposal, {
      action: 'RETURN',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole,
      metadata: {
        returnToLevel
      }
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to appropriate recipient
    // Always notify proposal creator with context
    notificationPayloads.push({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned',
      message: notificationMessage,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'RETURN',
        comment: sanitizedComment,
        previousStatus,
        newStatus,
        returnToLevel,
        targetRole,
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'CREATOR'
      }
    });

    await Promise.all(notificationPayloads.map(payload => sendNotification(payload)));

    res.json({
      success: true,
      message: 'Proposal returned successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error returning proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

// Verify proposal (Budget Officer only) - marks as verified without changing status
exports.verifyProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Budget Officers can verify proposals' });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'verify this proposal');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    if (!['Division Submitted', 'Forwarded to Officer'].includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only proposals with status "Division Submitted" or "Forwarded to Officer" can be verified' 
      });
    }

    const previousStatus = proposal.status;

    // Mark as verified but keep the same status
    proposal.verifiedByOfficer = {
      userId,
      userName,
      date: new Date(),
      comment: sanitizedComment
    };

    updateAssignment(proposal, {
      step: 'OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    recordWorkflowEvent(proposal, {
      action: 'VERIFY',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus: previousStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    // Send notification to submitter
  const submitterMessage = `Your proposal "${proposal.title}" has been verified by ${userName} with comment: ${sanitizedComment}`;
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Verified',
      message: submitterMessage,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal verified successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        verifiedByOfficer: proposal.verifiedByOfficer
      }
    });

  } catch (error) {
    console.error('Error verifying proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to verify proposal', error: error.message });
  }
};

// Bulk approve proposals (Budget Officer only)
exports.bulkApproveProposals = async (req, res) => {
  try {
    const { proposalIds, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Budget Officers can perform bulk approvals' });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'approve the selected proposals');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const proposals = await Proposal.find({ _id: { $in: proposalIds } });
    const updatedProposals = [];

    for (const proposal of proposals) {
      const previousStatus = proposal.status;
      proposal.status = 'Forwarded to Manager';
      proposal.workflowLevel = 'MANAGER';
      proposal.submittedByOfficer = {
        userId,
        userName,
        date: new Date(),
        comment: sanitizedComment
      };

      updateAssignment(proposal, {
        step: 'MANAGER_REVIEW',
        assigneeRole: 'BUDGET_MANAGER',
        pendingRoles: ['BUDGET_MANAGER']
      });

      recordWorkflowEvent(proposal, {
        action: 'OFFICER_SUBMIT_TO_MANAGER',
        comment: sanitizedComment,
        userId,
        userName,
        previousStatus,
        newStatus: 'Forwarded to Manager',
        targetRole: 'BUDGET_MANAGER',
        metadata: {
          bulk: true
        }
      });

      await proposal.save();
      updatedProposals.push({
        id: proposal._id,
        title: proposal.title,
        status: proposal.status
      });

      // 🔄 UPDATE RELATED ENTITY RECORDS FOR BULK APPROVE
      console.log(`🔄 Updating entity records for proposal: ${proposal.title}`);
      
      const entityFilter = {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division || proposal.department,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        processBy: proposal.processBy
      };
      
      console.log(`🔍 Bulk approve entity filter:`, JSON.stringify(entityFilter, null, 2));
      
      const entityUpdate = {
        $set: {
          status: 'Region Approved',    // BUDGET_OFFICER submits to BUDGET_MANAGER
          workflowLevel: 'MANAGER',      // Pending MANAGER approval
          lastActionBy: userName,
          lastActionDate: new Date()
        }
      };

      try {
        const results = await Promise.all([
          PersonnelServices.updateMany(entityFilter, entityUpdate),
          CapitalOutlay.updateMany(entityFilter, entityUpdate),
          mooeProposals.updateMany(entityFilter, entityUpdate),
          Income.updateMany(entityFilter, entityUpdate)
        ]);
        
        const [psResult, coResult, mooeResult, incomeResult] = results;
        console.log(`📊 Bulk update results for ${proposal.title}:`);
        console.log(`   PersonnelServices: ${psResult.matchedCount} matched, ${psResult.modifiedCount} modified`);
        console.log(`   CapitalOutlay: ${coResult.matchedCount} matched, ${coResult.modifiedCount} modified`);
        console.log(`   MOOE: ${mooeResult.matchedCount} matched, ${mooeResult.modifiedCount} modified`);
        console.log(`   Income: ${incomeResult.matchedCount} matched, ${incomeResult.modifiedCount} modified`);
      } catch (entityUpdateError) {
        console.error(`⚠️ Error updating entity records for ${proposal.title}:`, entityUpdateError);
      }

      // Send notification to submitter
  const submitterMessage = `Your proposal "${proposal.title}" has been approved by ${userName} with comment: ${sanitizedComment}`;
      await sendNotification({
        recipientUserId: proposal.createdByUserId,
        title: 'Proposal Approved',
        message: submitterMessage,
        entity: 'proposal',
        recordIds: [proposal._id],
        org: {
          region: proposal.region,
          department: proposal.department,
          division: proposal.division
        },
        createdBy: { userId, name: userName }
      });
    }

    res.json({
      success: true,
      message: `${updatedProposals.length} proposals approved successfully`,
      proposals: updatedProposals
    });

  } catch (error) {
    console.error('Error in bulk approval:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk approve proposals', error: error.message });
  }
};

// Consolidate approved proposals into department-level proposal (Budget Officer)
exports.consolidateProposals = async (req, res) => {
  try {
    const { proposalIds, consolidatedTitle, fiscalYear, budgetType } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Budget Officers can consolidate proposals' });
    }

    const proposals = await Proposal.find({ _id: { $in: proposalIds } });

    // Validate all proposals are approved
    const unapproved = proposals.filter(p => p.status !== 'Officer Approved' && p.status !== 'Office Approved');
    if (unapproved.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All proposals must be approved before consolidation',
        unapprovedProposals: unapproved.map(p => ({ id: p._id, title: p.title, status: p.status }))
      });
    }

    // Get common department and region from proposals
    const department = proposals[0].department;
    const region = proposals[0].region;

    // Get Budget Officer's office/department assignment for consolidatedOrigin
    const userAssignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
    const officeName = userAssignment.officeName || userAssignment.departmentName || department;

    // Create consolidated proposal
    const consolidatedProposal = new Proposal({
      title: consolidatedTitle,
      description: `Consolidated proposal from ${proposals.length} approved proposals`,
      fiscalYear,
      budgetType,
      region,
      department,
      processBy: userId,
      status: 'Forwarded to Manager',
      workflowLevel: 'MANAGER',
      isConsolidated: true,
      consolidatedOrigin: officeName,  // Set origin to OFFICE name
      consolidatedProposals: proposals.map(p => ({
        proposalId: p._id,
        title: p.title,
        department: p.department,
        division: p.division
      })),
      consolidatedByOfficer: {
        userId,
        userName,
        date: new Date()
      },
      createdByUserId: userId,
      submittedDate: new Date(),
      // Track explicit submission metadata for manager visibility/audit
      submittedToManagerAt: new Date(),
      submittedToManagerBy: {
        userId,
        userName
      }
    });

    // Add consolidation to workflow history
    consolidatedProposal.workflowHistory.push({
      action: 'CONSOLIDATE',
      comment: `Consolidated ${proposals.length} proposals`,
      userId,
      userName,
      timestamp: new Date(),
      previousStatus: 'Draft',
      newStatus: 'Forwarded to Manager'
    });

    await consolidatedProposal.save();

    // Update original proposals to mark as consolidated
    // Idempotency: only set submittedToManagerAt/submittedToManagerBy if not already present
    const now = new Date();
    const originals = await Proposal.find({ _id: { $in: proposalIds } });
    for (const orig of originals) {
      const updates = {};
      const push = {
        action: 'CONSOLIDATE',
        comment: `Included in consolidated proposal: ${consolidatedTitle}`,
        userId,
        userName,
        timestamp: now,
        previousStatus: orig.status || 'Officer Approved',
        newStatus: 'Forwarded to Manager'
      };

      // Always mark as consolidated
      updates.isConsolidated = true;

      // Only set submittedToManager fields if missing
      if (!orig.submittedToManagerAt) updates.submittedToManagerAt = now;
      if (!orig.submittedToManagerBy) updates.submittedToManagerBy = { userId, userName };

      // If status is not already Forwarded to Manager, set it (also check legacy 'Office Submitted')
      if (orig.status !== 'Forwarded to Manager' && orig.status !== 'Office Submitted') updates.status = 'Forwarded to Manager';

      await Proposal.updateOne({ _id: orig._id }, { $set: updates, $push: { workflowHistory: push } });
    }

    // Also update entity-level collections (PersonnelServices, MooeProposal, CapitalOutlay, Income)
    try {
      const PersonnelServices = require(path.join(__dirname, '..', 'models', 'PersonnelServices'));
      const MooeProposal = require(path.join(__dirname, '..', 'models', 'mooeProposals'));
      const CapitalOutlay = require(path.join(__dirname, '..', 'models', 'CapitalOutlay'));
      const Income = require(path.join(__dirname, '..', 'models', 'Income'));

      // We assume the proposals array contains original proposal docs that have _id references
      // and that these entity collections have a field linking back to a proposal id via `proposalId` or similar.
      // To be safe, we'll update by matching on department/division/fiscalYear/budgetType and status = 'Officer Approved'.
      const dept = department;
      const div = proposals[0].division;
      const fy = fiscalYear;
      const bt = budgetType;

      const entityQuery = { department: dept, division: div, fiscalYear: fy, budgetType: bt, status: 'Officer Approved' };

      await Promise.all([
        PersonnelServices.updateMany(entityQuery, { $set: { status: 'Forwarded to Manager', submittedToManagerAt: new Date(), submittedToManagerBy: { userId, userName } } }),
        MooeProposal.updateMany(entityQuery, { $set: { status: 'Forwarded to Manager', submittedToManagerAt: new Date(), submittedToManagerBy: { userId, userName } } }),
        CapitalOutlay.updateMany(entityQuery, { $set: { status: 'Forwarded to Manager', submittedToManagerAt: new Date(), submittedToManagerBy: { userId, userName } } }),
        Income.updateMany(entityQuery, { $set: { status: 'Forwarded to Manager', submittedToManagerAt: new Date(), submittedToManagerBy: { userId, userName } } })
      ]);
    } catch (entErr) {
      console.error('Warning: failed to update entity-level collections during consolidation:', entErr && entErr.message ? entErr.message : entErr);
    }

    // Send notification to Budget Manager
    await sendNotification({
      recipientRole: 'BUDGET_MANAGER',
      title: 'Consolidated Proposal Submitted',
      message: `Consolidated proposal "${consolidatedTitle}" from ${department} submitted by ${userName}`,
      entity: 'proposal',
      recordIds: [consolidatedProposal._id],
      org: { region, department },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposals consolidated successfully',
      consolidatedProposal: {
        id: consolidatedProposal._id,
        title: consolidatedProposal.title,
        status: consolidatedProposal.status,
        workflowLevel: consolidatedProposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error consolidating proposals:', error);
    res.status(500).json({ success: false, message: 'Failed to consolidate proposals', error: error.message });
  }
};

// Get proposal workflow history
exports.getProposalHistory = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await Proposal.findById(proposalId).select('workflowHistory title');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    res.json({
      success: true,
      proposal: {
        id: proposal._id,
        title: proposal.title
      },
      history: proposal.workflowHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    });

  } catch (error) {
    console.error('Error getting proposal history:', error);
    res.status(500).json({ success: false, message: 'Failed to get proposal history', error: error.message });
  }
};

/**
 * REVIEWER WORKFLOW FUNCTIONS
 * New flexible workflow implementation
 */

// REVIEWER approves proposal from PREPARER/APPROVER
exports.coordinatorApproveProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Reviewers can approve proposals'
      });
    }    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status (can approve from Division Submitted or Under Review by Coordinator)
  const validStatuses = ['Division Submitted', 'Under Review by Coordinator', 'Forwarded to Reviewer', 'Under Review by Reviewer'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Reviewer Approved';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'REVIEWER';
    proposal.approvedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'REVIEWER_REVIEW',
      assigneeRole: 'REVIEWER',
      pendingRoles: ['REVIEWER']
    });

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_APPROVE',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'REVIEWER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to creator
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved by Reviewer',
      message: `Your proposal "${proposal.title}" has been approved by ${userName} (Reviewer). Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal approved by reviewer successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in coordinator approve:', error);
    res.status(500).json({ success: false, message: 'Failed to approve proposal', error: error.message });
  }
};

/**
 * BUDGET_COORDINATOR: Approve AND forward to BUDGET_OFFICER in one action
 * Combines coordinatorApproveProposal + coordinatorSubmitToOfficer
 */
exports.coordinatorApproveAndForwardToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Reviewers can approve and forward proposals'
      });
    }    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Division Submitted', 'Under Review by Coordinator'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

  const previousStatus = proposal.status;
  const newStatus = 'Forwarded to Approver';

    // Check if there are edits to apply
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Found edits to apply before forwarding to officer...', {
        editId: budgetOfficerEdit._id,
        editedBy: budgetOfficerEdit.editedBy
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Edits successfully applied to original documents:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying edits to original documents:', applyError);
        // Continue with workflow even if edit application fails
        // Edits are still stored in budgetofficeredits for manual recovery
      }

      // CRITICAL FIX: Mark the BudgetOfficerEdit as "Approved" so it won't block future submissions
      // This allows the coordinator to forward to officer and officer to then submit to manager
      budgetOfficerEdit.status = 'Approved';
      budgetOfficerEdit.approvedAt = new Date();
      budgetOfficerEdit.approvedBy = {
        userId,
        userName
      };
      await budgetOfficerEdit.save();
      console.log('✅ Marked BudgetOfficerEdit as Approved:', {
        editId: budgetOfficerEdit._id,
        status: budgetOfficerEdit.status
      });
    }

  // Update proposal - forward to APPROVER
    proposal.status = newStatus;
    proposal.workflowLevel = 'BUDGET APPROVER';
    proposal.submittedByRole = 'REVIEWER';
    proposal.approvedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'APPROVER_REVIEW',
      assigneeRole: 'BUDGET APPROVER',
      pendingRoles: ['BUDGET APPROVER']
    });

    // Record TWO events: approval + forward
    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_APPROVE_AND_FORWARD',
      comment: comment,
      userId,
      userName,
      previousStatus,
      newStatus: 'Reviewer Approved',
      targetRole: 'REVIEWER'
    });

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_FORWARD_TO_APPROVER',
      comment: 'Approved and forwarded to Approver',
      userId,
      userName,
      previousStatus: 'Reviewer Approved',
      newStatus,
      targetRole: 'BUDGET APPROVER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to creator
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved and Forwarded',
      message: `Your proposal "${proposal.title}" has been approved by ${userName} (Reviewer) and forwarded to Approver. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Send notification to BUDGET APPROVER
    await sendNotification({
      recipientRole: 'BUDGET APPROVER',
      title: 'New Proposal for Review',
      message: `Proposal "${proposal.title}" approved and forwarded by ${userName} (Reviewer) from ${proposal.division || proposal.department} for review. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal approved and forwarded to Budget Approver successfully',
      proposal: updatedProposal, // Return full proposal for real-time UI update
      shortProposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in coordinator approve and forward:', error);
    res.status(500).json({ success: false, message: 'Failed to approve and forward proposal', error: error.message });
  }
};

// BUDGET_COORDINATOR returns proposal to BUDGET_PLANNING_ANALYST
exports.coordinatorReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Reviewers can return proposals'
      });
    }    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    if (proposal.status !== 'Division Submitted') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return proposal with status "${proposal.status}". Expected status: Division Submitted` 
      });
    }

  const previousStatus = proposal.status;
  const newStatus = 'Returned';
  const performedByRole = (userRoles.find(role => String(role).toUpperCase().startsWith('BUDGET_')) || userRoles[0] || '').toUpperCase();

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'PREPARER';
    proposal.returnedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'PREPARER_DRAFT',
      assigneeRole: 'PREPARER',
      pendingRoles: ['PREPARER']
    });

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'PREPARER'
    });

    await proposal.save();

    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to creator
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned by Reviewer',
      message: `Your proposal "${proposal.title}" has been returned by ${userName} (Reviewer) for revisions. Reason: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'RETURN',
        comment,
        previousStatus,
        newStatus,
  returnToLevel: 'ANALYST',
  targetRole: 'BUDGET_PLANNING_ANALYST',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'CREATOR'
      }
    });

    res.json({
      success: true,
      message: 'Proposal returned to analyst successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in coordinator return:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

// === APPROVER WORKFLOW HANDLERS ===

// APPROVER saves edits without forwarding
exports.approverSaveEdits = async (req, res) => {
  try {
    const { proposalId, comment, updates, tableData } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    console.log('🔍 approverSaveEdits - User object:', {
      userId,
      userName,
      userRoles,
      fullUser: req.user
    });

    // Verify user is APPROVER - check both primary roles and workflow roles
    const primaryRoles = req.user.Roles || [];
    const workflowRoles = req.user.workflowRoles || [];
    const allRoles = [...primaryRoles, ...workflowRoles];
    
    const hasApproverRole = primaryRoles.includes('BUDGET APPROVER') || 
                           workflowRoles.includes('officeapprover') || 
                           workflowRoles.includes('divisionapprover') ||
                           workflowRoles.includes('approver');
    
    console.log('🔍 approverSaveEdits - Role check:', {
      primaryRoles,
      workflowRoles,
      allRoles,
      hasApproverRole,
      checkingConditions: {
        primaryAPPROVER: primaryRoles.includes('BUDGET APPROVER'),
        workflowOfficeApprover: workflowRoles.includes('officeapprover'),
        workflowDivisionApprover: workflowRoles.includes('divisionapprover'),
        workflowApprover: workflowRoles.includes('approver')
      }
    });
    
    if (!hasApproverRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Approvers can save edits'
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status for approver editing
    const validStatuses = ['Forwarded to Approver', 'Approver Approved'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot save edits for proposal with status "${proposal.status}". Expected statuses: ${validStatuses.join(', ')}`
      });
    }

    // Apply updates to proposal if provided
    if (updates && typeof updates === 'object') {
      const allowedFields = [
        'title', 'description', 'categoryBreakdown', 'proposedBudget',
        'totalExpenses', 'totalIncome', 'projectedCorporateIncome',
        'projectedSubsidy', 'cobExpenditures'
      ];

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          proposal[field] = value;
        }
      }

      // Increment version for edits
      proposal.version = (proposal.version || 1) + 1;
    }

    const previousStatus = proposal.status;
    const performedByRole = 'BUDGET APPROVER';

    // Record workflow event for save edits
    recordWorkflowEvent(proposal, {
      action: 'APPROVER_SAVE_EDITS',
      comment: comment || 'Changes saved without forwarding',
      userId,
      userName,
      previousStatus,
      newStatus: previousStatus, // Status remains the same
      targetRole: 'BUDGET APPROVER'
    });

    await proposal.save();

    // Save table data to BudgetOfficerEdit record if provided
    if (tableData && typeof tableData === 'object') {
      try {
        // Check if there's an existing BudgetOfficerEdit record for this proposal
        let budgetOfficerEdit = await BudgetOfficerEdit.findOne({ proposalId: proposalId });
        
        if (budgetOfficerEdit) {
          // Update existing record
          budgetOfficerEdit.editedIncome = tableData.editedIncome || [];
          budgetOfficerEdit.editedPersonnelServices = tableData.editedPersonnelServices || [];
          budgetOfficerEdit.editedMOOE = tableData.editedMOOE || [];
          budgetOfficerEdit.editedCapitalOutlay = tableData.editedCapitalOutlay || [];
          budgetOfficerEdit.comments = tableData.comments;
          budgetOfficerEdit.editedBy = {
            userId: userId,
            userName: userName,
            email: req.user.email,
            role: 'APPROVER'
          };
          budgetOfficerEdit.updatedAt = new Date();
          
          await budgetOfficerEdit.save();
          console.log('✅ Updated BudgetOfficerEdit record with approver table data');
        } else {
          // Create new BudgetOfficerEdit record
          const newEdit = new BudgetOfficerEdit({
            proposalId: proposalId,
            fiscalYear: proposal.fiscalYear,
            budgetType: proposal.budgetType,
            region: proposal.region,
            department: proposal.department,
            division: proposal.division,
            processBy: proposal.processBy,
            cobExpenditures: proposal.cobExpenditures,
            status: 'Draft',
            editedIncome: tableData.editedIncome || [],
            editedPersonnelServices: tableData.editedPersonnelServices || [],
            editedMOOE: tableData.editedMOOE || [],
            editedCapitalOutlay: tableData.editedCapitalOutlay || [],
            comments: tableData.comments,
            editedBy: {
              userId: userId,
              userName: userName,
              email: req.user.email,
              role: 'APPROVER'
            }
          });
          
          await newEdit.save();
          console.log('✅ Created new BudgetOfficerEdit record with approver table data');
        }
      } catch (editError) {
        console.error('Error saving BudgetOfficerEdit record:', editError);
        // Don't fail the whole operation if edit save fails
      }
    }

    res.json({
      success: true,
      message: 'Changes saved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in approver save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

// APPROVER approves and forwards to BUDGET_PLANNING_ANALYST
exports.approverApproveForwardAnalyst = async (req, res) => {
  try {
    const { proposalId, comment, tableData } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is APPROVER - check both primary roles and workflow roles
    const primaryRoles = req.user.Roles || [];
    const workflowRoles = req.user.workflowRoles || [];
    const hasApproverRole = primaryRoles.includes('APPROVER') || 
                           workflowRoles.includes('officeapprover') || 
                           workflowRoles.includes('divisionapprover') ||
                           workflowRoles.includes('approver');
    
    if (!hasApproverRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Approvers can approve and forward proposals'
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Approver', 'Approver Approved'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve proposal with status "${proposal.status}". Expected statuses: ${validStatuses.join(', ')}`
      });
    }

  const previousStatus = proposal.status;
  const newStatus = 'Forwarded to Budget Planning Analyst';
    const performedByRole = 'APPROVER';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'BUDGET_PLANNING_ANALYST';
    proposal.approverApprovedAt = new Date();
    proposal.approverApprovedBy = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'BUDGET_PLANNING_ANALYST_REVIEW',
      assigneeRole: 'BUDGET_PLANNING_ANALYST',
      pendingRoles: ['BUDGET_PLANNING_ANALYST']
    });

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_APPROVE_FORWARD_ANALYST',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_PLANNING_ANALYST'
    });

    await proposal.save();

    // If approver forwarded without hitting "Save Edits" first but we have tableData,
    // persist it into BudgetOfficerEdit as a Draft so the Analyst can see the latest numbers.
    try {
      if (tableData && typeof tableData === 'object') {
        let budgetOfficerEdit = await BudgetOfficerEdit.findOne({ proposalId: proposalId });

        if (budgetOfficerEdit) {
          budgetOfficerEdit.editedIncome = tableData.editedIncome || [];
          budgetOfficerEdit.editedPersonnelServices = tableData.editedPersonnelServices || [];
          budgetOfficerEdit.editedMOOE = tableData.editedMOOE || [];
          budgetOfficerEdit.editedCapitalOutlay = tableData.editedCapitalOutlay || [];
          // Prefer explicit tableData.comments, otherwise reuse workflow comment
          budgetOfficerEdit.comments = tableData.comments ?? comment;
          budgetOfficerEdit.editedBy = {
            userId: userId,
            userName: userName,
            email: req.user.email,
            role: 'APPROVER'
          };
          // Keep as Draft at this stage; submission happens from Analyst or Officer later
          if (!budgetOfficerEdit.status) budgetOfficerEdit.status = 'Draft';
          budgetOfficerEdit.updatedAt = new Date();

          await budgetOfficerEdit.save();
          console.log('✅ Updated BudgetOfficerEdit (via approve-forward) with approver table data');
        } else {
          const newEdit = new BudgetOfficerEdit({
            proposalId: proposalId,
            fiscalYear: proposal.fiscalYear,
            budgetType: proposal.budgetType,
            region: proposal.region,
            department: proposal.department,
            division: proposal.division,
            processBy: proposal.processBy,
            cobExpenditures: proposal.cobExpenditures,
            status: 'Draft',
            editedIncome: tableData.editedIncome || [],
            editedPersonnelServices: tableData.editedPersonnelServices || [],
            editedMOOE: tableData.editedMOOE || [],
            editedCapitalOutlay: tableData.editedCapitalOutlay || [],
            comments: tableData.comments ?? comment,
            editedBy: {
              userId: userId,
              userName: userName,
              email: req.user.email,
              role: 'APPROVER'
            }
          });
          await newEdit.save();
          console.log('✅ Created BudgetOfficerEdit (via approve-forward) with approver table data');
        }
      }
    } catch (editPersistError) {
      console.error('⚠️ Failed to persist tableData during approve-forward to analyst:', editPersistError);
      // Non-fatal: workflow forward proceeds even if edit persistence fails
    }

    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Recalculate proposal totals to ensure overview reflects current module data
    try {
      await recalculateAndSaveProposalTotals({ proposalId: proposal._id });
    } catch (recalcErr) {
      console.warn('⚠️ Totals recalculation failed after approve-forward to analyst:', recalcErr?.message || recalcErr);
    }

    // Send notification to BUDGET_PLANNING_ANALYST users
    await sendNotification({
      recipientRole: 'BUDGET_PLANNING_ANALYST',
      title: 'Proposal Approved by Approver - Ready for Budget Planning Analyst Review',
      message: `Proposal "${proposal.title}" has been approved by ${userName} (Approver) and is ready for your review. Comment: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'APPROVE_FORWARD_ANALYST',
        comment,
        previousStatus,
        newStatus,
        targetRole: 'BUDGET_PLANNING_ANALYST',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'ROLE'
      }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Planning Analyst successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in approver approve forward analyst:', error);
    res.status(500).json({ success: false, message: 'Failed to approve and forward proposal', error: error.message });
  }
};

// APPROVER submits directly to BUDGET_OFFICER (bypasses BUDGET_PLANNING_ANALYST)
exports.approverSubmitToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is APPROVER - check both primary roles and workflow roles
    const primaryRoles = req.user.Roles || [];
    const workflowRoles = req.user.workflowRoles || [];
    const hasApproverRole = primaryRoles.includes('APPROVER') || 
                           workflowRoles.includes('officeapprover') || 
                           workflowRoles.includes('divisionapprover') ||
                           workflowRoles.includes('approver');
    
    if (!hasApproverRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Approvers can submit to officer'
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for submission' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Approver', 'Approver Approved'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit proposal with status "${proposal.status}". Expected statuses: ${validStatuses.join(', ')}`
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Officer';
    const performedByRole = 'APPROVER';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'BUDGET_OFFICER';
    proposal.forwardedToOfficerAt = new Date();
    proposal.forwardedToOfficerBy = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'BUDGET_OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_SUBMIT_TO_OFFICER',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_OFFICER users
    await sendNotification({
      recipientRole: 'BUDGET_OFFICER',
      title: 'Proposal Submitted by Approver - Ready for Budget Officer Review',
      message: `Proposal "${proposal.title}" has been submitted by ${userName} (Approver) and is ready for your review. Comment: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'SUBMIT_TO_OFFICER',
        comment,
        previousStatus,
        newStatus,
        targetRole: 'BUDGET_OFFICER',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'ROLE'
      }
    });

    res.json({
      success: true,
      message: 'Proposal submitted directly to Budget Officer successfully (bypassed Analyst review)',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in approver submit to officer:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal to officer', error: error.message });
  }
};

// APPROVER returns proposal to REVIEWER
exports.approverReturn = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is APPROVER - check both primary roles and workflow roles
    const primaryRoles = req.user.Roles || [];
    const workflowRoles = req.user.workflowRoles || [];
    const hasApproverRole = primaryRoles.includes('APPROVER') || 
                           workflowRoles.includes('officeapprover') || 
                           workflowRoles.includes('divisionapprover') ||
                           workflowRoles.includes('approver');
    
    if (!hasApproverRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Approvers can return proposals'
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Approver', 'Approver Approved'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot return proposal with status "${proposal.status}". Expected statuses: ${validStatuses.join(', ')}`
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Division Submitted';
    const performedByRole = 'APPROVER';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'REVIEWER';
    proposal.returnedByApprover = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'REVIEWER_REVIEW',
      assigneeRole: 'REVIEWER',
      pendingRoles: ['REVIEWER']
    });

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'REVIEWER'
    });

    await proposal.save();

    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to REVIEWER users
    await sendNotification({
      recipientRole: 'REVIEWER',
      title: 'Proposal Returned by Approver',
      message: `Proposal "${proposal.title}" has been returned by ${userName} (Approver) for revisions. Reason: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'RETURN',
        comment,
        previousStatus,
        newStatus,
        returnToLevel: 'REVIEWER',
        targetRole: 'REVIEWER',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'ROLE'
      }
    });

    res.json({
      success: true,
      message: 'Proposal returned to Reviewer successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in approver return:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

// BUDGET_COORDINATOR submits to BUDGET_OFFICER (optional path)
exports.coordinatorSubmitToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Reviewers can submit to Budget Officer'
      });
    }    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status (must be coordinator approved)
    const validStatuses = ['Coordinator Approved', 'Office Approved']; // Support legacy status
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot submit to officer. Proposal must be approved by coordinator first. Current status: "${proposal.status}"` 
      });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'forward the proposal to the Budget Officer');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Officer';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'OFFICER';
    proposal.submittedByRole = 'BUDGET_COORDINATOR';
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_SUBMIT_TO_OFFICER',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_OFFICER
    await sendNotification({
      recipientRole: 'BUDGET_OFFICER',
      title: 'New Proposal for Verification',
  message: `Proposal "${proposal.title}" submitted by ${userName} (Budget Coordinator) from ${proposal.division || proposal.department} for verification. Comment: ${sanitizedComment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Officer successfully',
      proposal: updatedProposal // Return full proposal for real-time UI update
    });

  } catch (error) {
    console.error('Error in coordinator submit to officer:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

// BUDGET_COORDINATOR submits directly to BUDGET_MANAGER (bypass officer)
exports.coordinatorSubmitToManager = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        success: false,
        message: 'Only Reviewers can submit to Budget Manager'
      });
    }    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status (must be coordinator approved or forwarded to officer)
    const validStatuses = ['Coordinator Approved', 'Forwarded to Officer', 'Division Submitted', 'Office Approved']; // Support legacy status
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot submit to manager. Proposal must be approved by coordinator first. Current status: "${proposal.status}"` 
      });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'forward the proposal to the Budget Manager');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Manager';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'MANAGER';
    proposal.submittedByRole = 'REVIEWER';
    proposal.bypassedOfficerReview = true; // Flag that this skipped officer review

    updateAssignment(proposal, {
      step: 'MANAGER_REVIEW',
      assigneeRole: 'BUDGET_MANAGER',
      pendingRoles: ['BUDGET_MANAGER']
    });

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_SUBMIT_TO_MANAGER',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_MANAGER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_MANAGER
    await sendNotification({
      recipientRole: 'BUDGET_MANAGER',
      title: 'New Proposal for Final Approval',
  message: `Proposal "${proposal.title}" submitted by ${userName} (Budget Coordinator) from ${proposal.division || proposal.department} for final approval. Comment: ${sanitizedComment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Manager successfully',
      proposal: updatedProposal // Return full proposal for real-time UI update
    });

  } catch (error) {
    console.error('Error in coordinator submit to manager:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

/**
 * SAVE/EDIT FUNCTIONS FOR APPROVERS
 * Allows Coordinator, Officer, and Manager to save edits without forwarding
 */

// BUDGET_COORDINATOR saves edits to proposal
exports.coordinatorSaveEdits = async (req, res) => {
  try {
    const { proposalId, changesDescription } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is REVIEWER (old BUDGET_COORDINATOR)
    const hasReviewRole = userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR');
    if (!hasReviewRole) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can save edits' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Division Submitted', 'Under Review by Coordinator', 'Coordinator Approved'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot edit proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Under Review by Reviewer';

    // Update proposal status if not already under review
    if (proposal.status !== newStatus) {
      proposal.status = newStatus;
    }
    
    proposal.workflowLevel = 'REVIEWER';
    
    // Track the edit
    proposal.editedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      changesDescription: changesDescription || 'Coordinator made edits to the proposal'
    };

    // Add to edit history
    proposal.editHistory.push({
      version: proposal.version,
      editedBy: userId,
      editedByName: userName,
      editedByRole: 'BUDGET_COORDINATOR',
      editedAt: new Date(),
      previousStatus,
      newStatus,
      changesDescription: changesDescription || 'Coordinator made edits to the proposal'
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_SAVE_EDITS',
      comment: changesDescription || 'Coordinator saved edits',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_COORDINATOR'
    });

    await proposal.save();

    // Apply edits to original documents
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Applying coordinator edits to original documents...', {
        editId: budgetOfficerEdit._id,
        proposalId: proposal._id
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Coordinator edits successfully applied:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying coordinator edits:', applyError);
        // Continue - edits are stored in budgetofficeredits for recovery
      }
    }

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in coordinator save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

// BUDGET_OFFICER saves edits to proposal
exports.officerSaveEdits = async (req, res) => {
  try {
    const { proposalId, changesDescription } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_OFFICER
    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Officers can save edits' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Officer', 'Under Review by Officer', 'Officer Approved', 'Office']; // Include legacy
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot edit proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Under Review by Officer';

    // Update proposal status if not already under review
    if (proposal.status !== newStatus) {
      proposal.status = newStatus;
    }
    
    proposal.workflowLevel = 'OFFICER';
    
    // Track the edit
    proposal.editedByOfficer = {
      userId,
      userName,
      date: new Date(),
      changesDescription: changesDescription || 'Officer made edits to the proposal'
    };

    // Add to edit history
    proposal.editHistory.push({
      version: proposal.version,
      editedBy: userId,
      editedByName: userName,
      editedByRole: 'BUDGET_OFFICER',
      editedAt: new Date(),
      previousStatus,
      newStatus,
      changesDescription: changesDescription || 'Officer made edits to the proposal'
    });

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_SAVE_EDITS',
      comment: changesDescription || 'Officer saved edits',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    // Apply edits to original documents
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Applying officer edits to original documents...', {
        editId: budgetOfficerEdit._id,
        proposalId: proposal._id
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Officer edits successfully applied:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying officer edits:', applyError);
        // Continue - edits are stored in budgetofficeredits for recovery
      }
    }

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in officer save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

// BUDGET_MANAGER saves edits to proposal
exports.managerSaveEdits = async (req, res) => {
  try {
    const { proposalId, changesDescription } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_MANAGER or BUDGET_ADMIN
    if (!userRoles.includes('BUDGET_MANAGER') && !userRoles.includes('BUDGET_ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Managers can save edits' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Manager', 'Under Review by Manager', 'Office Submitted']; // Include legacy
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot edit proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Under Review by Manager';

    // Update proposal status if not already under review
    if (proposal.status !== newStatus) {
      proposal.status = newStatus;
    }
    
    proposal.workflowLevel = 'MANAGER';
    
    // Track the edit
    proposal.editedByManager = {
      userId,
      userName,
      date: new Date(),
      changesDescription: changesDescription || 'Manager made edits to the proposal'
    };

    // Add to edit history
    proposal.editHistory.push({
      version: proposal.version,
      editedBy: userId,
      editedByName: userName,
      editedByRole: 'BUDGET_MANAGER',
      editedAt: new Date(),
      previousStatus,
      newStatus,
      changesDescription: changesDescription || 'Manager made edits to the proposal'
    });

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_SAVE_EDITS',
      comment: changesDescription || 'Manager saved edits',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_MANAGER'
    });

    await proposal.save();

    // Apply edits to original documents
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Applying manager edits to original documents...', {
        editId: budgetOfficerEdit._id,
        proposalId: proposal._id
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Manager edits successfully applied:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying manager edits:', applyError);
        // Continue - edits are stored in budgetofficeredits for recovery
      }
    }

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in manager save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

/**
 * OFFICER WORKFLOW FUNCTIONS
 * New flexible workflow for Budget Officer
 */

// BUDGET_OFFICER approves proposal
exports.officerApproveProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_OFFICER
    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Officers can approve proposals' 
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Officer', 'Under Review by Officer', 'Office']; // Include legacy
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Officer Approved';

    // Apply edits to original documents before approving
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Applying officer edits before approval...', {
        editId: budgetOfficerEdit._id,
        proposalId: proposal._id
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Officer edits successfully applied before approval:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying officer edits:', applyError);
        // Continue - edits are stored in budgetofficeredits for recovery
      }

      // CRITICAL FIX: Mark the BudgetOfficerEdit as "Approved" so it won't block future submissions
      // This allows the officer to submit to manager after approval
      budgetOfficerEdit.status = 'Approved';
      budgetOfficerEdit.approvedAt = new Date();
      budgetOfficerEdit.approvedBy = {
        userId,
        userName
      };
      await budgetOfficerEdit.save();
      console.log('✅ Marked BudgetOfficerEdit as Approved:', {
        editId: budgetOfficerEdit._id,
        status: budgetOfficerEdit.status
      });
    }

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'OFFICER';
    proposal.approvedByOfficer = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_APPROVE',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_COORDINATOR (submitter)
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved by Officer',
      message: `Your proposal "${proposal.title}" has been approved by ${userName} (Budget Officer). Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal approved by officer successfully',
      proposal: updatedProposal // Return full proposal for real-time UI update
    });

  } catch (error) {
    console.error('Error in officer approve:', error);
    res.status(500).json({ success: false, message: 'Failed to approve proposal', error: error.message });
  }
};

// BUDGET_OFFICER returns proposal to BUDGET_PLANNING_ANALYST
exports.officerReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_OFFICER
    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Officers can return proposals' 
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
  const validStatuses = ['Forwarded to Officer', 'Forwarded to Budget Officer', 'Under Review by Officer', 'Officer Approved', 'Office'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

  const previousStatus = proposal.status;
  const newStatus = 'Returned';
  const performedByRole = (userRoles.find(role => String(role).toUpperCase().startsWith('BUDGET_')) || userRoles[0] || '').toUpperCase();

    // Update proposal
    proposal.status = newStatus;
  proposal.workflowLevel = 'BUDGET_PLANNING_ANALYST';
    proposal.returnedByOfficer = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
  step: 'BUDGET_PLANNING_ANALYST_REVIEW',
  assigneeRole: 'BUDGET_PLANNING_ANALYST',
  pendingRoles: ['BUDGET_PLANNING_ANALYST']
    });

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_PLANNING_ANALYST'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

  const coordinatorRecipientId = undefined; // direct to analyst role
    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };

    await sendNotification({
      recipientRole: 'BUDGET_PLANNING_ANALYST',
      title: 'Proposal Returned by Officer',
      message: `Proposal "${proposal.title}" has been returned by ${userName} (Budget Officer) for further analysis. Reason: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'RETURN',
        comment,
        previousStatus,
        newStatus,
        returnToLevel: 'ANALYST',
        targetRole: 'BUDGET_PLANNING_ANALYST',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'ROLE'
      }
    });

    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned by Officer',
  message: `Your proposal "${proposal.title}" has been returned by ${userName} (Budget Officer). It will be reviewed by the Budget Planning Analyst. Reason: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        proposalId: String(proposal._id),
        proposalTitle: proposal.title,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        action: 'RETURN',
        comment,
        previousStatus,
        newStatus,
  returnToLevel: 'ANALYST',
  targetRole: 'BUDGET_PLANNING_ANALYST',
        performedBy: {
          userId,
          name: userName,
          role: performedByRole
        },
        recipientType: 'CREATOR'
      }
    });

    res.json({
      success: true,
      message: 'Proposal returned to coordinator successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in officer return:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

// BUDGET_OFFICER submits to BUDGET_MANAGER
exports.officerSubmitToManager = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_OFFICER
    if (!userRoles.includes('BUDGET_OFFICER')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Officers can submit to Budget Manager' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status (must be officer approved)
    const validStatuses = ['Officer Approved', 'Under Review by Officer'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot submit to manager. Proposal must be approved by officer first. Current status: "${proposal.status}"` 
      });
    }

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'forward the proposal to the Budget Manager');
    } catch (commentError) {
      return res.status(400).json({ success: false, message: commentError.message });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Manager';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'MANAGER';
    proposal.submittedByRole = 'BUDGET_OFFICER';
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'MANAGER_REVIEW',
      assigneeRole: 'BUDGET_MANAGER',
      pendingRoles: ['BUDGET_MANAGER']
    });

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_SUBMIT_TO_MANAGER',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_MANAGER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_MANAGER
    await sendNotification({
      recipientRole: 'BUDGET_MANAGER',
      title: 'New Proposal for Final Approval',
      message: `Proposal "${proposal.title}" submitted by ${userName} (Budget Officer) from ${proposal.division || proposal.department} for final approval. Comment: ${sanitizedComment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Manager successfully',
      proposal: updatedProposal // Return full proposal for real-time UI update
    });

  } catch (error) {
    console.error('Error in officer submit to manager:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

/**
 * MANAGER WORKFLOW FUNCTIONS
 * New flexible workflow for Budget Manager
 */

// BUDGET_MANAGER approves proposal (final approval)
exports.managerApproveProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_MANAGER or BUDGET_ADMIN
    if (!userRoles.includes('BUDGET_MANAGER') && !userRoles.includes('BUDGET_ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Managers can approve proposals' 
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Manager', 'Under Review by Manager', 'Office Submitted']; // Include legacy
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Finalized';

    // Apply edits to original documents before finalizing
    const budgetOfficerEdit = await BudgetOfficerEdit.findOne({ 
      proposalId: proposal._id 
    }).sort({ updatedAt: -1 }); // Get latest edit

    if (budgetOfficerEdit) {
      console.log('📝 Applying manager edits before finalization...', {
        editId: budgetOfficerEdit._id,
        proposalId: proposal._id
      });
      
      try {
        const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
        console.log('✅ Manager edits successfully applied before finalization:', applyResults);
      } catch (applyError) {
        console.error('❌ Error applying manager edits:', applyError);
        // Continue - edits are stored in budgetofficeredits for recovery
      }

      // CRITICAL FIX: Mark the BudgetOfficerEdit as "Approved" when finalizing
      // This prevents future workflow issues if this proposal needs to be reopened/reprocessed
      budgetOfficerEdit.status = 'Approved';
      budgetOfficerEdit.approvedAt = new Date();
      budgetOfficerEdit.approvedBy = {
        userId,
        userName
      };
      await budgetOfficerEdit.save();
      console.log('✅ Marked BudgetOfficerEdit as Approved:', {
        editId: budgetOfficerEdit._id,
        status: budgetOfficerEdit.status
      });
    }

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'FINALIZED';
    proposal.approvedByManager = {
      userId,
      userName,
      date: new Date(),
      comment
    };
    proposal.approvedDate = new Date();

    updateAssignment(proposal, {
      step: 'FINALIZED',
      assigneeRole: 'BUDGET_MANAGER',
      pendingRoles: []
    });

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_APPROVE',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_MANAGER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to proposal creator
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Finalized',
      message: `Your proposal "${proposal.title}" has been finalized by ${userName} (Budget Manager). Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Reload proposal with fresh data for frontend
    const updatedProposal = await Proposal.findById(proposal._id).lean();

    res.json({
      success: true,
      message: 'Proposal finalized successfully',
      proposal: updatedProposal // Return full proposal for real-time UI update
    });

  } catch (error) {
    console.error('Error in manager approve:', error);
    res.status(500).json({ success: false, message: 'Failed to approve proposal', error: error.message });
  }
};

// BUDGET_MANAGER returns proposal
exports.managerReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment, returnTo } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_MANAGER or BUDGET_ADMIN
    if (!userRoles.includes('BUDGET_MANAGER') && !userRoles.includes('BUDGET_ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Managers can return proposals' 
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status
    const validStatuses = ['Forwarded to Manager', 'Under Review by Manager', 'Office Submitted'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    // Determine who to return to based on returnTo parameter or proposal history
    let targetRole = 'BUDGET_OFFICER';
    let targetWorkflowLevel = 'OFFICER';
    
    if (returnTo === 'REVIEWER' || proposal.bypassedOfficerReview) {
      targetRole = 'REVIEWER';
      targetWorkflowLevel = 'REVIEWER';
    } else if (returnTo === 'BUDGET_PLANNING_ANALYST') {
      targetRole = 'BUDGET_PLANNING_ANALYST';
      targetWorkflowLevel = 'BUDGET_PLANNING_ANALYST';
    }

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = targetWorkflowLevel;
    proposal.returnedByManager = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
  step: targetWorkflowLevel === 'BUDGET_PLANNING_ANALYST' ? 'BUDGET_PLANNING_ANALYST_REVIEW' : 
            targetWorkflowLevel === 'REVIEWER' ? 'REVIEWER_REVIEW' : 'OFFICER_REVIEW',
      assigneeRole: targetRole,
      pendingRoles: [targetRole]
    });

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

  const targetRecipientUserId = targetRole === 'BUDGET_PLANNING_ANALYST'
      ? proposal.createdByUserId
      : targetRole === 'BUDGET_COORDINATOR'
        ? proposal.approvedByCoordinator?.userId
        : targetRole === 'BUDGET_OFFICER'
          ? proposal.approvedByOfficer?.userId
          : null;

    const baseNotificationFields = {
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName },
      type: 'PROPOSAL_WORKFLOW',
      relatedEntityId: proposal._id,
      relatedEntityType: 'Proposal',
      relatedLink: `/AllProposals?proposalId=${proposal._id}`
    };
    const baseMetadata = {
      proposalId: String(proposal._id),
      proposalTitle: proposal.title,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      action: 'RETURN',
      comment,
      previousStatus,
      newStatus,
      returnToLevel: targetWorkflowLevel,
      targetRole,
      performedBy: {
        userId,
        name: userName,
        role: performedByRole
      }
    };

    await sendNotification({
      recipientUserId: targetRecipientUserId || undefined,
      recipientRole: targetRecipientUserId ? undefined : targetRole,
      title: 'Proposal Returned by Manager',
      message: `Proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) for revisions. Reason: ${comment}`,
      ...baseNotificationFields,
      metadata: {
        ...baseMetadata,
        recipientType: targetRecipientUserId ? 'USER' : 'ROLE'
      }
    });

  if (targetRole !== 'BUDGET_PLANNING_ANALYST') {
      await sendNotification({
        recipientUserId: proposal.createdByUserId,
        title: 'Proposal Returned by Manager',
        message: `Your proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) to the ${targetRole.replace('BUDGET_', '').toLowerCase()} for revisions. Reason: ${comment}`,
        ...baseNotificationFields,
        metadata: {
          ...baseMetadata,
          recipientType: 'CREATOR'
        }
      });
    }

    res.json({
      success: true,
      message: `Proposal returned to ${targetRole.replace('BUDGET_', '').toLowerCase()} successfully`,
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in manager return:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

// Helper function to send notifications
async function sendNotification({
  recipientUserId,
  recipientRole,
  title,
  message,
  entity,
  recordIds,
  org,
  createdBy,
  type,
  relatedEntityId,
  relatedEntityType,
  relatedLink,
  metadata
}) {
  try {
    const recipientIds = new Set();

    const addRecipient = (id) => {
      if (!id) return;
      const normalized = String(id).trim();
      if (normalized) {
        recipientIds.add(normalized);
      }
    };

    if (Array.isArray(recipientUserId)) {
      recipientUserId.forEach(addRecipient);
    } else if (recipientUserId) {
      addRecipient(recipientUserId);
    }

    if (recipientRole) {
      const baseQuery = { userRole: recipientRole, isActive: true };
      const queryVariants = [];

      let regionDoc = null;
      let departmentDoc = null;

      if (org?.region) {
        regionDoc = await Region.findOne({ Region: org.region }).lean();
      }

      if (org?.department) {
        departmentDoc = await Department.findOne({ Department: org.department }).lean();
      }

      const specificQuery = { ...baseQuery };
      if (org?.division) {
        specificQuery.divisionName = org.division;
      }
      if (departmentDoc?._id) {
        specificQuery.departmentId = departmentDoc._id;
      }
      if (regionDoc?._id) {
        specificQuery.regionId = regionDoc._id;
      }

      // Prioritize most specific combinations first then progressively relax filters
      queryVariants.push(specificQuery);

      if (specificQuery.divisionName) {
        const withoutDivision = { ...specificQuery };
        delete withoutDivision.divisionName;
        queryVariants.push(withoutDivision);
      }

      if (specificQuery.departmentId) {
        const deptOnly = { ...baseQuery };
        deptOnly.departmentId = specificQuery.departmentId;
        if (specificQuery.regionId) {
          deptOnly.regionId = specificQuery.regionId;
        }
        queryVariants.push(deptOnly);
      }

      if (specificQuery.regionId) {
        const regionOnly = { ...baseQuery, regionId: specificQuery.regionId };
        queryVariants.push(regionOnly);
      }

      queryVariants.push(baseQuery);

      const seenVariants = new Set();
      for (const variant of queryVariants) {
        const sanitized = Object.fromEntries(
          Object.entries(variant).filter(([, value]) => value !== undefined)
        );
        const fingerprint = JSON.stringify(sanitized);
        if (seenVariants.has(fingerprint)) {
          continue;
        }
        seenVariants.add(fingerprint);

        const matches = await HierarchicalUserAssignment.find(sanitized).lean();
        if (matches.length > 0) {
          matches.forEach(match => addRecipient(match.userId));
          // Stop after the first variant that yields recipients to avoid duplicate fan-out
          break;
        }
      }
    }

    if (recipientIds.size === 0) {
      console.warn('⚠️  Notification skipped - no recipients resolved', {
        recipientUserId,
        recipientRole,
        org
      });
      return;
    }

    const recordId = Array.isArray(recordIds) ? recordIds[0] : recordIds;
    const derivedRelatedEntityType = relatedEntityType || (entity ? entity.toUpperCase() : undefined);
    const derivedRelatedEntityId = relatedEntityId || (recordId ? String(recordId) : undefined);
    const derivedRelatedLink = relatedLink || (entity === 'proposal' && derivedRelatedEntityId
      ? `/AllProposals?proposalId=${derivedRelatedEntityId}`
      : relatedLink);
    const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {};

    const notifications = Array.from(recipientIds).map(recipientId => ({
      recipientUserId: recipientId,
      title,
      message,
      entity,
      recordIds,
      org,
      createdBy,
      type: type || (entity ? `${String(entity).toUpperCase()}_EVENT` : 'INFO'),
      relatedEntityId: derivedRelatedEntityId,
      relatedEntityType: derivedRelatedEntityType,
      relatedLink: derivedRelatedLink,
      metadata: normalizedMetadata
    }));

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

const __private = {
  validateAndNormalizeComment,
  updateAssignment,
  recordWorkflowEvent
};

// AUDIT LOGGING METHODS

/**
 * Get detailed field-level edit logs for a specific proposal
 * Returns all changes made to the proposal with old/new values, timestamps, and user information
 */
const getProposalEditLogs = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { 
      entityType, 
      startDate, 
      endDate, 
      limit = 100,
      page = 1 
    } = req.query;

    // Validate proposalId
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID format'
      });
    }

    // Check if user has access to this proposal
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Get user's hierarchical assignment for access control
    const userAssignment = req.userHierarchicalAssignment;
    if (!userAssignment) {
      return res.status(403).json({
        success: false,
        message: 'User assignment not found'
      });
    }

    // Check if user has access to view this proposal's audit logs
    const hasAccess = await budgetRoleAccessControl.checkProposalAccess(
      proposal, 
      req.user, 
      userAssignment, 
      'read'
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view audit logs for this proposal'
      });
    }

    // Build query options
    const options = {
      limit: parseInt(limit) || 100,
      page: parseInt(page) || 1
    };

    if (entityType) options.entityType = entityType;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // Get edit logs
    const logs = await ProposalEditLog.getProposalHistory(proposalId, options);

    // Format logs for display
    const formattedLogs = logs.map(log => ({
      id: log._id,
      timestamp: log.timestamp,
      user: {
        id: log.changedBy.userId,
        name: log.changedBy.userName,
        role: log.changedBy.userRole
      },
      action: log.changeType,
      entity: log.entityType,
      summary: log.summary || 'Field modifications',
      changes: log.changes.map(change => ({
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        fieldType: change.fieldType || 'unknown'
      })),
      metadata: log.metadata || {}
    }));

    res.json({
      success: true,
      data: {
        proposalId,
        logs: formattedLogs,
        total: formattedLogs.length,
        pagination: {
          page: options.page,
          limit: options.limit,
          hasMore: formattedLogs.length === options.limit
        }
      }
    });

  } catch (error) {
    console.error('Error fetching proposal edit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal edit logs',
      error: error.message
    });
  }
};

/**
 * Get user activity logs - all changes made by a specific user
 * Useful for compliance and audit trails
 */
const getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      startDate, 
      endDate, 
      limit = 100,
      page = 1,
      entityType
    } = req.query;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Check if requesting user has permission to view activity logs
    // Only admins or the user themselves should be able to view activity logs
    const requestingUserId = req.user._id.toString();
    const isAdmin = req.user.Roles?.includes('ADMIN') || req.user.Roles?.includes('SYSTEM_ADMIN');
    const isSelf = requestingUserId === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own activity logs'
      });
    }

    // Build query options
    const options = {
      limit: parseInt(limit) || 100,
      page: parseInt(page) || 1
    };

    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // Get user activity logs
    const logs = await ProposalEditLog.getUserActivity(userId, options);

    // Filter by entity type if specified
    let filteredLogs = logs;
    if (entityType) {
      filteredLogs = logs.filter(log => log.entityType === entityType);
    }

    // Format logs for display
    const formattedLogs = filteredLogs.map(log => ({
      id: log._id,
      timestamp: log.timestamp,
      proposalId: log.proposalId,
      action: log.changeType,
      entity: log.entityType,
      summary: log.summary || 'Field modifications',
      changes: log.changes.map(change => ({
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        fieldType: change.fieldType || 'unknown'
      })),
      metadata: log.metadata || {}
    }));

    res.json({
      success: true,
      data: {
        userId,
        logs: formattedLogs,
        total: formattedLogs.length,
        pagination: {
          page: options.page,
          limit: options.limit,
          hasMore: filteredLogs.length === options.limit
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity logs',
      error: error.message
    });
  }
};

module.exports = {
  ...exports,
  budgetRoleAccessControl,
  // validateAnalystSubmissionReadiness,  // REMOVED: Not used externally, causes circular dependency
  __private,
  // Audit logging methods
  getProposalEditLogs,
  getUserActivityLogs
};