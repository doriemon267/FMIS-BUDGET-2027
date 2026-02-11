const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const Region = require('../models/Region');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const PersonnelServices = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const ProposalEditLog = require('../models/ProposalEditLog');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const notificationController = require('./notificationController');
const consolidationService = require('../utils/consolidationService');
const { sendNotificationEmail } = require('../utils/emailNotification');
const mongoose = require('mongoose');

// Workflow status transitions based on the specification
const WORKFLOW_TRANSITIONS = {
  'BUDGET PREPARER': {
    'DRAFT': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
      // Allow direct submit to approver for PREPARER when they are Office-level (validated in performAction)
      'submit-to-approver': 'FORWARDED_TO_APPROVER'
    },
    'RETURNED_TO_PREPARER': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
      'submit-to-approver': 'FORWARDED_TO_APPROVER'
    }
  },
  'BUDGET REVIEWER': {
    'FORWARDED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    }
  },
  'BUDGET APPROVER': {
    'FORWARDED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    },
    'RETURNED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    }
  },
  'BUDGET PLANNING ANALYST': {
    'FORWARDED_TO_BRD_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-approver': 'RETURNED_TO_APPROVER'
    },
    'RETURNED_TO_PLANNING_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-approver': 'RETURNED_TO_APPROVER'
    },
    'RETURNED_TO_PREPARER': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-approver': 'RETURNED_TO_APPROVER'
    }
  },
  'BUDGET OFFICER': {
    'FORWARDED_TO_BRD_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST'
    },
    'RETURNED_TO_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST'
    },
    'RETURNED_TO_PREPARER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST'
    }
  },
  'BUDGET MANAGER': {
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    },
    'RETURNED_TO_PREPARER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    }
  },
  'SUPER ADMIN': {
    // SUPER ADMIN can perform all actions from all statuses
    'DRAFT': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
      'submit-to-approver': 'FORWARDED_TO_APPROVER'
    },
    'FORWARDED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'FORWARDED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    },
    'RETURNED_TO_APPROVER': {
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER'
    },
    'FORWARDED_TO_BRD_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-approver': 'RETURNED_TO_APPROVER'
    },
    'RETURNED_TO_PLANNING_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-approver': 'RETURNED_TO_APPROVER'
    },
    'RETURNED_TO_PREPARER': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'finalize': 'FINALIZED',
      'return-to-approver': 'RETURNED_TO_APPROVER',
      'return-to-reviewer': 'RETURNED_TO_REVIEWER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    },
    'FORWARDED_TO_BRD_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST'
    },
    'RETURNED_TO_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-analyst': 'RETURNED_TO_PLANNING_ANALYST'
    },
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    }
  }
};

// Get user's primary budget role (silent version)
const getUserRole = (req) => {
  const userRoles = req.user?.Roles || [];
  const roleMapping = {
    'BUDGET_PREPARER': 'BUDGET PREPARER',
    'BUDGET PREPARER': 'BUDGET PREPARER',
    'BUDGET_REVIEWER': 'BUDGET REVIEWER',
    'BUDGET REVIEWER': 'BUDGET REVIEWER',
    'BUDGET_APPROVER': 'BUDGET APPROVER',
    'BUDGET APPROVER': 'BUDGET APPROVER',
    'BUDGET_PLANNING_ANALYST': 'BUDGET PLANNING ANALYST',
    'BUDGET PLANNING ANALYST': 'BUDGET PLANNING ANALYST',
    'BUDGET_OFFICER': 'BUDGET OFFICER',
    'BUDGET OFFICER': 'BUDGET OFFICER',
    'BUDGET_MANAGER': 'BUDGET MANAGER',
    'BUDGET MANAGER': 'BUDGET MANAGER',
    'OVERALL_BUDGET_APPROVER': 'BUDGET MANAGER',
    'OVERALL BUDGET APPROVER': 'BUDGET MANAGER',
    'OVERALLBUDGETAPPROVER': 'BUDGET MANAGER',
    'SUPER_ADMIN': 'SUPER ADMIN',
    'SUPER ADMIN': 'SUPER ADMIN'
  };
  for (const role of userRoles) {
    if (roleMapping[role]) return roleMapping[role];
  }
  return null;
};

// Check if user can perform action on proposal
const canPerformAction = (userRole, proposal, action) => {
  if (userRole === 'SUPER ADMIN') return true;

  const transitions = WORKFLOW_TRANSITIONS[userRole];
  if (!transitions) {
    console.log('[canPerformAction] No transitions found for role:', userRole);
    return false;
  }

  // Map status from Proposal format to workflow format
  const statusMapping = {
    'Draft': 'DRAFT',
    'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
    'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
    'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
    'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
    'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
    'Finalized': 'FINALIZED',
    'Returned': 'RETURNED_TO_PREPARER',
    'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
    'Returned to Approver': 'RETURNED_TO_APPROVER',
    'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
    'Returned to Budget Officer': 'RETURNED_TO_OFFICER'
  };

  const workflowStatus = statusMapping[proposal.status] || proposal.status;
  console.log('[canPerformAction] Role:', userRole, 'Status:', proposal.status, 'MappedStatus:', workflowStatus, 'Action:', action);
  console.log('[canPerformAction] Available transitions:', Object.keys(transitions));
  console.log('[canPerformAction] Transitions for status:', transitions[workflowStatus]);
  
  const canDo = transitions[workflowStatus] && transitions[workflowStatus][action];
  console.log('[canPerformAction] Result:', !!canDo);
  return canDo;
};

/**
 * Helper function to determine notification recipients based on workflow action
 * @param {string} action - The workflow action performed
 * @param {Object} proposal - The proposal object
 * @param {string} currentUserRole - The role of the user performing the action
 * @param {string} currentUserId - The ID of the user performing the action
 * @returns {Promise<Array>} Array of user IDs to notify
 */
const getNotificationRecipients = async (action, proposal, currentUserRole, currentUserId) => {
  const recipients = [];

  try {
    console.log('[getNotificationRecipients] Called with action:', action);
    console.log('[getNotificationRecipients] Proposal ID:', proposal._id);
    console.log('[getNotificationRecipients] Proposal region:', proposal.region, 'Type:', typeof proposal.region);
    console.log('[getNotificationRecipients] Current user role:', currentUserRole);
    console.log('[getNotificationRecipients] Current user ID:', currentUserId);
    
    // Handle region - it might be ObjectId or string
    const proposalRegionId = proposal.region ? (typeof proposal.region === 'object' ? proposal.region._id || proposal.region : proposal.region) : null;
    const proposalRegionString = proposal.region ? (typeof proposal.region === 'object' ? proposal.region.toString() : proposal.region) : null;
    
    console.log('[getNotificationRecipients] Resolved region ID:', proposalRegionId, 'String:', proposalRegionString);
    
    // Convert currentUserId to string for comparison to avoid ObjectId casting errors
    const currentUserIdString = String(currentUserId);
    
    // Helper function to find users by workflow role
    const findUsersByWorkflowRole = async (roles, region = null) => {
      try {
        let query = { 
          $or: [
            { workflowRoles: { $in: roles } },
            { userRole: { $in: roles } }
          ],
          isActive: true 
        };
        
        // If region is specified, filter by regionId OR users with no region (system-wide staff)
        if (region && region !== null) {
          query.$and = [
            {
              $or: [
                { regionId: region },
                { regionId: null },
                { regionId: { $exists: false } }
              ]
            }
          ];
        }
        
        console.log('[getNotificationRecipients] Query:', JSON.stringify(query));
        let users = await HierarchicalUserAssignment.find(query).select('userId workflowRoles userRole regionId');
        // Fallback: if no users found in hierarchical assignments, optionally try User.roles as fallback
        if (!users || users.length === 0) {
          if (process.env.ALLOW_USER_ROLES_FALLBACK === 'true') {
            console.warn('[getNotificationRecipients] No HierarchicalUserAssignment found for roles, falling back to User.roles lookup (ALLOWED by env)')
            try {
              const userDocs = await User.find({ roles: { $in: roles }, isActive: true }).select('userId roles');
              users = userDocs.map(u => ({ userId: u.userId || String(u._id), workflowRoles: u.roles || [], regionId: null }));
              console.log('[getNotificationRecipients] Fallback found', users.length, 'users via User.roles for roles', roles);
            } catch (fallbackErr) {
              console.error('[getNotificationRecipients] Error during fallback User.roles query:', fallbackErr.message);
            }
          } else {
            console.warn('[getNotificationRecipients] No HierarchicalUserAssignment found for roles, and User.roles fallback is disabled (ALLOW_USER_ROLES_FALLBACK != true)');
          }
        }
        console.log('[getNotificationRecipients] Found', users.length, 'users with roles', roles);
        
  return users;
      } catch (err) {
        console.error('[getNotificationRecipients] Error querying HierarchicalUserAssignment:', err.message);
        return [];
      }
    };
    
    // Determine target recipients based on action
    if (action === 'submit-to-reviewer') {
      // Notify Budget Reviewers in the same region
      const reviewers = await findUsersByWorkflowRole(['BUDGET_REVIEWER', 'BUDGET REVIEWER'], proposalRegionId);
      const filteredReviewers = reviewers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredReviewers.length, 'reviewers for submit-to-reviewer');
      recipients.push(...filteredReviewers.map(u => u.userId));
    } else if (action === 'submit-to-approver') {
      // Notify Budget Approvers
      const approvers = await findUsersByWorkflowRole(['BUDGET_APPROVER', 'BUDGET APPROVER'], proposalRegionId);
      const filteredApprovers = approvers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredApprovers.length, 'approvers for submit-to-approver');
      recipients.push(...filteredApprovers.map(u => u.userId));
    } else if (action === 'submit-to-analyst') {
      // Notify Budget Planning Analysts (budgetAnalyst role)
      const analysts = await findUsersByWorkflowRole(['budgetAnalyst', 'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'], proposalRegionId);
      const filteredAnalysts = analysts.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredAnalysts.length, 'analysts for submit-to-analyst');
      recipients.push(...filteredAnalysts.map(u => u.userId));
    } else if (action === 'forward-to-officer') {
      // Notify Budget Officers (officeFinalVerifier role)
      const officers = await findUsersByWorkflowRole(['officeFinalVerifier', 'BUDGET_OFFICER', 'BUDGET OFFICER'], proposalRegionId);
      const filteredOfficers = officers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredOfficers.length, 'officers for forward-to-officer');
      recipients.push(...filteredOfficers.map(u => u.userId));
    } else if (action === 'forward-to-manager') {
      // Notify Budget Managers (regionFinalVerifier role)
      const managers = await findUsersByWorkflowRole(['regionFinalVerifier', 'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN']);
      const filteredManagers = managers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredManagers.length, 'managers for forward-to-manager');
      recipients.push(...filteredManagers.map(u => u.userId));
    } else if (action === 'finalize') {
      // Notify the proposal creator (Budget Preparer)
      console.log('[getNotificationRecipients] Notifying creator:', proposal.createdBy);
      recipients.push(proposal.createdBy.toString());
    } else if (action.includes('return')) {
      // For return actions, notify based on previous status
      const prevStatus = proposal.workflowHistory?.[proposal.workflowHistory.length - 1]?.fromStatus;
      
      if (action === 'return-to-preparer') {
        // Notify the proposal creator
        recipients.push(proposal.createdBy.toString());
      } else if (action === 'return-to-reviewer') {
        // Notify Budget Reviewers
        const reviewers = await findUsersByWorkflowRole(['BUDGET_REVIEWER', 'BUDGET REVIEWER'], proposalRegionId);
        const filteredReviewers = reviewers.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredReviewers.length, 'reviewers for return-to-reviewer');
        recipients.push(...filteredReviewers.map(u => u.userId));
      } else if (action === 'return-to-approver') {
        // Notify Budget Approvers
        const approvers = await findUsersByWorkflowRole(['BUDGET_APPROVER', 'BUDGET APPROVER'], proposalRegionId);
        const filteredApprovers = approvers.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredApprovers.length, 'approvers for return-to-approver');
        recipients.push(...filteredApprovers.map(u => u.userId));
      } else if (action === 'return-to-analyst') {
        // Notify Budget Planning Analysts (budgetAnalyst role)
        const analysts = await findUsersByWorkflowRole(['budgetAnalyst', 'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'], proposalRegionId);
        const filteredAnalysts = analysts.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredAnalysts.length, 'analysts for return-to-analyst');
        recipients.push(...filteredAnalysts.map(u => u.userId));
      } else if (action === 'return-to-officer') {
        // Notify Budget Officers (officeFinalVerifier role)
        const officers = await findUsersByWorkflowRole(['officeFinalVerifier', 'BUDGET_OFFICER', 'BUDGET OFFICER'], proposalRegionId);
        const filteredOfficers = officers.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredOfficers.length, 'officers for return-to-officer');
        recipients.push(...filteredOfficers.map(u => u.userId));
      }
    }
  } catch (error) {
    console.warn('[getNotificationRecipients] Error finding recipients:', error.message);
    console.warn('[getNotificationRecipients] Error stack:', error.stack);
  }

  console.log('[getNotificationRecipients] Returning', recipients.length, 'recipients');
  return recipients;
};

