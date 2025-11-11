const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Proposal = require('../models/Proposal');
const Notification = require('../models/Notification');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const Income = require('../models/Income');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const ProposalEditLog = require('../models/ProposalEditLog');
const { applyEditsToOriginalDocuments } = require('./budgetOfficerEditController');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');

const DEBUG_LOG_FILE = path.join(__dirname, '../logs/role-debug.log');
function writeDebugLog(msg) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(DEBUG_LOG_FILE, `[${timestamp}] ${JSON.stringify(msg)}\n`);
    } catch (err) {
    }
}

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
  const result = targets.some((target) => normalizedSet.has(normalizeRoleValue(target)));
  if (!result) {
    writeDebugLog({
      event: 'hasRole_FAILED',
      userRoles,
      normalizedUserRoles: Array.from(normalizedSet),
      targets,
      normalizedTargets: targets.map(normalizeRoleValue)
    });
  }
  return result;
}

async function sendNotification(notificationData) {
  try {
    await Notification.create(notificationData);
  } catch (error) {
    console.error('Error sending notification:', error);
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

async function syncBudgetItemsStatus(proposal) {
  try {
    const { status, region, department, division, fiscalYear, budgetType, processBy } = proposal;

    const statusMapping = {
      'Draft': 'Draft',
      'Forwarded to Reviewer': 'Forwarded to Reviewer',
      'Forwarded to Approver': 'Forwarded to Approver',
      'Forwarded to Analyst': 'Forwarded to Analyst',
      'Forwarded to Officer': 'Forwarded to Officer',
      'Forwarded to Manager': 'Forwarded to Manager',
      'Finalized': 'Finalized',
      'Returned': 'Returned'
    };

    const mappedStatus = statusMapping[status] || status;

    const primaryCriteria = {
      region,
      department,
      division,
      fiscalYear,
      budgetType
    };

    const processedByFilter = processBy ? {
      processBy,
      fiscalYear,
      budgetType
    } : null;

    let combinedFilter = primaryCriteria;
    if (processedByFilter) {
      combinedFilter = {
        $or: [
          primaryCriteria,
          processedByFilter
        ]
      };
    }

    await Promise.all([
      PersonnelServices.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus,
          updatedAt: new Date()
        } 
      }),
      CapitalOutlay.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus,
          updatedAt: new Date()
        } 
      }),
      mooeProposals.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus,
          updatedAt: new Date()
        } 
      }),
      Income.updateMany(combinedFilter, { 
        $set: { 
          status: mappedStatus,
          updatedAt: new Date()
        } 
      })
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error syncing budget items status:', error);
    return { success: false, error: error.message };
  }
}

const budgetRoleAccessControl = (operation = 'read') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = extractUserRoles(req.user);
      const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};

      const isPreparer = hasRole(userRoles, 'BUDGET PREPARER');
      const isReviewer = hasRole(userRoles, 'BUDGET REVIEWER');
      const isApprover = hasRole(userRoles, 'BUDGET APPROVER');
      const isBudgetAnalyst = hasRole(userRoles, 'BUDGET PLANNING ANALYST');
      const isBudgetOfficer = hasRole(userRoles, 'BUDGET OFFICER');
      const isBudgetManager = hasRole(userRoles, 'BUDGET MANAGER');
      const isBRDAdmin = hasRole(userRoles, 'BRD_ADMIN');
      const isSuperAdmin = hasRole(userRoles, 'SUPER ADMIN');

      if (isSuperAdmin || isBRDAdmin) {
        return next();
      }

      if (operation === 'read') {
        let visibilityFilter = {};
        const userDivision = assignment.divisionName || req.user?.division || null;
        const userDepartment = assignment.departmentId || req.user?.department || null;
        const userRegion = assignment.regionId || req.user?.region || null;

        if (isPreparer) {
          visibilityFilter.$or = [
            { createdByUserId: userId },
            ...(userDivision ? [{ division: userDivision }] : []),
            ...(userDepartment ? [{ department: userDepartment }] : []),
            ...(userRegion ? [{ region: userRegion }] : [])
          ];
        } else if (isReviewer) {
          visibilityFilter = {
            $and: [
              { status: { $ne: 'Draft' } },
              {
                $or: [
                  { currentAssigneeRole: 'BUDGET REVIEWER' },
                  { status: { $in: ['Forwarded to Reviewer'] } }
                ]
              }
            ]
          };
        } else if (isApprover) {
          visibilityFilter.status = { $in: ['Forwarded to Approver', 'Returned'] };
        } else if (isBudgetAnalyst) {
          visibilityFilter.status = { $in: ['Forwarded to Analyst'] };
        } else if (isBudgetOfficer) {
          visibilityFilter.status = { $in: ['Forwarded to Officer', 'Returned'] };
        } else if (isBudgetManager) {
          visibilityFilter.status = { $in: ['Forwarded to Manager', 'Finalized', 'Returned'] };
        }

        if (!req.query.visibilityFilter) {
          req.query.visibilityFilter = visibilityFilter;
        } else {
          req.query.visibilityFilter = {
            $and: [req.query.visibilityFilter, visibilityFilter]
          };
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

exports.budgetRoleAccessControl = budgetRoleAccessControl;

exports.preparerSaveDraft = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET PREPARER')) {
      return res.status(403).json({ success: false, message: 'Only Preparers can save drafts' });
    }

    let proposal;
    if (proposalId) {
      proposal = await Proposal.findById(proposalId);
      if (!proposal) {
        return res.status(404).json({ success: false, message: 'Proposal not found' });
      }
      if (proposal.createdByUserId !== userId && proposal.status !== 'Draft') {
        return res.status(403).json({ success: false, message: 'You can only edit your own proposals' });
      }
    } else {
      proposal = new Proposal({
        createdByUserId: userId,
        status: 'Draft',
        workflowHistory: []
      });
    }

    proposal.title = title;
    proposal.description = description;
    proposal.fiscalYear = fiscalYear;
    proposal.budgetType = budgetType;
    proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    await proposal.save();

    res.json({
      success: true,
      message: 'Draft saved successfully',
      proposal
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ success: false, message: 'Failed to save draft', error: error.message });
  }
};

