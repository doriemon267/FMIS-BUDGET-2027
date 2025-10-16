const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const Income = require('../models/Income');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const { applyEditsToOriginalDocuments } = require('./budgetOfficerEditController');

/**
 * Budget Role Access Control Middleware
 * Implements visibility rules based on budget roles and proposal status
 */
const budgetRoleAccessControl = (operation = 'read') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles || [];

      // Define role hierarchy
      const isBudgetAnalyst = userRoles.includes('BUDGET_ANALYST');
      const isBudgetCoordinator = userRoles.includes('BUDGET_COORDINATOR');
      const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
      const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
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

        if (isBudgetAnalyst) {
          // Budget Analysts: prefer to show only own proposals, but also include other proposals
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
              { division: userDivision, status: { $in: ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Manager', 'Finalized'] } }
            ];
          } else {
            // Fallback: show proposals needing coordinator action
            visibilityFilter.$or = [
              { createdByUserId: userId },
              { status: { $in: ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Manager'] } }
            ];
          }
        } else if (isBudgetOfficer) {
          // Budget Officers can see:
          // 1. Proposals forwarded to them by coordinators (Forwarded to Officer)
          // 2. Proposals they have approved (Officer Approved)
          // 3. Proposals they have forwarded to manager (Forwarded to Manager)
          // 4. Finalized proposals for reference
          visibilityFilter.status = { $in: ['Forwarded to Officer', 'Officer Approved', 'Forwarded to Manager', 'Finalized'] };
        } else if (isBudgetManager) {
          // Budget Managers: primarily see items forwarded to them (Forwarded to Manager)
          // Also allow viewing of items that reached 'Officer Approved' or 'Finalized' so managers can review completed items
          visibilityFilter.status = { $in: ['Forwarded to Manager', 'Officer Approved', 'Finalized'] };
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
  const isBudgetAnalyst = userRoles.includes('BUDGET_ANALYST');
  const isBudgetCoordinator = userRoles.includes('BUDGET_COORDINATOR');
  const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
  const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
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

  // Role-based access
  if (isBudgetOfficer && ['Division Submitted', 'Forwarded to Officer', 'Officer Approved', 'Forwarded to Manager', 'Finalized'].includes(proposal.status)) {
    return true;
  }

  if (isBudgetManager) {
    // Managers only have access when the proposal has been forwarded to them
    if (['Forwarded to Manager', 'Officer Approved', 'Finalized'].includes(proposal.status)) return true;
    return false;
  }

  return false;
}

/**
 * Helper function to sync proposal status to all related budget items
 * Updates status and workflowLevel for PersonnelServices, CapitalOutlay, mooeProposals, and Income
 */
async function syncBudgetItemsStatus(proposal) {
  try {
    const { status, workflowLevel, region, department, division, fiscalYear, budgetType } = proposal;
    
    // Map Proposal workflow to Budget Item workflow
    // Proposal uses: COORDINATOR, OFFICER, MANAGER
    // Budget Items use: DIVISION, DEPARTMENT, REGION, FINALIZED
    const workflowMapping = {
      'COORDINATOR': 'DIVISION',
      'OFFICER': 'DEPARTMENT', 
      'MANAGER': 'REGION',
      'FINALIZED': 'FINALIZED'
    };
    
    const mappedWorkflowLevel = workflowMapping[workflowLevel] || 'DIVISION';
    
    // Map Proposal status to Budget Item status
    const statusMapping = {
      'Division Submitted': 'Division Submitted',
      'Forwarded to Officer': 'Department Verified',
      'Officer Approved': 'Department Submitted',
      'Forwarded to Manager': 'Region Approved',
      'Finalized': 'Finalized',
      'Returned': 'Returned',
      // Legacy mappings for backward compatibility
      'Office': 'Department Verified',
      'Office Approved': 'Department Submitted',
      'Office Submitted': 'Region Approved'
    };
    
    const mappedStatus = statusMapping[status] || status;
    
    // Build filter criteria to match related budget items
    const filterCriteria = {
      region,
      department,
      division,
      fiscalYear,
      budgetType
    };

    console.log('🔄 Syncing budget items status:', {
      proposalId: proposal._id,
      proposalStatus: status,
      mappedStatus: mappedStatus,
      proposalWorkflowLevel: workflowLevel,
      mappedWorkflowLevel: mappedWorkflowLevel,
      criteria: filterCriteria
    });

    // Count existing items before update for debugging
    const [psCount, coCount, mooeCount, incomeCount] = await Promise.all([
      PersonnelServices.countDocuments(filterCriteria),
      CapitalOutlay.countDocuments(filterCriteria),
      mooeProposals.countDocuments(filterCriteria),
      Income.countDocuments(filterCriteria)
    ]);

    console.log('📊 Found budget items to update:', {
      personnelServices: psCount,
      capitalOutlay: coCount,
      mooeProposals: mooeCount,
      income: incomeCount
    });

    // Update all related budget items in parallel
    const updatePromises = [
      PersonnelServices.updateMany(filterCriteria, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel 
        } 
      }),
      CapitalOutlay.updateMany(filterCriteria, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel 
        } 
      }),
      mooeProposals.updateMany(filterCriteria, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel 
        } 
      }),
      Income.updateMany(filterCriteria, { 
        $set: { 
          status: mappedStatus, 
          workflowLevel: mappedWorkflowLevel 
        } 
      })
    ];

    const results = await Promise.all(updatePromises);
    
    console.log('✅ Budget items status synced:', {
      personnelServices: results[0].modifiedCount,
      capitalOutlay: results[1].modifiedCount,
      mooeProposals: results[2].modifiedCount,
      income: results[3].modifiedCount
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
    const userRoles = req.user.Roles || [];

    // Only BUDGET_ANALYST can use this endpoint
    if (!userRoles.includes('BUDGET_ANALYST')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Analysts can submit directly to Budget Manager' 
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

    // Verify the analyst owns this proposal
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
    const newStatus = 'Forwarded to Manager';
    const workflowLevel = 'MANAGER';

    proposal.status = newStatus;
    proposal.workflowLevel = workflowLevel;
    proposal.submittedByRole = 'BUDGET_ANALYST';
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

    // Send notification to Budget Manager
    await sendNotification({
      recipientRole: 'BUDGET_MANAGER',
      title: 'New Proposal Submitted (Direct)',
  message: `Proposal "${proposal.title}" submitted directly from ${proposal.division || proposal.department} by ${userName} (Budget Analyst). Comment: ${sanitizedComment}`,
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

// Save draft progress (Budget Analyst)
exports.saveDraft = async (req, res) => {
  try {
    const { proposalId, comment, updates } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.FirstName} ${req.user.LastName}`;
    const userRoles = req.user.Roles || [];

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const isBudgetAnalyst = userRoles.includes('BUDGET_ANALYST');
    const isCreator = proposal.createdByUserId === userId;

    if (!isBudgetAnalyst && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned Budget Analyst can save this draft'
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
      step: 'ANALYST_DRAFT',
      assigneeRole: 'BUDGET_ANALYST',
      pendingRoles: ['BUDGET_ANALYST']
    });

    recordWorkflowEvent(proposal, {
      action: 'SAVE_DRAFT',
      comment: historyComment,
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET_ANALYST',
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

// Submit proposal to Budget Officer
exports.submitProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.FirstName} ${req.user.LastName}`;
    const userRoles = req.user.Roles || [];

    let sanitizedComment;
    try {
      sanitizedComment = validateAndNormalizeComment(comment, 'submit the proposal to the coordinator');
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

    const isBudgetAnalyst = userRoles.includes('BUDGET_ANALYST');
    const isCreator = proposal.createdByUserId === userId;

    if (!isBudgetAnalyst && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned Budget Analyst can submit this proposal'
      });
    }

    if (proposal.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Proposal must be in Draft status before submission. Current status: ${proposal.status}`
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Division Submitted';

    proposal.status = newStatus;
    proposal.workflowLevel = 'COORDINATOR';
    proposal.submittedByRole = 'BUDGET_ANALYST';
    proposal.submittedDate = new Date();
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'COORDINATOR_REVIEW',
      assigneeRole: 'BUDGET_COORDINATOR',
      pendingRoles: ['BUDGET_COORDINATOR']
    });

    recordWorkflowEvent(proposal, {
      action: 'ANALYST_SUBMIT_TO_COORDINATOR',
      comment: sanitizedComment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_COORDINATOR'
    });

    await proposal.save();

    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET_COORDINATOR',
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
      message: 'Proposal submitted to Budget Coordinator successfully',
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
      // BUDGET_OFFICER submits to BUDGET_MANAGER → Forwarded to Manager
      newStatus = 'Forwarded to Manager';
      approvalField = 'submittedByOfficer';
      proposal.workflowLevel = 'MANAGER';
      proposal.submittedByRole = 'BUDGET_OFFICER';
      console.log('✅ BUDGET_OFFICER submission to Manager (Officer Approved → Forwarded to Manager)');
      nextAssigneeRole = 'BUDGET_MANAGER';
      nextPendingRoles = ['BUDGET_MANAGER'];
      nextStep = 'MANAGER_REVIEW';
      targetRole = 'BUDGET_MANAGER';
    } else if ((previousStatus === 'Forwarded to Manager' || previousStatus === 'Office Submitted') && (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN'))) {
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
          userRoles.includes('BUDGET_MANAGER') ? 'Forwarded to Manager' : 
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
    } else if (newStatus === 'Forwarded to Manager') {
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
    let returnField;
    let returnToLevel;
    let notificationMessage;
    let targetRole = null;
    let assignmentStep = proposal.currentStep;
    let assignmentRole = proposal.currentAssigneeRole;
    let assignmentPendingRoles = proposal.pendingWithRoles;
    const notificationPayloads = [];

    // Determine return path based on current status and user role
    if (userRoles.includes('BUDGET_OFFICER')) {
      // BUDGET_OFFICER returns to BUDGET_COORDINATOR
      if (proposal.status === 'Office') {
        returnField = 'returnedByOfficer';
        proposal.workflowLevel = 'COORDINATOR';
        returnToLevel = 'COORDINATOR';
        notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName} (Budget Officer) for revisions. Reason: ${sanitizedComment}`;
        targetRole = 'BUDGET_COORDINATOR';
        assignmentStep = 'COORDINATOR_REVIEW';
        assignmentRole = 'BUDGET_COORDINATOR';
        assignmentPendingRoles = ['BUDGET_COORDINATOR'];
        notificationPayloads.push({
          recipientRole: 'BUDGET_COORDINATOR',
          title: 'Proposal Returned by Officer',
          message: notificationMessage,
          entity: 'proposal',
          recordIds: [proposal._id],
          org: {
            region: proposal.region,
            department: proposal.department,
            division: proposal.division
          },
          createdBy: { userId, name: userName }
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot return proposal with status "${proposal.status}". Expected status: Officer Approved` 
        });
      }
    } else if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) {
      // BUDGET_MANAGER returns based on who submitted
      if (proposal.status === 'Forwarded to Manager' || proposal.status === 'Office Submitted') {
        returnField = 'returnedByManager';
        
        // Check if proposal bypassed officer review
        if (proposal.bypassedOfficerReview || proposal.submittedByRole === 'BUDGET_COORDINATOR') {
          // Return to COORDINATOR
          proposal.workflowLevel = 'COORDINATOR';
          returnToLevel = 'COORDINATOR';
          notificationMessage = `Proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) for revisions. Reason: ${sanitizedComment}`;
          targetRole = 'BUDGET_COORDINATOR';
          assignmentStep = 'COORDINATOR_REVIEW';
          assignmentRole = 'BUDGET_COORDINATOR';
          assignmentPendingRoles = ['BUDGET_COORDINATOR'];
          notificationPayloads.push({
            recipientRole: 'BUDGET_COORDINATOR',
            title: 'Proposal Returned by Manager',
            message: notificationMessage,
            entity: 'proposal',
            recordIds: [proposal._id],
            org: {
              region: proposal.region,
              department: proposal.department,
              division: proposal.division
            },
            createdBy: { userId, name: userName }
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
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot return proposal with status "${proposal.status}". Expected status: Forwarded to Manager` 
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
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
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
 * BUDGET_COORDINATOR WORKFLOW FUNCTIONS
 * New flexible workflow implementation
 */

// BUDGET_COORDINATOR approves proposal from BUDGET_ANALYST
exports.coordinatorApproveProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can approve proposals' 
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

    // Verify proposal is in correct status (can approve from Division Submitted or Under Review by Coordinator)
    const validStatuses = ['Division Submitted', 'Under Review by Coordinator'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Coordinator Approved';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'COORDINATOR';
    proposal.approvedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'COORDINATOR_REVIEW',
      assigneeRole: 'BUDGET_COORDINATOR',
      pendingRoles: ['BUDGET_COORDINATOR']
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_APPROVE',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_COORDINATOR'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_ANALYST (creator)
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved by Coordinator',
      message: `Your proposal "${proposal.title}" has been approved by ${userName} (Budget Coordinator). Comment: ${comment}`,
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
      message: 'Proposal approved by coordinator successfully',
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

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can approve and forward proposals' 
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
    const validStatuses = ['Division Submitted', 'Under Review by Coordinator'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot approve proposal with status "${proposal.status}". Expected status: ${validStatuses.join(' or ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Officer';

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
    }

    // Update proposal - directly to Forwarded to Officer (skip "Coordinator Approved" intermediate status)
    proposal.status = newStatus;
    proposal.workflowLevel = 'OFFICER';
    proposal.submittedByRole = 'BUDGET_COORDINATOR';
    proposal.approvedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };
    proposal.bypassedOfficerReview = false;

    updateAssignment(proposal, {
      step: 'OFFICER_REVIEW',
      assigneeRole: 'BUDGET_OFFICER',
      pendingRoles: ['BUDGET_OFFICER']
    });

    // Record TWO events: approval + forward
    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_APPROVE',
      comment: comment,
      userId,
      userName,
      previousStatus,
      newStatus: 'Coordinator Approved',
      targetRole: 'BUDGET_COORDINATOR'
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_SUBMIT_TO_OFFICER',
      comment: 'Approved and forwarded to Budget Officer',
      userId,
      userName,
      previousStatus: 'Coordinator Approved',
      newStatus,
      targetRole: 'BUDGET_OFFICER'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_ANALYST (creator)
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Approved and Forwarded',
      message: `Your proposal "${proposal.title}" has been approved by ${userName} (Budget Coordinator) and forwarded to Budget Officer. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      createdBy: { userId, name: userName }
    });

    // Send notification to BUDGET_OFFICER
    await sendNotification({
      recipientRole: 'BUDGET_OFFICER',
      title: 'New Proposal for Verification',
      message: `Proposal "${proposal.title}" approved and forwarded by ${userName} (Budget Coordinator) from ${proposal.division || proposal.department} for verification. Comment: ${comment}`,
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
      message: 'Proposal approved and forwarded to Budget Officer successfully',
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

// BUDGET_COORDINATOR returns proposal to BUDGET_ANALYST
exports.coordinatorReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can return proposals' 
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
    if (proposal.status !== 'Division Submitted') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return proposal with status "${proposal.status}". Expected status: Division Submitted` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'ANALYST';
    proposal.returnedByCoordinator = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'ANALYST_DRAFT',
      assigneeRole: 'BUDGET_ANALYST',
      pendingRoles: ['BUDGET_ANALYST']
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_ANALYST'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_ANALYST (creator)
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned by Coordinator',
      message: `Your proposal "${proposal.title}" has been returned by ${userName} (Budget Coordinator) for revisions. Reason: ${comment}`,
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

// BUDGET_COORDINATOR submits to BUDGET_OFFICER (optional path)
exports.coordinatorSubmitToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can submit to Budget Officer' 
      });
    }

    // Find the proposal
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

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Officer successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
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

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Budget Coordinators can submit to Budget Manager' 
      });
    }

    // Find the proposal
    let proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Verify proposal is in correct status (must be coordinator approved)
    const validStatuses = ['Coordinator Approved', 'Office Approved']; // Support legacy status
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
    proposal.submittedByRole = 'BUDGET_COORDINATOR';
    proposal.bypassedOfficerReview = true; // Flag that this skipped officer review

    updateAssignment(proposal, {
      step: 'MANAGER_REVIEW',
      assigneeRole: 'BUDGET_MANAGER',
      pendingRoles: ['BUDGET_MANAGER']
    });

    recordWorkflowEvent(proposal, {
      action: 'COORDINATOR_SUBMIT_TO_MANAGER',
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

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Manager successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
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

    // Verify user is BUDGET_COORDINATOR
    if (!userRoles.includes('BUDGET_COORDINATOR')) {
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
    const newStatus = 'Under Review by Coordinator';

    // Update proposal status if not already under review
    if (proposal.status !== newStatus) {
      proposal.status = newStatus;
    }
    
    proposal.workflowLevel = 'COORDINATOR';
    
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

    res.json({
      success: true,
      message: 'Proposal approved by officer successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
    });

  } catch (error) {
    console.error('Error in officer approve:', error);
    res.status(500).json({ success: false, message: 'Failed to approve proposal', error: error.message });
  }
};

// BUDGET_OFFICER returns proposal to BUDGET_COORDINATOR
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
    const validStatuses = ['Forwarded to Officer', 'Under Review by Officer', 'Officer Approved', 'Office'];
    if (!validStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return proposal with status "${proposal.status}". Expected status: ${validStatuses.join(', ')}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    // Update proposal
    proposal.status = newStatus;
    proposal.workflowLevel = 'COORDINATOR';
    proposal.returnedByOfficer = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    updateAssignment(proposal, {
      step: 'COORDINATOR_REVIEW',
      assigneeRole: 'BUDGET_COORDINATOR',
      pendingRoles: ['BUDGET_COORDINATOR']
    });

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET_COORDINATOR'
    });

    await proposal.save();

    // Sync status to all related budget items
    await syncBudgetItemsStatus(proposal);

    // Send notification to BUDGET_COORDINATOR (submitter)
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned by Officer',
      message: `Your proposal "${proposal.title}" has been returned by ${userName} (Budget Officer) for revisions. Reason: ${comment}`,
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

    res.json({
      success: true,
      message: 'Proposal submitted to Budget Manager successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
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

    res.json({
      success: true,
      message: 'Proposal finalized successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      }
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
    
    if (returnTo === 'COORDINATOR' || proposal.bypassedOfficerReview) {
      targetRole = 'BUDGET_COORDINATOR';
      targetWorkflowLevel = 'COORDINATOR';
    } else if (returnTo === 'ANALYST') {
      targetRole = 'BUDGET_ANALYST';
      targetWorkflowLevel = 'ANALYST';
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
      step: targetWorkflowLevel === 'ANALYST' ? 'ANALYST_DRAFT' : 
            targetWorkflowLevel === 'COORDINATOR' ? 'COORDINATOR_REVIEW' : 'OFFICER_REVIEW',
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

    // Send notification to the target role
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned by Manager',
      message: `Your proposal "${proposal.title}" has been returned by ${userName} (Budget Manager) for revisions. Reason: ${comment}`,
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
async function sendNotification({ recipientUserId, recipientRole, title, message, entity, recordIds, org, createdBy }) {
  try {
    let recipients = [];

    if (recipientUserId) {
      recipients = [recipientUserId];
    } else if (recipientRole) {
      // Store role in a format that can be queried
      recipients = [recipientRole];
    }

    const notifications = recipients.map(recipientId => ({
      recipientUserId: recipientId,
      title,
      message,
      entity,
      recordIds,
      org,
      createdBy
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

module.exports = {
  ...exports,
  budgetRoleAccessControl,
  __private
};