/**
 * Resolve display name for the current user (full name for emails/notifications).
 * Tries req.user fields first, then User model, then HierarchicalUserAssignment.
 * @param {Object} req - Express request (req.user may have name, particular, FirstName, LastName, email)
 * @param {string} userIdString - User ID string for DB fallback
 * @returns {Promise<string>} Display name (never "Unknown User" if DB has a name)
 */
const resolveUserDisplayName = async (req, userIdString) => {
  const u = req && req.user;
  if (u) {
    const fromReq =
      (typeof u.name === 'string' && u.name.trim()) ||
      (typeof u.particular === 'string' && u.particular.trim()) ||
      (typeof u.Name === 'string' && u.Name.trim()) ||
      (typeof u.FirstName === 'string' && typeof u.LastName === 'string'
        ? `${u.FirstName} ${u.LastName}`.trim()
        : '') ||
      (typeof u.email === 'string' && u.email.trim());
    if (fromReq && !/^\d+$/.test(fromReq)) return fromReq.trim();
    if (fromReq) { /* fall through to DB for numeric-only id */ }
  }
  try {
    const userDoc = await User.findOne({ userId: userIdString }).select('name').lean();
    if (userDoc && userDoc.name && String(userDoc.name).trim()) return String(userDoc.name).trim();
  } catch (e) { /* ignore */ }
  try {
    const hua = await HierarchicalUserAssignment.findOne({ userId: userIdString }).select('userName').lean();
    if (hua && hua.userName && String(hua.userName).trim()) return String(hua.userName).trim();
  } catch (e) { /* ignore */ }
  // If we only have numeric id or email from req, use it as last resort; otherwise Unknown User
  const fallback = u && (typeof u.name === 'string' && u.name.trim()) ? u.name.trim() : (u && typeof u.email === 'string' && u.email.trim() ? u.email.trim() : null);
  return fallback && !/^\d+$/.test(fallback) ? fallback : 'Unknown User';
};

/**
 * Helper function to create workflow notifications
 * @param {string} action - The workflow action performed
 * @param {Object} proposal - The proposal object
 * @param {Array} recipientUserIds - Array of user IDs to notify
 * @param {string} currentUserName - Name of the user performing the action
 * @param {string} comment - Optional comment/message from the action
 */
const createWorkflowNotification = async (action, proposal, recipientUserIds, currentUserName, comment, currentUserRole) => {
  try {
    console.log('[createWorkflowNotification] Starting with', recipientUserIds.length, 'recipients');
    console.log('[createWorkflowNotification] Proposal details:', {
      proposalId: String(proposal._id),
      proposalTitle: proposal.title,
      proposalTitleType: typeof proposal.title,
      action,
      currentUserName,
      currentUserRole,
      comment: comment ? comment.substring(0, 50) : 'none'
    });
    
    if (!recipientUserIds || recipientUserIds.length === 0) {
      console.log('[createWorkflowNotification] No recipients to notify');
      return;
    }

    // Determine notification title and message based on action
    const actionTitles = {
      'submit-to-reviewer': 'Proposal Submitted for Review',
      'submit-to-approver': 'Proposal Submitted for Approval',
      'submit-to-analyst': 'Proposal Submitted to Budget Planning Analyst',
      'forward-to-officer': 'Proposal Forwarded to Officer',
      'forward-to-manager': 'Proposal Submitted to Manager',
      'finalize': 'Proposal Finalized',
      'return-to-preparer': 'Proposal Returned to Preparer',
      'return-to-reviewer': 'Proposal Returned to Reviewer',
      'return-to-approver': 'Proposal Returned to Approver',
      'return-to-analyst': 'Proposal Returned to Analyst',
      'return-to-officer': 'Proposal Returned to Officer'
    };

    const isReturnAction = action.includes('return');
    const notificationTitle = actionTitles[action] || 'Proposal Status Updated';
    
  // Compose clearer message including role and target action
  let verb = isReturnAction ? 'returned' : 'submitted';
  // If we can derive a more specific direction (e.g., for approver/reviewer)
  let targetRole = '';
  if (action === 'submit-to-reviewer') targetRole = 'Budget Reviewer';
  if (action === 'submit-to-approver') targetRole = 'Budget Approver';
  if (action === 'submit-to-analyst') targetRole = 'Budget Planning Analyst';
  if (action === 'forward-to-officer') targetRole = 'Budget Officer';
  if (action === 'forward-to-manager') targetRole = 'Budget Manager';
  if (!targetRole && action.includes('return')) targetRole = 'previous workflow step';

  // BULLETPROOF: Ensure all message components are valid strings, never ObjectIDs
  const safeName = String(currentUserName || 'Unknown User').trim();
  const safeTitle = String(proposal.title || 'Untitled Proposal').trim();
  const safeTargetRole = targetRole ? ' to ' + String(targetRole).trim() : '';
  
  let notificationMessage = `${safeName} ${verb} the proposal "${safeTitle}"${safeTargetRole}.`;
  
    if (comment && isReturnAction) {
      const safeComment = String(comment).trim();
      if (safeComment) {
        notificationMessage += ` Comment: ${safeComment}`;
      }
    }

    // BULLETPROOF SAFEGUARD: Ensure message is NEVER empty or looks like an ObjectID
    // Check for: empty, ObjectID pattern (24 hex chars), or too short
    const msgCheck = notificationMessage.trim();
    if (!msgCheck || msgCheck.length === 0 || /^[a-f0-9]{24}$/i.test(msgCheck) || msgCheck.length < 15) {
      notificationMessage = `Proposal ${isReturnAction ? 'returned' : 'submitted'}: "${safeTitle}"`;
    }
    
    console.log('[createWorkflowNotification] Final message:', {
      message: notificationMessage.substring(0, 100),
      messageLength: notificationMessage.length,
      messageType: typeof notificationMessage
    });

    // Deep link to the proposal on the allproposal page
    // Format: /allproposal?tab=all-proposals&proposalId=<id>
    // Always navigate to ALL PROPOSALS tab when clicking notification
    const relatedLink = `/allproposal?tab=all-proposals&proposalId=${proposal._id}`;

    // Create notification for each recipient
    // Unique key to prevent duplicate notifications for the same action + proposal
    const uniqueKey = `${action}_${proposal._id}`;

    const notificationData = recipientUserIds.map(userId => ({
      recipientUserId: userId,
      type: isReturnAction ? 'PROPOSAL_RETURNED' : 'PROPOSAL_SUBMITTED',
      title: notificationTitle,
      message: notificationMessage,
      relatedEntityId: proposal._id.toString(),
      relatedEntityType: 'PROPOSAL',
      relatedLink: relatedLink,
      entity: 'proposal',
      recordIds: [proposal._id],
      org: {
        region: proposal.region,
        department: proposal.department,
        division: proposal.division
      },
      metadata: {
        action,
        proposalTitle: proposal.title,
        proposalId: proposal._id.toString(),
        tab: 'all-proposals',
        performedBy: currentUserName,
        comment: comment || ''
      },
      uniqueKey,
      status: 'UNREAD',
      createdAt: new Date()
    }));

    console.log('[createWorkflowNotification] About to insert', notificationData.length, 'notifications');
    
    // LOG FIRST NOTIFICATION TO VERIFY MESSAGE
    if (notificationData.length > 0) {
      console.log('[createWorkflowNotification] First notification to insert:', {
        message: String(notificationData[0].message).substring(0, 100),
        messageLength: String(notificationData[0].message).length,
        messageType: typeof notificationData[0].message,
        title: notificationData[0].title,
        proposalTitle: notificationData[0].metadata.proposalTitle
      });
    }
    
    // Prevent duplicate notifications per recipient by checking existing UNREAD notifications with the same uniqueKey
    const notificationsToCreate = [];
    for (const data of notificationData) {
      try {
        const exists = await Notification.findOne({
          recipientUserId: data.recipientUserId,
          status: 'UNREAD',
          'metadata.uniqueKey': uniqueKey
        }).lean();
        if (!exists) notificationsToCreate.push(data);
      } catch (err) {
        console.warn('[createWorkflowNotification] Failed dedupe check for recipient', data.recipientUserId, err.message);
        notificationsToCreate.push(data);
      }
    }

    // Bulk create notifications
    let result = [];
    if (notificationsToCreate.length > 0) {
      result = await Notification.insertMany(notificationsToCreate);
      
      // LOG INSERTED DATA TO VERIFY
      if (result.length > 0) {
        console.log('[createWorkflowNotification] First inserted notification:', {
          id: String(result[0]._id),
          message: String(result[0].message).substring(0, 100),
          messageLength: String(result[0].message).length,
          messageType: typeof result[0].message,
          title: result[0].title
        });
      }
    }
    console.log(`[createWorkflowNotification] Successfully created ${result.length} notification(s) for action: ${action}`);
  } catch (error) {
    console.error('[createWorkflowNotification] Error creating notifications:', error.message);
    console.error('[createWorkflowNotification] Error stack:', error.stack);
  }
};