exports.preparerSubmitToReviewer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);
    const hasPreparerRole = hasRole(userRoles, 'BUDGET PREPARER');

    writeDebugLog({
      event: 'preparerSubmitToReviewer_roleCheck',
      userId,
      'req.user.Roles': req.user.Roles,
      extractedUserRoles: userRoles,
      hasRoleResult: hasPreparerRole
    });

    if (!hasPreparerRole) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Preparers can submit proposals' 
      });
    }

    // Comment is OPTIONAL for submit (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Allow submission if:
    // 1. User is the creator (createdByUserId matches), OR
    // 2. createdByUserId is not set (legacy proposals), OR
    // 3. Proposal is in Draft or Returned status (PREPARER can resubmit)
    if (proposal.createdByUserId && proposal.createdByUserId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only submit your own proposals' });
    }

    // Allow submission from Draft, PREPARER_DRAFT, or Returned status
    const allowedStatuses = ['Draft', 'PREPARER_DRAFT', 'Returned'];
    if (!allowedStatuses.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in Draft or Returned status, currently: ${proposal.status}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Reviewer';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET REVIEWER';
    proposal.pendingWithRoles = ['BUDGET REVIEWER'];

    recordWorkflowEvent(proposal, {
      action: 'PREPARER_SUBMIT_TO_REVIEWER',
      comment: comment || 'Proposal submitted to Budget Reviewer',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET REVIEWER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET REVIEWER',
      title: 'New Proposal for Review',
      message: `Proposal "${proposal.title}" submitted for review by ${userName}${comment ? `. Comment: ${comment}` : ''}`,
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
      message: 'Proposal submitted to Budget Reviewer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in preparer submit to reviewer:', error);
    res.status(500).json({ success: false, message: 'Failed to submit proposal', error: error.message });
  }
};

exports.reviewerSaveEdits = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET REVIEWER')) {
      return res.status(403).json({ success: false, message: 'Only Reviewers can edit proposals' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const reviewerStatusValues = ['Forwarded to Reviewer', 'REVIEWER_REVIEW', 'Division Submitted', 'DIVISION SUBMITTED'];
    if (!reviewerStatusValues.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in Reviewer stage to edit' 
      });
    }

    if (title) proposal.title = title;
    if (description) proposal.description = description;
    if (fiscalYear) proposal.fiscalYear = fiscalYear;
    if (budgetType) proposal.budgetType = budgetType;
    if (region) proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_SAVE_EDITS',
      comment: comment || 'Reviewer saved edits',
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET REVIEWER'
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in reviewer save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