/**
 * Helper function to send email notifications to workflow recipients
 * @param {string} action - The workflow action performed
 * @param {Object} proposal - The proposal object
 * @param {Array} recipientUserIds - Array of user IDs to notify
 * @param {string} currentUserName - Name of the user performing the action
 * @param {string} comment - Optional comment/message from the action
 * @param {string} currentUserRole - The role of the user performing the action
 */
const sendWorkflowEmails = async (action, proposal, recipientUserIds, currentUserName, comment, currentUserRole) => {
  try {
    if (!recipientUserIds || recipientUserIds.length === 0) {
      console.log('[sendWorkflowEmails] No recipients to email');
      return;
    }

    console.log('[sendWorkflowEmails] Attempting to send emails to recipients:', recipientUserIds);

    // Prefer User.email (NIA Email synced on get-user); fallback to HierarchicalUserAssignment.email
    const userDocs = await User.find({ userId: { $in: recipientUserIds } }).select('userId email emailPreferences').lean();
    const huaDocs = await HierarchicalUserAssignment.find({ userId: { $in: recipientUserIds } }).select('email userName userId').lean();

    const prefsMap = {};
    userDocs.forEach(u => {
      prefsMap[u.userId] = u.emailPreferences;
    });

    const emailMap = {};
    for (const uid of recipientUserIds) {
      const prefs = prefsMap[uid] || {};
      const emailEnabled = prefs.enabled !== false;
      const proposalMuted = proposal && prefs.mutedProposals && prefs.mutedProposals.includes(proposal._id || proposal.id);
      const notificationTypeEnabled = prefs.notificationTypes?.workflow !== false;
      if (!emailEnabled || proposalMuted || notificationTypeEnabled === false) {
        console.log('[sendWorkflowEmails] Skipped userId:', uid, 'emailEnabled:', emailEnabled, 'muted:', proposalMuted, 'typeEnabled:', notificationTypeEnabled);
        continue;
      }
      const fromUser = userDocs.find(u => String(u.userId) === String(uid));
      const fromHua = huaDocs.find(u => String(u.userId) === String(uid));
      const email = (fromUser && fromUser.email) || (fromHua && fromHua.email) || null;
      if (email) {
        emailMap[uid] = email;
        console.log('[sendWorkflowEmails] Mapped userId:', uid, '-> email:', email, fromUser ? '(User/NIA)' : '(HUA fallback)');
      } else {
        console.warn('[sendWorkflowEmails] No email for userId:', uid);
      }
    }

    if (Object.keys(emailMap).length === 0) {
      console.warn('[sendWorkflowEmails] No recipients with valid email (User or HUA)');
      return;
    }

    // Prepare email subject and body
    const isReturnAction = action.includes('return');
    const actionTitles = {
      'submit-to-reviewer': 'Proposal Submitted for Review',
      'submit-to-approver': 'Proposal Submitted for Approval',
      'submit-to-analyst': 'Proposal Submitted to Budget Planning Analyst',
      'forward-to-officer': 'Proposal Forwarded to Officer',
      'forward-to-manager': 'Proposal Submitted to Manager',
      'finalize': 'Proposal Finalized',
      'return-to-preparer': 'Proposal Returned to Preparer',
      'return-to-reviewer': 'Proposal Returned to Reviewer',
      'return-to-approver': 'Proposal Returned to Approver',
      'return-to-analyst': 'Proposal Returned to Analyst',
      'return-to-officer': 'Proposal Returned to Officer'
    };

    const emailSubject = actionTitles[action] || 'Proposal Status Updated';
    const verb = isReturnAction ? 'returned' : 'submitted';
    let targetRole = '';
    if (action === 'submit-to-reviewer') targetRole = 'Budget Reviewer';
    if (action === 'submit-to-approver') targetRole = 'Budget Approver';
    if (action === 'submit-to-analyst') targetRole = 'Budget Planning Analyst';
    if (action === 'forward-to-officer') targetRole = 'Budget Officer';
    if (action === 'forward-to-manager') targetRole = 'Budget Manager';

    const safeName = String(currentUserName || 'Unknown User').trim();
    const safeTitle = String(proposal.title || 'Untitled Proposal').trim();
    const safeTargetRole = targetRole ? ' to ' + String(targetRole).trim() : '';

    // Resolve region name from ObjectId
    let regionName = 'N/A';
    if (proposal.region) {
      try {
        const regionString = String(proposal.region);
        console.log('[sendWorkflowEmails] Looking up region:', regionString);
        const regionObj = await Region.findById(regionString).select('Region');
        if (regionObj) {
          regionName = regionObj.Region || regionString;
          console.log('[sendWorkflowEmails] Found region name:', regionName);
        } else {
          console.warn('[sendWorkflowEmails] Region not found for ID:', regionString);
          regionName = regionString;
        }
      } catch (err) {
        console.error('[sendWorkflowEmails] Error resolving region:', err.message);
        regionName = String(proposal.region);
      }
    }

    // Get department and division info - try multiple sources
    let department = proposal.department || 'N/A';
    let division = proposal.division || 'N/A';
    
    console.log('[sendWorkflowEmails] Raw values - Department:', department, 'Division:', division);
    
    // If not found in NewProposalWorkflow, try legacy Proposal collection
    if (department === 'N/A' || division === 'N/A') {
      try {
        const legacyProposal = await Proposal.findOne({ title: proposal.title, fiscalYear: String(proposal.fiscalYear) }).limit(1);
        if (legacyProposal) {
          department = department === 'N/A' ? (legacyProposal.department || 'N/A') : department;
          division = division === 'N/A' ? (legacyProposal.division || 'N/A') : division;
          console.log('[sendWorkflowEmails] Found in legacy Proposal - Department:', department, 'Division:', division);
        }
      } catch (err) {
        console.warn('[sendWorkflowEmails] Error fetching from legacy Proposal:', err.message);
      }
    }
    
    // If still not found, try getting from user's HierarchicalUserAssignment
    if (department === 'N/A' || division === 'N/A') {
      try {
        const createdBy = String(proposal.createdBy || currentUserId);
        const hua = await HierarchicalUserAssignment.findOne({ userId: createdBy, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName');
        if (hua) {
          division = division === 'N/A' ? (hua.divisionName || 'N/A') : division;
          department = department === 'N/A' ? (hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || 'N/A') : department;
          console.log('[sendWorkflowEmails] Found in HierarchicalUserAssignment - Department:', department, 'Division:', division);
        }
      } catch (err) {
        console.warn('[sendWorkflowEmails] Error fetching from HierarchicalUserAssignment:', err.message);
      }
    }
    
    console.log('[sendWorkflowEmails] Final values - Department:', department, 'Division:', division);

    let emailBody = `Dear Recipient,\n\n`;
    emailBody += `${safeName} has ${verb} the proposal "${safeTitle}"${safeTargetRole}.\n\n`;
    emailBody += `Proposal Details:\n`;
    emailBody += `- Title: ${safeTitle}\n`;
    emailBody += `- Fiscal Year: ${proposal.fiscalYear || 'N/A'}\n`;
    emailBody += `- Budget Type: ${proposal.modelType || 'N/A'}\n`;
    emailBody += `- Region: ${regionName}\n`;
    emailBody += `- Department: ${department}\n`;
    emailBody += `- Division: ${division}\n`;
    if (comment && isReturnAction) {
      emailBody += `\nFeedback: ${String(comment).trim()}\n`;
    }
    emailBody += `\nPlease log in to the system to view and process this proposal.\n\n`;
    emailBody += `Note: This is an automated message. Please do not reply to this email.\n`;
    emailBody += `Best regards,\nFMIS - BUDGET System`;

    // HTML version of the email (enhanced UI)
    const safeTargetRoleHtml = safeTargetRole ? ` <span style="color:#6b7280;">${safeTargetRole}</span>` : '';
    const feedbackHtml = comment && isReturnAction
      ? `<div class="feedback-box">
          <p style="margin-top: 0; font-weight: 600; color: #92400e;">Feedback</p>
          <p style="margin: 8px 0; color: #78350f;">${String(comment).trim()}</p>
        </div>`
      : '';
    let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden; }
    .header { background: linear-gradient(135deg, #2d5a2d 0%, #375e38 50%, #3d6b3d 100%); color: #fff; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 1.35rem; font-weight: 600; letter-spacing: 0.02em; }
    .header .sub { margin-top: 4px; font-size: 0.85rem; opacity: 0.9; }
    .content { padding: 28px; line-height: 1.6; }
    .greeting { font-size: 1rem; color: #374151; margin-bottom: 16px; }
    .message { font-size: 1rem; color: #1f2937; margin-bottom: 24px; }
    .message .name { font-weight: 600; color: #375e38; }
    .message .verb { font-weight: 600; color: #1f2937; }
    .message .title { font-weight: 600; color: #1e40af; }
    .details-box { background: #f8faf8; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #375e38; }
    .details-box .heading { margin: 0 0 14px 0; font-size: 0.9rem; font-weight: 600; color: #375e38; text-transform: uppercase; letter-spacing: 0.04em; }
    .detail-row { display: flex; margin: 10px 0; font-size: 0.95rem; }
    .detail-label { font-weight: 600; color: #4b5563; min-width: 110px; }
    .detail-value { color: #1f2937; }
    .action-cta { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .action-cta p { margin: 0; font-size: 0.95rem; color: #1e40af; font-weight: 500; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.8rem; color: #6b7280; }
    .footer .note { color: #b91c1c; margin: 8px 0; }
    .signature { color: #375e38; font-weight: 600; margin-top: 12px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>FMIS - OSBPIS Notification</h1>
        <div class="sub">Budget Proposal Workflow</div>
      </div>
      <div class="content">
        <p class="greeting">Dear Recipient,</p>
        <p class="message"><span class="name">${safeName}</span> has <span class="verb">${verb}</span> the proposal "<span class="title">${safeTitle}</span>"${safeTargetRoleHtml}.</p>
        
        <div class="details-box">
          <p class="heading">Proposal Details</p>
          <div class="detail-row"><span class="detail-label">Title:</span><span class="detail-value"> ${safeTitle}</span></div>
          <div class="detail-row"><span class="detail-label">Fiscal Year:</span><span class="detail-value"> ${proposal.fiscalYear || 'N/A'}</span></div>
          <div class="detail-row"><span class="detail-label">Budget Type:</span><span class="detail-value"> ${proposal.modelType || 'N/A'}</span></div>
          <div class="detail-row"><span class="detail-label">Region:</span><span class="detail-value"> ${regionName}</span></div>
          <div class="detail-row"><span class="detail-label">Department:</span><span class="detail-value"> ${department}</span></div>
          <div class="detail-row"><span class="detail-label">Division:</span><span class="detail-value"> ${division}</span></div>
        </div>
        
        ${feedbackHtml}
        
        <div class="action-cta">
          <p>Action Required: Please log in to the system to view and process this proposal.</p>
        </div>
        
        <div class="footer">
          <p class="note">This is an automated message. Please do not reply to this email.</p>
          <p class="signature">FMIS - NIA</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send emails to all recipients
    console.log('[sendWorkflowEmails] Starting email delivery process...');
    const emailPromises = recipientUserIds.map(async (userId) => {
      const email = emailMap[userId];
      if (!email) {
        console.warn(`[sendWorkflowEmails] No email found for user ${userId}`);
        return;
      }

      try {
        console.log(`[sendWorkflowEmails] Sending email to ${email}...`);
        const result = await sendNotificationEmail(email, emailSubject, emailBody, htmlBody);
        console.log(`[sendWorkflowEmails] ✓ Email successfully sent to ${email}`, {
          messageId: result.messageId,
          action: action
        });
      } catch (err) {
        console.error(`[sendWorkflowEmails] ✗ Failed to send email to ${email}:`, err.message);
        console.error(`[sendWorkflowEmails] Error details:`, err);
      }
    });

    const results = await Promise.all(emailPromises);
    console.log(`[sendWorkflowEmails] ✓ Completed email delivery process. Sent ${emailPromises.length} email(s) for action: ${action}`);
  } catch (error) {
    console.error('[sendWorkflowEmails] Error sending workflow emails:', error.message);
    console.error('[sendWorkflowEmails] Error stack:', error.stack);
  }
};

// Create new proposal
exports.createProposal = async (req, res) => {
  try {
    const userRole = getUserRole(req);
    if (!userRole || !['BUDGET PREPARER', 'SUPER ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only Budget Preparers can create proposals'
      });
    }

    const { 
      title, 
      description, 
      modelType, 
      fiscalYear, 
      projectedCorporateIncome, 
      projectedSubsidy,
      region,
      department,
      division
    } = req.body;

    // Robust user identifiers (avoid undefined createdBy)
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const nameFallback = [req.user?.name, req.user?.UserName, req.user?.email, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim()].find(v => v && v.length > 0);
    const userName = nameFallback || 'UNKNOWN_USER';

    // Validate/normalize modelType - accept common variants and normalize
    const validModelTypes = ['Initial', 'NEP', 'GAA'];
    const normalizeModelType = (val) => {
      if (!val) return 'Initial';
      const v = String(val).trim().toUpperCase();
      if (v.includes('NEP')) return 'NEP';
      if (v.includes('GAA')) return 'GAA';
      return 'Initial';
    };
    const normalizedModelType = normalizeModelType(modelType);
    if (!validModelTypes.includes(normalizedModelType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid modelType. Must be one of: ${validModelTypes.join(', ')}`
      });
    }

    // ============ DUE DATE VALIDATION ============
    // Check if the fiscal year settings allow proposal creation (due date not passed).
    // Uses region-specific due date extension if one exists for the proposal's region.
    const isSuperAdmin = userRole === 'SUPER ADMIN' || userRole === 'SUPER_ADMIN';
    
    const fiscalYearSettings = await Settings.findOne({
      fiscalYear: String(fiscalYear),
      budgetType: normalizedModelType,
      isActive: true
    }).lean();

    if (fiscalYearSettings) {
      const now = new Date();
      // Build list of region identifiers for matching region-specific extensions (id and/or name)
      const regionIdentifiers = [];
      if (region != null) {
        if (typeof region === 'object') {
          const r = region;
          if (r._id) regionIdentifiers.push(String(r._id));
          if (r.id) regionIdentifiers.push(String(r.id));
          if (r.Region) regionIdentifiers.push(String(r.Region));
          if (r.RegionName) regionIdentifiers.push(String(r.RegionName));
          if (r.regionName) regionIdentifiers.push(String(r.regionName));
        } else {
          regionIdentifiers.push(String(region));
        }
      }
      const { getEffectiveDueDateForRegion } = require('../utils/settingsUtils');
      const { dueDate: effectiveDueDate } = getEffectiveDueDateForRegion(fiscalYearSettings, regionIdentifiers.length ? regionIdentifiers : null);

      if (effectiveDueDate && effectiveDueDate < now && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: `The submission period for FY ${fiscalYear} (${normalizedModelType}) has ended. Due date was ${effectiveDueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Please contact your administrator to extend the deadline.`
        });
      }
    } else {
      // No matching settings for this FY+budgetType - check if ANY active fiscal year is expired.
      // Prevents bypass by creating for FY/types without settings when current FY has expired.
      if (!isSuperAdmin) {
        const activeSettings = await Settings.findOne({ isActive: true }).lean();
        if (activeSettings) {
          const { getEffectiveDueDateForRegion } = require('../utils/settingsUtils');
          const { dueDate: activeDueDate } = getEffectiveDueDateForRegion(activeSettings, null);
          const now = new Date();
          if (activeDueDate && activeDueDate < now) {
            return res.status(403).json({
              success: false,
              message: `The current fiscal year has expired. Submissions are closed. Please contact your administrator to update the due date or create a new fiscal year.`
            });
          }
        }
      }
    }
    // ============ END DUE DATE VALIDATION ============

  // Calculate the proposed budget amount
    const calculatedAmount = (Number(projectedCorporateIncome) || 0) + (Number(projectedSubsidy) || 0);

    // Resolve region: accept ObjectId string/object or plain name and look up by Region model
    let regionId = (region && typeof region === 'object') ? (region._id || region.id) : region;
    if (region && typeof region === 'string' && !/^[0-9a-fA-F]{24}$/.test(region)) {
      try {
        const regionDoc = await Region.findOne({ $or: [
          { Region: region },
          { regionName: region },
          { RegionName: region }
        ] });
        regionId = regionDoc ? regionDoc._id : undefined;
      } catch (_e) {
        regionId = undefined;
      }
    }
    // Ensure only a valid ObjectId goes into NewProposalWorkflow.region
    const finalRegionId = (regionId && /^[0-9a-fA-F]{24}$/.test(String(regionId))) ? regionId : undefined;
    // Derive default department/division from user assignment if not provided
    let derivedDepartment = department || '';
    let derivedDivision = division || '';
    try {
      if (!department || !division) {
        const hua = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName')
          .populate('regionId', 'Region regionName RegionName');
        if (hua) {
          if (!derivedDivision && hua.divisionName) derivedDivision = hua.divisionName;
          if (!derivedDepartment && hua.departmentId) {
            derivedDepartment = hua.departmentId.Department || hua.departmentId.departmentName || hua.departmentId.DepartmentName || '';
          }
        }
      }
    } catch (_e) { /* non-fatal */ }

    const proposalData = {
      title,
      description,
      modelType: normalizedModelType,
      fiscalYear: parseInt(fiscalYear, 10),
      projectedCorporateIncome: Number(projectedCorporateIncome) || 0,
      projectedSubsidy: Number(projectedSubsidy) || 0,
      amount: calculatedAmount,
      createdBy: userId,
      createdByName: userName,
      region: finalRegionId,
      division: derivedDivision || undefined,
      department: derivedDepartment || undefined,
      isCentralOffice: false, // Default to false; can be changed later
      status: 'DRAFT'
    };

    // Create NewProposalWorkflow document
    const proposal = new NewProposalWorkflow(proposalData);
    await proposal.save();

    // Also create a Proposal document for the proposals collection
    // This is needed for backward compatibility and proposal tracking
    const legacyProposalData = {
      title,
      description,
      fiscalYear: String(fiscalYear),
      budgetType: normalizedModelType,
      // Legacy proposal stores a region string; prefer provided name or fall back to known fields
      region: (typeof region === 'string') ? region : (region?.Region || region?.regionName || region?.RegionName || ''),
      department: derivedDepartment,
      division: derivedDivision,
      originalDepartment: derivedDepartment,
      originalDivision: derivedDivision,
      processBy: userName,
      status: 'Draft',
      workflowLevel: 'BUDGET PREPARER',
      currentStep: 'PREPARER_DRAFT',
      workflowRef: proposal._id,
      proposalId: proposal._id, // backward-compatible alias
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      createdByName: userName
    };

    const legacyProposal = new Proposal(legacyProposalData);
    await legacyProposal.save();

    // CRITICAL FIX: Recalculate and sync totals after creating proposal
    // This ensures NewProposalWorkflow has correct initial totals (0 if no data yet)
    try {
      const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
      await recalculateAndSaveProposalTotals({ proposalId: legacyProposal._id });
    } catch (err) {
      console.error('Warning: Failed to recalculate initial proposal totals:', err.message);
      // Continue - don't block proposal creation if recalculation fails
    }

    res.status(201).json({
      success: true,
      message: 'Proposal created successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create proposal',
      error: error.message
    });
  }
};

// Get proposals based on user role and filters
exports.getProposals = async (req, res) => {
  try {
  const userRole = getUserRole(req);
  // Debug: Log incoming request context for troubleshooting monitoring visibility
  try {
    console.log('[getProposals] userRole:', userRole, 'userRoles:', req.user?.Roles, 'userId:', userIdString, 'view:', view, 'region:', req.query?.region);
  } catch (e) {
    console.log('[getProposals] Failed to log debug context');
  }
  const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
  const userName = [req.user?.name, req.user?.UserName, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(), req.user?.email].find(v => v && v.length > 0) || 'UNKNOWN_USER';
  const { status, modelType, fiscalYear, page = 1, limit = 10, view } = req.query;
  // Normalize userId to string to avoid mismatches
  const userIdString = userId ? String(userId) : undefined;

    let query = {};

    // Apply standard filters
    if (status) {
      const statusAlias = {
        'Draft': 'DRAFT',
        'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
        'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
        'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
        'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
        'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
        'Finalized': 'FINALIZED',
        'Returned': 'RETURNED_TO_PREPARER',
        'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
        'Returned to Approver': 'RETURNED_TO_APPROVER',
        'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
        'Returned to Budget Officer': 'RETURNED_TO_OFFICER'
      };
      query.status = statusAlias[status] || status;
    }
    if (modelType) query.modelType = modelType;
    if (fiscalYear) query.fiscalYear = parseInt(fiscalYear);

    // Apply view-based and role-based filtering
    switch (view) {
      case 'my-proposals':
        // Allow matching either stored userId or userName (in case earlier records used name)
        query.$or = [
          { createdBy: userIdString },
          { createdBy: userName },
          { createdByName: userName }
        ];
        query.status = 'DRAFT';     // Use DRAFT enum value
        break;
      case 'pending-review':
        // Ensure BRD roles only see items that were actually forwarded to them (exclude drafts)
        if (userRole && WORKFLOW_TRANSITIONS[userRole]) {
          const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole]); // enum codes
          const pendingEnum = allowedStatuses.filter(s => s !== 'DRAFT');

          // Map enum codes to DB-stored statuses
          // NOTE: Database might store either enum format (FORWARDED_TO_BRD_ANALYST) 
          // OR human-readable format (Forwarded to Budget Planning Analyst)
          const reverseStatusMapping = {
            'DRAFT': 'Draft',
            'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
            'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
            'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
            'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
            'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
            'FINALIZED': 'Finalized',
            'RETURNED_TO_PREPARER': 'Returned to Preparer',
            'RETURNED_TO_REVIEWER': 'Returned to Reviewer',
            'RETURNED_TO_APPROVER': 'Returned to Approver',
            'RETURNED_TO_PLANNING_ANALYST': 'Returned to Budget Planning Analyst',
            'RETURNED_TO_OFFICER': 'Returned to Budget Officer'
          };

          const pendingDb = pendingEnum.map(code => reverseStatusMapping[code] || code);
          
          // Include both enum format AND human-readable format to handle both storage types
          const allStatuses = new Set([
            ...pendingDb,                    // Human-readable formats
            ...pendingEnum                   // Enum formats
          ]);

          // Manager visibility enhancement: include analyst/officer stages and their returned variants
          if (userRole === 'BUDGET MANAGER') {
            const analystOfficerEnumStatuses = [
              'FORWARDED_TO_BRD_ANALYST',
              'FORWARDED_TO_BRD_OFFICER',
              'RETURNED_TO_PLANNING_ANALYST',
              'RETURNED_TO_OFFICER'
            ];
            const analystOfficerDbStatuses = [
              reverseStatusMapping['FORWARDED_TO_BRD_ANALYST'],
              reverseStatusMapping['FORWARDED_TO_BRD_OFFICER'],
              reverseStatusMapping['RETURNED_TO_PLANNING_ANALYST'],
              reverseStatusMapping['RETURNED_TO_OFFICER']
            ].filter(Boolean);
            
            analystOfficerEnumStatuses.forEach(s => allStatuses.add(s));
            analystOfficerDbStatuses.forEach(s => allStatuses.add(s));
          }
          
          query.status = { $in: Array.from(allStatuses) };
          
          if (!query.status.$in || query.status.$in.length === 0) {
            return res.json({
              success: true,
              proposals: [],
              pagination: { page: 1, limit: 10, total: 0, pages: 0 }
            });
          }
        } else {
          return res.json({
            success: true,
            proposals: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 }
          });
        }
        break;
      case 'all-proposals':
        query.status = { $ne: 'DRAFT' };  // Use DRAFT enum
        break;
      case 'monitoring':
          // Monitoring tab for Budget Manager and SUPER ADMIN: show all proposals except drafts
          if (userRole === 'BUDGET MANAGER' || userRole === 'SUPER ADMIN') {
                  // Show all non-DRAFT statuses. SUPER ADMIN sees same view as Budget Manager.
                  query.status = { $ne: 'DRAFT' };
          } else {
            return res.json({
              success: true,
              proposals: [],
              metrics: {},
              pagination: { page: 1, limit: 10, total: 0, pages: 0 }
            });
          }
          break;
      default:
        // Default to 'my-proposals' if view is not specified
        query.createdBy = userId;
        break;
    }

    // Manual pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

  // Silent mode: no verbose logging

    // Query both NewProposalWorkflow and legacy Proposal models
    const newProposalsCount = await NewProposalWorkflow.countDocuments(query);
    let newProposals = await NewProposalWorkflow.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('region', 'Region regionName RegionName');
    if (view === 'monitoring' && (userRole === 'BUDGET MANAGER' || userRole === 'SUPER ADMIN')) {
      console.log('[MONITORING] Query:', query);
      console.log('[MONITORING] Found proposals:', newProposals.length);
      if (newProposals.length > 0) {
        newProposals.forEach((p, idx) => {
          console.log(`[MONITORING] Proposal #${idx + 1}:`, {
            _id: p._id,
            title: p.title,
            status: p.status,
            division: p.division,
            department: p.department,
            region: p.region
          });
        });
      }
    }

    // Fetch legacy proposals for totals/region string mapping
    const wfIds = newProposals.map(p => p._id);
    const legacyList = await Proposal.find({ workflowRef: { $in: wfIds } }, 'workflowRef region totalIncome totalExpenses proposedBudget department division').lean();
    const legacyMap = new Map(legacyList.map(lp => [String(lp.workflowRef), lp]));

    // Fallback: if my-proposals view returned none, broaden search to createdBy only (no status) then re-filter
    if (view === 'my-proposals' && newProposals.length === 0) {
      // First fallback: direct createdBy match (string cast)
      const fallbackQuery = { createdBy: userIdString };
  const fallbackAll = await NewProposalWorkflow.find(fallbackQuery).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
      newProposals = fallbackAll.filter(p => p.status === 'DRAFT');
      // Second fallback: try createdByName if still empty
      if (newProposals.length === 0) {
  const nameFallback = await NewProposalWorkflow.find({ createdByName: userName, status: 'DRAFT' }).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
        newProposals = nameFallback;
      }
      // Final fallback: only return user-specific drafts. Do NOT return ALL drafts to avoid exposure.
      if (newProposals.length === 0) {
        const allUserDrafts = await NewProposalWorkflow.find({ createdBy: userIdString, status: 'DRAFT' }).sort({ createdAt: -1 }).limit(25).populate('region','Region regionName RegionName');
        // Also try createdByName fallback, but do not broaden to all drafts
        if (allUserDrafts.length > 0) {
          newProposals = allUserDrafts;
        } else {
          const nameFallback = await NewProposalWorkflow.find({ createdByName: userName, status: 'DRAFT' }).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
          newProposals = nameFallback;
        }
      }
    }

    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's organizational assignment
    // Apply to all views EXCEPT 'monitoring' (which is for Budget Manager who sees all)
    // and SUPER ADMIN (who sees everything)
    if (userRole !== 'SUPER ADMIN' && userRole !== 'BUDGET MANAGER' && view !== 'monitoring') {
      try {
        // Get user's hierarchical assignment
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          // Get assigned organizational unit names
          const assignedDepartment = userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department;
          const assignedRegion = userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region;
          const assignedDivision = userAssignment.divisionName;
          
          console.log('[ORG_FILTER] User:', userIdString, 'Role:', userRole, 'Level:', userAssignment.assignmentLevel);
          console.log('[ORG_FILTER] Assigned - Dept:', assignedDepartment, 'Div:', assignedDivision, 'Region:', assignedRegion);
          
          const filteredProposals = newProposals.filter(p => {
            const legacy = legacyMap.get(String(p._id));
            if (!legacy) return false;
            
            console.log(`[ORG_FILTER] Checking proposal: Div=${legacy.division} Dept=${legacy.department} Region=${legacy.region}`);
            
            // CASE 1: User assigned at DIVISION level - only show proposals from that division
            if (assignedDivision && userAssignment.assignmentLevel === 'DIVISION') {
              if (legacy.division === assignedDivision) {
                console.log('[ORG_FILTER] ✓ ALLOWED (division match)');
                return true;
              }
            }
            
            // CASE 2: User assigned at DEPARTMENT level - only show proposals from that department
            if (assignedDepartment && (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'OFFICE')) {
              if (legacy.department === assignedDepartment) {
                console.log('[ORG_FILTER] ✓ ALLOWED (department match)');
                return true;
              }
            }
            
            // CASE 3: User assigned at REGION level - only show proposals from that region
            if (assignedRegion && userAssignment.assignmentLevel === 'REGION') {
              if (legacy.region === assignedRegion) {
                console.log('[ORG_FILTER] ✓ ALLOWED (region match)');
                return true;
              }
            }
            
            // CASE 4: Full access (no restrictions)
            if (userAssignment.assignmentLevel === 'FULL') {
              console.log('[ORG_FILTER] ✓ ALLOWED (full access)');
              return true;
            }
            
            console.log('[ORG_FILTER] ✗ BLOCKED (no match)');
            return false;
          });
          
          console.log(`[ORG_FILTER] Results: ${newProposals.length} proposals before, ${filteredProposals.length} after`);
          
          // Always apply filter - don't show proposals from other responsibility centers
          newProposals = filteredProposals;
        } else {
          console.log('[ORG_FILTER] No assignment found for user, showing all proposals');
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error:', err.message);
        // On error, keep original proposals (don't hide data)
      }
    }

    // Map NewProposalWorkflow status to legacy format for consistency
    const mappedNewProposals = newProposals.map(p => {
      const legacy = legacyMap.get(String(p._id));
      // Use legacy info if available, otherwise fallback to NewProposalWorkflow fields
      const regionName = legacy?.region || p.region?.Region || p.region?.regionName || p.region?.RegionName || '';
      const divisionName = legacy?.division || p.division || '';
      const departmentName = legacy?.department || p.department || '';
      const responsibilityCenter = divisionName || departmentName || regionName || undefined;
      return ({
        _id: p._id,
        title: p.title,
        description: p.description,
        fiscalYear: p.fiscalYear,
        region: p.region,
        division: divisionName || undefined,
        department: departmentName || undefined,
        // Who created/owns the draft on UI (used by actions menu for PREPARER)
        processBy: legacy?.processBy || p.createdByName,
        // Responsibility Center: prefer Division, then Department, then Region
        responsibilityCenter,
        budgetType: p.modelType,  // Map modelType to budgetType for consistency
        status: p.status,
        createdBy: p.createdBy,
        createdByName: p.createdByName,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        amount: Number(p.amount || 0),
        totalIncome: Number(legacy?.totalIncome ?? p.totalIncome ?? 0),
        totalExpenses: Number(legacy?.totalExpenses ?? p.totalExpenses ?? 0),
        proposedBudget: Number(legacy?.proposedBudget ?? ((Number(legacy?.totalExpenses ?? p.totalExpenses ?? 0) + Number(legacy?.totalIncome ?? p.totalIncome ?? 0)) || p.amount || 0)),
        projectedCorporateIncome: p.projectedCorporateIncome,
        projectedSubsidy: p.projectedSubsidy,
        workflowHistory: p.workflowHistory || [],
        fromNewWorkflow: true
      });
    });

    // Metrics aggregation for monitoring view
    let metrics = undefined;
    if (view === 'monitoring' && (userRole === 'BUDGET MANAGER' || userRole === 'SUPER ADMIN')) {
      // Normalize statuses for metrics (map either human-readable or enum codes to consistent enum keys)
      const humanToEnumStatusMap = {
        'Draft': 'DRAFT',
        'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
        'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
        'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
        'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
        'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
        'Finalized': 'FINALIZED',
        'Returned': 'RETURNED_TO_PREPARER',
        'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
        'Returned to Approver': 'RETURNED_TO_APPROVER',
        'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
        'Returned to Budget Officer': 'RETURNED_TO_OFFICER'
      };

      metrics = mappedNewProposals.reduce((acc, p) => {
        acc.total = (acc.total || 0) + 1;
        acc.byStatus = acc.byStatus || {};
        // p.status may already be an enum or a human-readable string; map to enum
        const enumStatus = humanToEnumStatusMap[p.status] || p.status || 'UNKNOWN';
        acc.byStatus[enumStatus] = (acc.byStatus[enumStatus] || 0) + 1;
        return acc;
      }, {});
    }

    res.json({
      success: true,
      proposals: mappedNewProposals,
      metrics,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: newProposalsCount,
        pages: Math.ceil(newProposalsCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

// Get user's own proposals
// This route might now be redundant due to the 'view' logic in getProposals
// but we'll keep it for any direct calls that might exist.
exports.getMyProposals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'region', select: 'name regionName' }
      ]
    };

    const result = await NewProposalWorkflow.paginate({ createdBy: userId }, options);

    res.json({
      success: true,
      proposals: result.docs, // Changed 'data' to 'proposals'
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        pages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching my proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

// Get proposals pending review for current user
exports.getPendingReview = async (req, res) => {
  try {
    const userRole = getUserRole(req);
    const { page = 1, limit = 10 } = req.query;

    if (!userRole || userRole === 'BUDGET PREPARER') {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      });
    }

    const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole] || []);

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'region', select: 'name regionName' }
      ]
    };

    const result = await NewProposalWorkflow.paginate(
      { status: { $in: allowedStatuses } },
      options
    );

    res.json({
      success: true,
      data: result.docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        pages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching pending review proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

// Get single proposal by ID
exports.getProposalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getUserRole(req);
    const userId = req.user.id;

    // CRITICAL: First try to fetch from Proposal model (fmis_budget) which has projectedSubsidy
    // This is needed for BudgetarySupportTable which passes Proposal._id, not NewProposalWorkflow._id
    let proposal = await Proposal.findById(id).lean();
    
    if (proposal) {
      console.log('[getProposalById] Found Proposal with ID:', id, '- returning with projectedSubsidy:', proposal.projectedSubsidy);
      return res.json({
        success: true,
        data: proposal
      });
    }

    // Fallback: Try NewProposalWorkflow model (fmis_budget)
    proposal = await NewProposalWorkflow.findById(id)
      .populate('region', 'Region regionName RegionName');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Check if user can access this proposal
    if (userRole !== 'SUPER ADMIN' && userRole === 'BUDGET PREPARER' && proposal.createdBy !== userId) {
      const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole] || []);
      if (!allowedStatuses.includes(proposal.status)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Map to same format as getProposals so Responsibility Center and Budget Type display correctly
    const legacy = await Proposal.findOne({ workflowRef: id }).lean();
    const regionName = legacy?.region || proposal.region?.Region || proposal.region?.regionName || proposal.region?.RegionName || '';
    const divisionName = legacy?.division || proposal.division || '';
    const departmentName = legacy?.department || proposal.department || '';
    const responsibilityCenter = divisionName || departmentName || regionName || undefined;

    const mappedProposal = {
      ...proposal.toObject ? proposal.toObject() : proposal,
      responsibilityCenter,
      division: divisionName || proposal.division,
      department: departmentName || proposal.department,
      budgetType: proposal.modelType
    };

    res.json({
      success: true,
      data: mappedProposal
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
      error: error.message
    });
  }
};

// Perform action on proposal
exports.performAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;
    const userRole = getUserRole(req);
    const userId = req.user.id;
    const userIdString = String(userId);
    const userName = await resolveUserDisplayName(req, userIdString);

    console.log('[PERFORM_ACTION] User:', { userRole, userId, userName });
    console.log('[PERFORM_ACTION] Request:', { proposalId: id, action, comment });

    // Check assignment and override submit-to-reviewer -> submit-to-approver for Office-level PREPARER
    let userAssignment = null;
    if (action === 'submit-to-reviewer' && userRole === 'BUDGET PREPARER') {
      try {
        userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString }).lean();
        console.debug('[PERFORM_ACTION] User assignment found:', !!userAssignment, userAssignment ? userAssignment.assignmentLevel : 'N/A');
        if (userAssignment && String(userAssignment.assignmentLevel).toUpperCase() === 'OFFICE') {
          console.debug('[PERFORM_ACTION] Office-level Submission: overriding action to submit-to-approver');
          action = 'submit-to-approver';
        }
      } catch (assignmentErr) {
        console.warn('[PERFORM_ACTION] Error fetching user assignment:', assignmentErr.message);
      }
    }

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    console.log('[PERFORM_ACTION] ========== START ACTION PROCESSING ==========');
    console.log('[PERFORM_ACTION] Proposal ID:', id);
    console.log('[PERFORM_ACTION] Proposal Title:', proposal.title);
    console.log('[PERFORM_ACTION] Proposal Status:', proposal.status);
    console.log('[PERFORM_ACTION] User Role:', userRole);
    console.log('[PERFORM_ACTION] Action Requested:', action);
    console.log('[PERFORM_ACTION] =========================================');

    // Map status from Proposal format to workflow format for validation
    const statusMapping = {
      'Draft': 'DRAFT',
      'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
      'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
      'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
      'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
      'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
      'Finalized': 'FINALIZED',
      'Returned': 'RETURNED_TO_PREPARER',
      'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
      'Returned to Approver': 'RETURNED_TO_APPROVER',
      'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
      'Returned to Budget Officer': 'RETURNED_TO_OFFICER'
    };

    const workflowStatus = statusMapping[proposal.status] || proposal.status;
    console.log('[PERFORM_ACTION] Mapped Workflow Status:', workflowStatus);

    // Check if user can perform this action
    const canPerform = canPerformAction(userRole, proposal, action);
    console.log('[PERFORM_ACTION] canPerformAction result:', canPerform);
    
    if (!canPerform) {
      console.log('[PERFORM_ACTION] 403 - User cannot perform action. User role:', userRole, 'Action:', action, 'Status:', proposal.status);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action'
      });
    }

    // NOTE: The following check is redundant with canPerformAction, but kept for safety
    const transitions = WORKFLOW_TRANSITIONS[userRole];
    if (!transitions) {
      console.log('[PERFORM_ACTION] ERROR: No transitions defined for role:', userRole);
      return res.status(500).json({
        success: false,
        message: 'Workflow not configured for this role'
      });
    }

    if (!transitions[workflowStatus]) {
      console.log('[PERFORM_ACTION] ERROR: Status', workflowStatus, 'not available for role', userRole, '. Available:', Object.keys(transitions));
      return res.status(400).json({
        success: false,
        message: 'Invalid status for this role'
      });
    }

    if (!transitions[workflowStatus][action]) {
      console.log('[PERFORM_ACTION] ERROR: Action', action, 'not available for status', workflowStatus, '. Available:', Object.keys(transitions[workflowStatus]));
      return res.status(400).json({
        success: false,
        message: 'Invalid action for current status'
      });
    }

    const newWorkflowStatus = transitions[workflowStatus][action];

    // Final enforcement: If PREPARER is attempting submit-to-approver, ensure they are Office-level
    if (action === 'submit-to-approver' && userRole === 'BUDGET PREPARER') {
      try {
        userAssignment = userAssignment || await HierarchicalUserAssignment.findOne({ userId: userIdString }).lean();
        if (!userAssignment || String(userAssignment.assignmentLevel).toUpperCase() !== 'OFFICE') {
          console.warn('[PERFORM_ACTION] 403 - Budget Preparer submit-to-approver is only allowed for Office-level users');
          return res.status(403).json({ success: false, message: 'Direct submit to approver is only allowed for Office-level preparers' });
        }
      } catch (assignmentErr) {
        console.warn('[PERFORM_ACTION] Error enforcing assignment level for submit-to-approver:', assignmentErr.message);
      }
    }

    // Map workflow status to legacy Proposal format
    const workflowToProposalStatus = {
      'DRAFT': 'Draft',
      'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
      'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
      'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
      'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
      'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
      'FINALIZED': 'Finalized',
      'RETURNED_TO_PREPARER': 'Returned to Preparer',
      'RETURNED_TO_REVIEWER': 'Returned to Reviewer',
      'RETURNED_TO_APPROVER': 'Returned to Approver',
      'RETURNED_TO_PLANNING_ANALYST': 'Returned to Budget Planning Analyst',
      'RETURNED_TO_OFFICER': 'Returned to Budget Officer'
    };

    // Update proposal
    const oldStatus = proposal.status;
    proposal.status = newWorkflowStatus;
    
    // Update projectedSubsidy if provided by frontend
    if (req.body.projectedSubsidy !== undefined) {
      proposal.projectedSubsidy = Number(req.body.projectedSubsidy) || 0;
    }
    
    proposal.workflowHistory = proposal.workflowHistory || [];
    proposal.workflowHistory.push({
      action,
      fromStatus: oldStatus,
      toStatus: newWorkflowStatus,
      performedBy: userId,
      performedByName: userName,
      comment: comment || ''
    });

    await proposal.save();

    // Trigger BRD Consolidation when proposal reaches BRD Analyst level
    if (newWorkflowStatus === 'FORWARDED_TO_BRD_ANALYST' && oldStatus !== 'FORWARDED_TO_BRD_ANALYST') {
      try {
        console.log('[PERFORM_ACTION] Triggering BRD consolidation for proposal:', proposal._id);
        // Populate region data for consolidation
        const populatedProposal = await NewProposalWorkflow.findById(proposal._id)
          .populate('region', 'Region RegionName')
          .lean();
        
        if (populatedProposal) {
          await consolidationService.createConsolidationRecord(populatedProposal);
          console.log('[PERFORM_ACTION] BRD consolidation record created successfully');
        }
      } catch (consolidationError) {
        console.error('[PERFORM_ACTION] Error creating BRD consolidation:', consolidationError.message);
        // Don't fail the workflow action if consolidation fails
      }
    }

    // Also update the legacy Proposal collection to keep it in sync
    try {
      const legacyStatus = workflowToProposalStatus[newWorkflowStatus] || newWorkflowStatus;
      const updateData = {
        status: legacyStatus,
        workflowLevel: userRole,
        updatedAt: new Date()
      };
      
      // Include projectedSubsidy if it was provided
      if (req.body.projectedSubsidy !== undefined) {
        updateData.projectedSubsidy = Number(req.body.projectedSubsidy) || 0;
      }
      
      const updateResult = await Proposal.findOneAndUpdate(
        { $or: [{ workflowRef: proposal._id }, { proposalId: proposal._id }] },
        updateData,
        { new: true }
      );
      if (updateResult) {
        console.log('[PERFORM_ACTION] Updated legacy Proposal collection with status:', legacyStatus);
      } else {
        console.warn('[PERFORM_ACTION] Warning: No legacy Proposal found to update for workflowRef:', proposal._id);
      }
    } catch (syncError) {
      console.warn('[PERFORM_ACTION] Warning: Could not update legacy Proposal collection:', syncError.message);
    }

    // Also sync status to all line-item collections
    try {
      const legacyStatus = workflowToProposalStatus[newWorkflowStatus] || newWorkflowStatus;
      const lineItemUpdateQuery = { $or: [{ workflowRef: proposal._id }, { proposalId: proposal._id }] };
      const lineItemUpdatePayload = { status: legacyStatus, workflowLevel: userRole, updatedAt: new Date() };

      // Update PersonnelServices
      await PersonnelServices.updateMany(lineItemUpdateQuery, lineItemUpdatePayload);
      
      // Update MOOE
      await MooeProposal.updateMany(lineItemUpdateQuery, lineItemUpdatePayload);
      
      // Update CapitalOutlay
      await CapitalOutlay.updateMany(lineItemUpdateQuery, lineItemUpdatePayload);
      
      // Update Income
      await Income.updateMany(lineItemUpdateQuery, lineItemUpdatePayload);
      
      console.log('[PERFORM_ACTION] Synced status to all line-item collections:', legacyStatus);
    } catch (syncError) {
      console.warn('[PERFORM_ACTION] Warning: Could not sync line-item collections:', syncError.message);
    }

    // Create notifications for relevant workflow actions
    try {
      const isNotificationAction = [
        'submit-to-reviewer',
        'submit-to-approver',
        'submit-to-analyst',
        'forward-to-officer',
        'forward-to-manager',
        'finalize',
        'return-to-preparer',
        'return-to-reviewer',
        'return-to-approver',
        'return-to-analyst',
        'return-to-officer'
      ].includes(action);

      console.log('[PERFORM_ACTION] Is notification action:', isNotificationAction, 'Action:', action);

      if (isNotificationAction) {
        // Get recipient user IDs based on the action
        const recipientUserIds = await getNotificationRecipients(action, proposal, userRole, userId);
        
        console.log('[PERFORM_ACTION] Recipients found:', recipientUserIds.length, 'IDs:', recipientUserIds);
        
        // Create notifications for all recipients
        if (recipientUserIds.length > 0) {
          console.log('[PERFORM_ACTION] Creating notifications for action:', action);
          await createWorkflowNotification(action, proposal, recipientUserIds, userName, comment, userRole);
          console.log('[PERFORM_ACTION] Notifications created successfully');
          
          // Send email notifications
          try {
            console.log('[PERFORM_ACTION] Sending email notifications for action:', action);
            await sendWorkflowEmails(action, proposal, recipientUserIds, userName, comment, userRole);
            console.log('[PERFORM_ACTION] Email notifications sent successfully');
          } catch (emailError) {
            console.error('[PERFORM_ACTION] Error sending email notifications:', emailError.message);
          }
        } else {
          console.log('[PERFORM_ACTION] No recipients found for action:', action);
        }
      }
    } catch (notificationError) {
      console.error('[PERFORM_ACTION] Error creating notifications:', notificationError.message);
      console.error('[PERFORM_ACTION] Notification error stack:', notificationError.stack);
      // Don't fail the action if notification creation fails
    }

    res.json({
      success: true,
      message: 'Action performed successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error performing action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform action',
      error: error.message
    });
  }
};

// Update proposal (for editing)
exports.updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getUserRole(req);
    const userId = req.user.id;
    const userName = req.user.name || req.user.email;
    

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Only allow editing if:
    // 1. User is the creator and status is DRAFT
    // 2. User has BRD staff roles (Analyst, Officer, Manager)
    // 3. User is SUPER ADMIN
    const isBRDStaff = ['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST', 'BUDGET OFFICER', 'BUDGET_OFFICER', 'BUDGET MANAGER', 'BUDGET_MANAGER'].includes(userRole);
    const isSuperAdmin = userRole === 'SUPER ADMIN';
    
    // Normalize to string to avoid ObjectId vs string mismatch
    const isCreatorEditingDraft = String(proposal.createdBy) === String(userId) && proposal.status === 'DRAFT';
    
    if (!isCreatorEditingDraft && !isBRDStaff && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this proposal'
      });
    }

    const allowedFields = ['title', 'description', 'modelType', 'fiscalYear', 'amount', 'income', 'personnel', 'mooe', 'capitalOutlay', 'division', 'department', 'office', 'isCentralOffice'];
    const updates = {};
    const changes = {}; // Track what changed

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== proposal[field]) {
        updates[field] = req.body[field];
        changes[field] = {
          oldValue: proposal[field],
          newValue: req.body[field]
        };
      }
    });

    // If no changes, just return current proposal
    if (Object.keys(changes).length === 0) {
      return res.json({
        success: true,
        message: 'No changes detected',
        data: proposal
      });
    }

    // Log the changes to workflowHistory
    proposal.workflowHistory = proposal.workflowHistory || [];
    proposal.workflowHistory.push({
      action: 'EDIT',
      performedBy: userId,
      performedByName: userName,
      position: userRole,
      fromStatus: proposal.status,
      toStatus: proposal.status, // Status doesn't change during edit
      comment: `Fields updated: ${Object.keys(changes).join(', ')}`,
      changes: changes, // Store detailed change log
      timestamp: new Date(),
      changeType: 'PROPOSAL_EDIT'
    });

    // Apply updates
    Object.assign(proposal, updates);
    await proposal.save();

    console.log('[UPDATE_PROPOSAL] Changes made to proposal', id);
    console.log('[UPDATE_PROPOSAL] User:', userName, 'Role:', userRole);
    console.log('[UPDATE_PROPOSAL] Changes:', JSON.stringify(changes, null, 2));

    res.json({
      success: true,
      message: 'Proposal updated successfully',
      data: proposal,
      changesSummary: {
        fieldsChanged: Object.keys(changes),
        changedBy: userName,
        changedAt: new Date(),
        details: changes
      }
    });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update proposal',
      error: error.message
    });
  }
};

// Get audit trail/change log for a proposal
exports.getAuditTrail = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const editLogs = await ProposalEditLog.find({ workflowRef: id })
      .sort({ timestamp: -1 })
      .lean();

    const auditTrail = editLogs.map(log => ({
      action: log.changeType,
      actionType: log.entityType,
      proposalType: log.budgetType,
      performedBy: log.changedBy?.userName || 'SYSTEM',
      role: log.changedBy?.role,
      timestamp: log.timestamp,
      summary: log.summary,
      changedFields: log.changes ? log.changes.map(c => c.field) : [],
      details: log.changes ? log.changes.map(c => ({
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        type: c.valueType
      })) : [],
      comment: log.comments
    }));

    res.json({
      success: true,
      message: 'Audit trail retrieved successfully',
      data: {
        proposalId: id,
        proposalTitle: proposal.title,
        totalChanges: auditTrail.length,
        changes: auditTrail
      }
    });
  } catch (error) {
    console.error('Error retrieving audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail',
      error: error.message
    });
  }
};

// Delete proposal (only for drafts by creator)
exports.deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = getUserRole(req);

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Allow SUPER ADMIN to delete any proposal (for maintenance/testing).
    // Other users can only delete their own DRAFT proposals.
    if (userRole !== 'SUPER ADMIN') {
      if (proposal.createdBy !== userId || proposal.status !== 'DRAFT') {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own draft proposals'
        });
      }
    }

    // Delete proposal and all related records that reference this workflowRef or proposalId
    let session = null;
    let usedTransaction = false;
    const deletionResults = {};
    try {
      // Attempt to start a transaction; if the server is a standalone MongoDB
      // instance this will throw (error code 20). In that case we fall back
      // to performing non-transactional deletions for compatibility.
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        usedTransaction = true;
      } catch (txErr) {
        console.error('Transactions are not available on this MongoDB deployment. Falling back to non-transactional delete. Error:', txErr && txErr.message ? txErr.message : txErr);
        // Mark transaction fallback in deletion results so operators can monitor
        deletionResults.transactionFallback = true;
        if (session) {
          try { session.endSession(); } catch (e) {}
          session = null;
        }
        usedTransaction = false;
      }

      const BRDConsolidation = require('../models/BRDConsolidation');
      const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');

      // Helper to delete with or without session
      const runDelete = async (Model, filter) => {
        if (usedTransaction && session) return Model.deleteMany(filter, { session });
        return Model.deleteMany(filter);
      };

      const modelsToClean = [
        PersonnelServices,
        MooeProposal,
        CapitalOutlay,
        Income,
        ProposalEditLog,
        BRDConsolidation,
        BudgetOfficerEdit,
      ];

      for (const M of modelsToClean) {
        let result;
        try {
          result = await runDelete(M, { $or: [{ workflowRef: id }, { proposalId: id }] });
        } catch (deleteErr) {
          // If a transaction-related error occurs (e.g., code 20), fall back to non-transactional deletion
          if (deleteErr && (deleteErr.code === 20 || (deleteErr.errorResponse && deleteErr.errorResponse.code === 20))) {
            console.warn('Transaction error detected during delete. Falling back to non-transactional deletes for model', M.modelName || (M.collection && M.collection.name), 'error:', deleteErr.message || deleteErr);
            usedTransaction = false;
            if (session) {
              try { session.endSession(); } catch (e) {}
              session = null;
            }
            // Retry without transaction/session
            result = await M.deleteMany({ $or: [{ workflowRef: id }, { proposalId: id }] });
          } else {
            throw deleteErr; // rethrow other errors
          }
        }
        deletionResults[M.modelName || (M.collection && M.collection.name) || 'unknown'] = result.deletedCount;
      }

      const legacyProposalDelete = await runDelete(Proposal, { $or: [{ workflowRef: id }, { proposalId: id }] });
      deletionResults.Proposal = legacyProposalDelete.deletedCount;

      const notifRes = await runDelete(Notification, { $or: [{ relatedEntityId: String(id) }, { 'metadata.proposalId': String(id) }] });
      deletionResults.Notification = notifRes.deletedCount;

      // Delete the workflow itself
      if (usedTransaction && session) {
        await NewProposalWorkflow.findByIdAndDelete(id, { session });
        await session.commitTransaction();
        session.endSession();
      } else {
        await NewProposalWorkflow.findByIdAndDelete(id);
      }

      return res.json({ success: true, message: 'Proposal and related records deleted successfully', transactionUsed: usedTransaction, transactionFallback: !!deletionResults.transactionFallback, details: deletionResults });
    } catch (innerErr) {
      try {
        if (usedTransaction && session) {
          await session.abortTransaction();
          session.endSession();
        }
      } catch (abortErr) {
        console.warn('Failed to abort transaction after error:', abortErr && abortErr.message ? abortErr.message : abortErr);
      }
      console.error('Error during cascading delete:', innerErr);
      return res.status(500).json({ success: false, message: 'Failed to delete proposal and related records', error: innerErr.message });
    }
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete proposal',
      error: error.message
    });
  }
};