exports.reviewerApproveAndForward = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET REVIEWER')) {
      return res.status(403).json({ success: false, message: 'Only Reviewers can approve proposals' });
    }

    // Comment is OPTIONAL for approve/forward (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Reviewer') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Reviewer" status, currently: ${proposal.status}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Approver';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET APPROVER';
    proposal.pendingWithRoles = ['BUDGET APPROVER'];
    proposal.reviewedByUserId = userId;
    proposal.reviewedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_APPROVE_AND_FORWARD',
      comment: comment || 'Proposal approved and forwarded',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET APPROVER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET APPROVER',
      title: 'Proposal for Approval',
      message: `Proposal "${proposal.title}" forwarded for approval by ${userName}${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Approver successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in reviewer approve and forward:', error);
    res.status(500).json({ success: false, message: 'Failed to process proposal', error: error.message });
  }
};

exports.reviewerReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET REVIEWER')) {
      return res.status(403).json({ success: false, message: 'Only Reviewers can return proposals' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Reviewer') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in "Forwarded to Reviewer" status' 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET PREPARER';
    proposal.pendingWithRoles = ['BUDGET PREPARER'];
    proposal.returnedAt = new Date();
    proposal.returnedByUserId = userId;

    recordWorkflowEvent(proposal, {
      action: 'REVIEWER_RETURN_TO_PREPARER',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET PREPARER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET PREPARER',
      title: 'Proposal Returned',
      message: `Proposal "${proposal.title}" returned by Reviewer. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal returned to Preparer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in reviewer return proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

exports.approverSaveEdits = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET APPROVER')) {
      return res.status(403).json({ success: false, message: 'Only Approvers can edit proposals' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const approverStatusValues = ['Forwarded to Approver', 'APPROVER_REVIEW'];
    if (!approverStatusValues.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in Approver stage to edit' 
      });
    }

    if (title) proposal.title = title;
    if (description) proposal.description = description;
    if (fiscalYear) proposal.fiscalYear = fiscalYear;
    if (budgetType) proposal.budgetType = budgetType;
    if (region) proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_SAVE_EDITS',
      comment: comment || 'Approver saved edits',
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET APPROVER'
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in approver save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

exports.approverApproveAndForwardToAnalyst = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET APPROVER')) {
      return res.status(403).json({ success: false, message: 'Only Approvers can approve proposals' });
    }

    // Comment is OPTIONAL for approve/forward (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Approver') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Approver" status, currently: ${proposal.status}` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Analyst';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET PLANNING ANALYST';
    proposal.pendingWithRoles = ['BUDGET PLANNING ANALYST'];
    proposal.approvedByUserId = userId;
    proposal.approvedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_APPROVE_FORWARD_ANALYST',
      comment: comment || 'Proposal approved and forwarded',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET PLANNING ANALYST'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET PLANNING ANALYST',
      title: 'Proposal for Analysis',
      message: `Proposal "${proposal.title}" forwarded for analysis by ${userName}${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Planning Analyst successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in approver forward to analyst:', error);
    res.status(500).json({ success: false, message: 'Failed to process proposal', error: error.message });
  }
};

exports.approverApproveAndForwardToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET APPROVER')) {
      return res.status(403).json({ success: false, message: 'Only Approvers can approve proposals' });
    }

    // Comment is OPTIONAL for approve/forward (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Approver') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Approver" status` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Officer';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET_OFFICER';
    proposal.pendingWithRoles = ['BUDGET_OFFICER'];
    proposal.approvedByUserId = userId;
    proposal.approvedAt = new Date();
    proposal.bypassedAnalyst = true;

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_APPROVE_FORWARD_OFFICER',
      comment: comment || 'Proposal approved and forwarded',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET OFFICER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET OFFICER',
      title: 'Proposal for Officer Review',
      message: `Proposal "${proposal.title}" forwarded to Budget Officer by ${userName}${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Officer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in approver forward to officer:', error);
    res.status(500).json({ success: false, message: 'Failed to process proposal', error: error.message });
  }
};

exports.approverReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET APPROVER')) {
      return res.status(403).json({ success: false, message: 'Only Approvers can return proposals' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Approver') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in "Forwarded to Approver" status' 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'REVIEWER';
    proposal.pendingWithRoles = ['REVIEWER'];
    proposal.returnedAt = new Date();
    proposal.returnedByUserId = userId;

    recordWorkflowEvent(proposal, {
      action: 'APPROVER_RETURN_TO_REVIEWER',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET REVIEWER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET REVIEWER',
      title: 'Proposal Returned',
      message: `Proposal "${proposal.title}" returned by Approver. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal returned to Reviewer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in approver return proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

exports.analystSaveEdits = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET PLANNING ANALYST')) {
      return res.status(403).json({ success: false, message: 'Only Analysts can edit proposals' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const analystStatusValues = ['Forwarded to Analyst', 'ANALYST_REVIEW'];
    if (!analystStatusValues.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in Analyst stage to edit' 
      });
    }

    if (title) proposal.title = title;
    if (description) proposal.description = description;
    if (fiscalYear) proposal.fiscalYear = fiscalYear;
    if (budgetType) proposal.budgetType = budgetType;
    if (region) proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'ANALYST_SAVE_EDITS',
      comment: comment || 'Analyst saved edits',
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET PLANNING ANALYST'
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in analyst save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

exports.analystValidateAndForwardToOfficer = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET PLANNING ANALYST')) {
      return res.status(403).json({ success: false, message: 'Only Budget Planning Analysts can validate proposals' });
    }

    // Comment is OPTIONAL for validate/forward (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Analyst') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Analyst" status` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Officer';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET OFFICER';
    proposal.pendingWithRoles = ['BUDGET OFFICER'];
    proposal.analyzedByUserId = userId;
    proposal.analyzedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'ANALYST_VALIDATE_FORWARD_OFFICER',
      comment: comment || 'Proposal validated and forwarded',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET OFFICER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET OFFICER',
      title: 'Analyzed Proposal for Review',
      message: `Proposal "${proposal.title}" analyzed and forwarded to Budget Officer by ${userName}${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Officer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in analyst validate and forward:', error);
    res.status(500).json({ success: false, message: 'Failed to process proposal', error: error.message });
  }
};

exports.analystReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET PLANNING ANALYST')) {
      return res.status(403).json({ success: false, message: 'Only Analysts can return proposals' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Analyst') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in "Forwarded to Analyst" status' 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'APPROVER';
    proposal.pendingWithRoles = ['APPROVER'];
    proposal.returnedAt = new Date();
    proposal.returnedByUserId = userId;

    recordWorkflowEvent(proposal, {
      action: 'ANALYST_RETURN_TO_APPROVER',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET APPROVER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET APPROVER',
      title: 'Proposal Returned',
      message: `Proposal "${proposal.title}" returned by Analyst. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal returned to Approver successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in analyst return proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

exports.officerSaveEdits = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Officers can edit proposals' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const officerStatusValues = ['Forwarded to Officer', 'OFFICER_REVIEW'];
    if (!officerStatusValues.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in Officer stage to edit' 
      });
    }

    if (title) proposal.title = title;
    if (description) proposal.description = description;
    if (fiscalYear) proposal.fiscalYear = fiscalYear;
    if (budgetType) proposal.budgetType = budgetType;
    if (region) proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_SAVE_EDITS',
      comment: comment || 'Officer saved edits',
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET OFFICER'
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in officer save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

exports.officerApproveAndForwardToManager = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Budget Officers can approve proposals' });
    }

    // Comment is OPTIONAL for approve/forward (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Officer') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Officer" status` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Forwarded to Manager';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET MANAGER';
    proposal.pendingWithRoles = ['BUDGET MANAGER'];
    proposal.officerApprovedUserId = userId;
    proposal.officerApprovedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_APPROVE_FORWARD_MANAGER',
      comment: comment || 'Proposal approved and forwarded',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET MANAGER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET MANAGER',
      title: 'Proposal for Final Approval',
      message: `Proposal "${proposal.title}" approved by Budget Officer and forwarded for final approval${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal forwarded to Budget Manager successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in officer forward to manager:', error);
    res.status(500).json({ success: false, message: 'Failed to process proposal', error: error.message });
  }
};

exports.officerReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET OFFICER')) {
      return res.status(403).json({ success: false, message: 'Only Officers can return proposals' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Officer') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in "Forwarded to Officer" status' 
      });
    }

    const previousStatus = proposal.status;
    let newStatus, targetRole;

    if (proposal.bypassedAnalyst) {
      newStatus = 'Returned';
      targetRole = 'BUDGET APPROVER';
    } else {
      newStatus = 'Returned';
      targetRole = 'BUDGET PLANNING ANALYST';
    }

    proposal.status = newStatus;
    proposal.currentAssigneeRole = targetRole;
    proposal.pendingWithRoles = [targetRole];
    proposal.returnedAt = new Date();
    proposal.returnedByUserId = userId;

    recordWorkflowEvent(proposal, {
      action: 'OFFICER_RETURN',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: targetRole,
      title: 'Proposal Returned',
      message: `Proposal "${proposal.title}" returned by Budget Officer. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal returned successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in officer return proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