// Upload attachment to proposal
exports.uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { module = 'general' } = req.query;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Create attachment object
    const attachment = {
      attachmentId: new mongoose.Types.ObjectId(),
      module: module,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`, // URL to access the file
      uploadedBy: req.user?.id || req.user?.userId || req.user?.Username?.[0],
      uploadedByName: req.user?.username || req.user?.email || 'Unknown',
      uploadedAt: new Date()
    };

    // Initialize attachments array if it doesn't exist
    if (!proposal.attachments) {
      proposal.attachments = [];
    }

    proposal.attachments.push(attachment);
    await proposal.save();

    res.json({
      success: true,
      message: 'Attachment uploaded successfully',
      attachment: attachment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload attachment',
      error: error.message
    });
  }
};

// Delete attachment from proposal
exports.deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!proposal.attachments || proposal.attachments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attachments found'
      });
    }

    // Find the attachment object to be removed
    const initialLength = proposal.attachments.length;
    const targetAttachment = proposal.attachments.find(att => String(att.attachmentId || att._id) === String(attachmentId));
    if (!targetAttachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    // Permission: only uploader, BRD staff, or SUPER ADMIN can delete attachments
    const deleterUserId = String(req.user?.id);
    const userRole = getUserRole(req);
    const isBRDStaff = ['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST', 'BUDGET OFFICER', 'BUDGET_OFFICER', 'BUDGET MANAGER', 'BUDGET_MANAGER'].includes(userRole);
    const isUploader = String(targetAttachment.uploadedBy || '') === deleterUserId;
    if (userRole !== 'SUPER ADMIN' && !isBRDStaff && !isUploader) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this attachment' });
    }

    // Remove attachment
    proposal.attachments = proposal.attachments.filter(
      att => String(att.attachmentId || att._id) !== String(attachmentId)
    );
    
    // Check if attachment was found and deleted
    if (proposal.attachments.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Save after removal
    await proposal.save();

    // Determine filename to delete (prefer attachment metadata)
    let filenameToDelete = targetAttachment?.filename || req.body?.filename || req.body?.originalName || null;

    // Best effort: delete the file from disk using the removed attachment filename
    const filename = targetAttachment?.filename || filenameToDelete;
    if (filename) {
      try {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '../uploads');
        const filePath = path.join(uploadsDir, filename);
        // Ensure the file to delete is inside the uploads directory to avoid path traversal
        if (filePath.startsWith(uploadsDir)) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (err) {
        console.warn('Failed to delete attachment file from disk:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete attachment',
      error: error.message
    });
  }
};

// Get attachments for a proposal
exports.getAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const { module } = req.query;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    let attachments = proposal.attachments || [];
    if (module) {
      attachments = attachments.filter(att => (att.module || 'general') === module);
    }

    res.json({
      success: true,
      message: 'Attachments retrieved successfully',
      data: attachments
    });
  } catch (error) {
    console.error('Error retrieving attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attachments',
      error: error.message
    });
  }
};

// NEW ENDPOINT: Get Proposal totals by NewProposalWorkflow ID
// This is used by BudgetarySupportTable to fetch projectedSubsidy
exports.getProposalTotalsByWorkflowRef = async (req, res) => {
  try {
    const { workflowRefId } = req.params;
    
    // Find the Proposal that references this NewProposalWorkflow
    const proposal = await Proposal.findOne({
      $or: [
        { workflowRef: workflowRefId },
        { proposalId: workflowRefId }
      ]
    }).lean();
    
    if (!proposal) {
      console.log('[getProposalTotalsByWorkflowRef] Proposal not found for workflowRef:', workflowRefId);
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    console.log('[getProposalTotalsByWorkflowRef] Found Proposal for workflowRef:', workflowRefId);
    console.log('  projectedSubsidy:', proposal.projectedSubsidy);
    console.log('  projectedCorporateIncome:', proposal.projectedCorporateIncome);
    console.log('  proposedBudget:', proposal.proposedBudget);
    
    res.json({
      success: true,
      data: proposal
    });
  } catch (error) {
    console.error('[getProposalTotalsByWorkflowRef] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal totals',
      error: error.message
    });
  }
};