exports.managerSaveEdits = async (req, res) => {
  try {
    const { proposalId, title, description, fiscalYear, budgetType, region, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET MANAGER')) {
      return res.status(403).json({ success: false, message: 'Only Managers can edit proposals' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const managerStatusValues = ['Forwarded to Manager', 'MANAGER_REVIEW'];
    if (!managerStatusValues.includes(proposal.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in Manager stage to edit' 
      });
    }

    if (title) proposal.title = title;
    if (description) proposal.description = description;
    if (fiscalYear) proposal.fiscalYear = fiscalYear;
    if (budgetType) proposal.budgetType = budgetType;
    if (region) proposal.region = region;
    proposal.lastModifiedByUserId = userId;
    proposal.lastModifiedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_SAVE_EDITS',
      comment: comment || 'Manager saved edits',
      userId,
      userName,
      previousStatus: proposal.status,
      newStatus: proposal.status,
      targetRole: 'BUDGET MANAGER'
    });

    await proposal.save();

    res.json({
      success: true,
      message: 'Edits saved successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in manager save edits:', error);
    res.status(500).json({ success: false, message: 'Failed to save edits', error: error.message });
  }
};

exports.managerFinalizeProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET MANAGER')) {
      return res.status(403).json({ success: false, message: 'Only Budget Managers can finalize proposals' });
    }

    // Comment is OPTIONAL for finalize (only required for RETURN actions)

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Manager') {
      return res.status(400).json({ 
        success: false, 
        message: `Proposal must be in "Forwarded to Manager" status` 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Finalized';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'FINALIZED';
    proposal.pendingWithRoles = [];
    proposal.finalizedByUserId = userId;
    proposal.finalizedAt = new Date();

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_FINALIZE',
      comment: comment || 'Proposal finalized',
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'FINALIZED'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BRD_ADMIN',
      title: 'Proposal Finalized',
      message: `Proposal "${proposal.title}" has been finalized by Budget Manager ${userName}${comment ? `. Comment: ${comment}` : ''}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal finalized successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in manager finalize proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to finalize proposal', error: error.message });
  }
};

exports.managerReturnProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'BUDGET MANAGER')) {
      return res.status(403).json({ success: false, message: 'Only Managers can return proposals' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    if (proposal.status !== 'Forwarded to Manager') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal must be in "Forwarded to Manager" status' 
      });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';

    proposal.status = newStatus;
    proposal.currentAssigneeRole = 'BUDGET_OFFICER';
    proposal.pendingWithRoles = ['BUDGET_OFFICER'];
    proposal.returnedAt = new Date();
    proposal.returnedByUserId = userId;

    recordWorkflowEvent(proposal, {
      action: 'MANAGER_RETURN_TO_OFFICER',
      comment,
      userId,
      userName,
      previousStatus,
      newStatus,
      targetRole: 'BUDGET OFFICER'
    });

    await proposal.save();
    await syncBudgetItemsStatus(proposal);

    await sendNotification({
      recipientRole: 'BUDGET OFFICER',
      title: 'Proposal Returned',
      message: `Proposal "${proposal.title}" returned by Budget Manager. Comment: ${comment}`,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: { region: proposal.region, department: proposal.department, division: proposal.division },
      createdBy: { userId, name: userName }
    });

    res.json({
      success: true,
      message: 'Proposal returned to Officer successfully',
      proposal: await Proposal.findById(proposal._id).lean()
    });
  } catch (error) {
    console.error('Error in manager return proposal:', error);
    res.status(500).json({ success: false, message: 'Failed to return proposal', error: error.message });
  }
};

exports.getProposalHistory = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    res.json({
      success: true,
      history: proposal.workflowHistory || [],
      proposal: {
        id: proposal._id,
        title: proposal.title,
        status: proposal.status,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      }
    });
  } catch (error) {
    console.error('Error fetching proposal history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
};

exports.getBRDMonitoringDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRoles = extractUserRoles(req.user);

    if (!hasRole(userRoles, 'SUPER ADMIN')) {
      return res.status(403).json({ success: false, message: 'Only BRD admins can access monitoring dashboard' });
    }

    const { region, status, search } = req.query;

    let filter = {};

    if (region) {
      filter.region = region;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { division: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    const proposals = await Proposal.find(filter)
      .select('_id title status region division department currentAssigneeRole lastActionBy lastActionDate')
      .sort({ lastActionDate: -1 })
      .lean();

    const statusCounts = await Proposal.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const regionCounts = await Proposal.aggregate([
      { $match: filter },
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      proposals,
      statistics: {
        totalProposals: proposals.length,
        byStatus: statusCounts,
        byRegion: regionCounts
      }
    });
  } catch (error) {
    console.error('Error fetching BRD monitoring dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard', error: error.message });
  }
};

module.exports.budgetRoleAccessControl = budgetRoleAccessControl;
