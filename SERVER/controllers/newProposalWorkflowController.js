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
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { verifyWorkflowDigitalSignature } = require('../utils/digitalSignatureService');
const { encryptESignatureDataUrl } = require('../utils/eSignatureCrypto');

const WORKFLOW_ACTIONS_REQUIRING_SIGNATURE = new Set([
  'submit-to-reviewer',
  'submit-to-approver',
  'forward-to-officer',
  'forward-to-manager',
  'finalize'
]);

const WORKFLOW_ACTIONS_REQUIRING_ESIGNATURE = new Set([
  'submit-to-reviewer',
  'submit-to-approver',
  'submit-to-analyst',
  'forward-to-officer',
  'forward-to-manager',
  'finalize'
]);

const isCryptographicSignatureEnforced = () =>
  String(process.env.PNPKI_ENFORCE_SIGNATURE || '').toLowerCase() === 'true';

const isWorkflowESignatureRequired = async () => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true })
      .select('eSignatureRequired')
      .lean();

    if (typeof activeSettings?.eSignatureRequired === 'boolean') {
      return activeSettings.eSignatureRequired;
    }

    return true;
  } catch (error) {
    console.warn('[WORKFLOW] Failed to resolve eSignatureRequired from active settings, defaulting to required:', error.message);
    return true;
  }
};

// Workflow status transitions based on the specification
const WORKFLOW_TRANSITIONS = {
  'BUDGET PREPARER': {
    'DRAFT': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
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
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST', // IMO path: skip Approver, go direct to Analyst
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST', // IMO path
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
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PLANNING_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PREPARER': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    }
  },
  'BUDGET OFFICER': {
    'FORWARDED_TO_BRD_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PREPARER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    }
  },
  'BUDGET MANAGER': {
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PREPARER': {
      'finalize': 'FINALIZED',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
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
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST', // IMO path (Super Admin)
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_REVIEWER': {
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST', // IMO path (Super Admin)
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
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PLANNING_ANALYST': {
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_PREPARER': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
      'submit-to-approver': 'FORWARDED_TO_APPROVER',
      'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'finalize': 'FINALIZED',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'FORWARDED_TO_BRD_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'RETURNED_TO_OFFICER': {
      'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    },
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-preparer': 'RETURNED_TO_PREPARER'
    }
  }
};

// Get user's primary budget role (silent version)
const getUserRole = (req) => {
  const userRoles = Array.isArray(req.user?.Roles) ? req.user.Roles : [];
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

  const normalizedRoles = userRoles
    .map((role) => String(role || '').trim())
    .filter(Boolean)
    .map((role) => role.replace(/\s+/g, '_').toUpperCase());

  const rolePriority = [
    'BUDGET_PREPARER',
    'BUDGET_REVIEWER',
    'BUDGET_APPROVER',
    'BUDGET_PLANNING_ANALYST',
    'BUDGET_OFFICER',
    'BUDGET_MANAGER',
    'OVERALL_BUDGET_APPROVER',
    'SUPER_ADMIN',
  ];

  for (const normalizedRole of rolePriority) {
    if (normalizedRoles.includes(normalizedRole) && roleMapping[normalizedRole]) {
      return roleMapping[normalizedRole];
    }
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
/**
 * Get Budget Planning Analysts eligible for a proposal based on region assignment.
 * Central Office proposals → analysts with "Central Office" in assignedRegions.
 * Other Region proposals → analysts whose assignedRegions includes the proposal's region (not Central Office).
 * @param {Object} proposal - Proposal with region populated or isCentralOffice
 * @returns {Promise<Array>} Array of { userId, userName } for eligible analysts
 */
const getAnalystsEligibleForProposal = async (proposal) => {
  try {
    let regionName = null;
    if (proposal.region) {
      if (typeof proposal.region === 'object' && proposal.region.Region) {
        regionName = proposal.region.Region;
      } else {
        const regionDoc = await Region.findById(proposal.region).select('Region').lean();
        if (regionDoc) regionName = regionDoc.Region;
      }
    }
    const isCentralOffice = proposal.isCentralOffice === true ||
      (typeof regionName === 'string' && String(regionName).trim().toLowerCase().includes('central office'));

    const analystRoles = ['budgetAnalyst', 'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'];
    const query = {
      $or: [
        { workflowRoles: { $in: analystRoles } },
        { userRole: { $in: analystRoles } },
        { userRoles: { $in: analystRoles } }
      ],
      isActive: true
    };

    const assignments = await HierarchicalUserAssignment.find(query)
      .select('userId userName assignedRegions isNIAWide')
      .lean();

    const eligible = [];
    for (const a of assignments) {
      const regions = (a.assignedRegions || []).map(r => String(r).trim());
      if (a.isNIAWide) {
        eligible.push({ userId: a.userId, userName: a.userName || a.userId });
        continue;
      }
      const hasCentralOffice = regions.some(r => r.toLowerCase().includes('central office'));
      const normalizedRegionName = regionName ? String(regionName).trim() : '';
      const matchesProposalRegion = normalizedRegionName && regions.some(r => r === normalizedRegionName || r.toLowerCase() === normalizedRegionName.toLowerCase());
      const hasRegionalAssignment = regions.some(r => !r.toLowerCase().includes('central office'));

      if (isCentralOffice && hasCentralOffice) {
        eligible.push({ userId: a.userId, userName: a.userName || a.userId });
      } else if (!isCentralOffice && (matchesProposalRegion || (hasRegionalAssignment && !hasCentralOffice))) {
        eligible.push({ userId: a.userId, userName: a.userName || a.userId });
      }
    }
    return eligible;
  } catch (err) {
    console.error('[getAnalystsEligibleForProposal] Error:', err.message);
    return [];
  }
};

const getNotificationRecipients = async (action, proposal, currentUserRole, currentUserId, options = {}) => {
  const { targetAnalystId } = options;
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
    // Include workflow role aliases (divisionReviewer=Reviewer, divisionApprover=Approver, officeApprover=Approver)
    const findUsersByWorkflowRole = async (roles, region = null) => {
      try {
        const roleList = [...new Set(roles)];
        const roleMatch = { 
          $or: [
            { workflowRoles: { $in: roleList } },
            { userRole: { $in: roleList } },
            { userRoles: { $in: roleList } }
          ]
        };
        let query = { ...roleMatch, isActive: true };
        if (region != null) {
          query = {
            $and: [
              roleMatch,
              { isActive: true },
              { $or: [{ regionId: region }, { regionId: null }, { regionId: { $exists: false } }, { isNIAWide: true }] }
            ]
          };
        }
        
        console.log('[getNotificationRecipients] Query:', JSON.stringify(query));
        let users = await HierarchicalUserAssignment.find(query).select('userId workflowRoles userRole userRoles regionId').lean();
        // Fallback: if no users found in HUA, try User.roles (ensures submission notifications work)
        if (!users || users.length === 0) {
          console.warn('[getNotificationRecipients] No HierarchicalUserAssignment found for roles, falling back to User.roles');
          try {
            const roleVariants = roleList.flatMap(r => [r, r.replace(/_/g, ' '), r.replace(/\s+/g, '_')]);
            const userDocs = await User.find({ roles: { $in: roleVariants } }).select('userId roles').lean();
            users = userDocs.map(u => ({ userId: u.userId || String(u._id), workflowRoles: u.roles || [], regionId: null }));
            console.log('[getNotificationRecipients] Fallback found', users.length, 'users via User.roles for roles', roleList);
          } catch (fallbackErr) {
            console.error('[getNotificationRecipients] Fallback User.roles error:', fallbackErr.message);
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
      // Notify Budget Reviewers in the same region (include workflow role aliases)
      let reviewers = await findUsersByWorkflowRole(['BUDGET_REVIEWER', 'BUDGET REVIEWER', 'divisionReviewer'], proposalRegionId);
      if (reviewers.length === 0 && proposalRegionId) {
        reviewers = await findUsersByWorkflowRole(['BUDGET_REVIEWER', 'BUDGET REVIEWER', 'divisionReviewer'], null);
        console.log('[getNotificationRecipients] submit-to-reviewer: fallback without region, found', reviewers.length);
      }
      const filteredReviewers = reviewers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredReviewers.length, 'reviewers for submit-to-reviewer');
      recipients.push(...filteredReviewers.map(u => String(u.userId)));
    } else if (action === 'submit-to-approver') {
      // Notify Budget Approvers (include workflow role aliases)
      let approvers = await findUsersByWorkflowRole(['BUDGET_APPROVER', 'BUDGET APPROVER', 'divisionApprover', 'officeApprover'], proposalRegionId);
      if (approvers.length === 0 && proposalRegionId) {
        approvers = await findUsersByWorkflowRole(['BUDGET_APPROVER', 'BUDGET APPROVER', 'divisionApprover', 'officeApprover'], null);
        console.log('[getNotificationRecipients] submit-to-approver: fallback without region, found', approvers.length);
      }
      const filteredApprovers = approvers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredApprovers.length, 'approvers for submit-to-approver');
      recipients.push(...filteredApprovers.map(u => String(u.userId)));
    } else if (action === 'submit-to-analyst') {
      // Route to analysts by proposal region: Central Office → CO analyst; Other Region → Regional analyst
      // Uses HierarchicalUserAssignment.assignedRegions - only analysts assigned to this proposal's region receive it
      if (targetAnalystId) {
        const eligible = await getAnalystsEligibleForProposal(proposal);
        const isEligible = eligible.some(a => String(a.userId) === String(targetAnalystId));
        if (isEligible && String(targetAnalystId) !== currentUserIdString) {
          recipients.push(String(targetAnalystId));
          console.log('[getNotificationRecipients] submit-to-analyst: using targetAnalystId', targetAnalystId);
        } else if (!isEligible) {
          console.warn('[getNotificationRecipients] targetAnalystId', targetAnalystId, 'not eligible for this proposal - routing by region fallback');
        }
      }
      if (recipients.length === 0) {
        const eligible = await getAnalystsEligibleForProposal(proposal);
        const filtered = eligible.filter(a => String(a.userId) !== currentUserIdString);
        recipients.push(...filtered.map(a => a.userId));
        console.log('[getNotificationRecipients] submit-to-analyst: routed', filtered.length, 'analysts by proposal region (Central Office vs Other Region)');
      }
    } else if (action === 'forward-to-officer') {
      // Notify Budget Officers (officeFinalVerifier, BUDGET_OFFICER)
      let officers = await findUsersByWorkflowRole(['officeFinalVerifier', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'budgetOfficer'], proposalRegionId);
      if (officers.length === 0 && proposalRegionId) {
        officers = await findUsersByWorkflowRole(['officeFinalVerifier', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'budgetOfficer'], null);
        console.log('[getNotificationRecipients] forward-to-officer: fallback without region, found', officers.length);
      }
      const filteredOfficers = officers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredOfficers.length, 'officers for forward-to-officer');
      recipients.push(...filteredOfficers.map(u => String(u.userId)));
    } else if (action === 'forward-to-manager') {
      // Notify Budget Managers (regionFinalVerifier role)
      const managers = await findUsersByWorkflowRole(['regionFinalVerifier', 'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN', 'overallBudgetApprover']);
      const filteredManagers = managers.filter(u => u.userId !== currentUserIdString);
      console.log('[getNotificationRecipients] Found', filteredManagers.length, 'managers for forward-to-manager');
      recipients.push(...filteredManagers.map(u => String(u.userId)));
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
        const reviewers = await findUsersByWorkflowRole(['BUDGET_REVIEWER', 'BUDGET REVIEWER', 'divisionReviewer'], proposalRegionId);
        const filteredReviewers = reviewers.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredReviewers.length, 'reviewers for return-to-reviewer');
        recipients.push(...filteredReviewers.map(u => u.userId));
      } else if (action === 'return-to-approver') {
        // Notify Budget Approvers
        const approvers = await findUsersByWorkflowRole(['BUDGET_APPROVER', 'BUDGET APPROVER', 'divisionApprover', 'officeApprover'], proposalRegionId);
        const filteredApprovers = approvers.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredApprovers.length, 'approvers for return-to-approver');
        recipients.push(...filteredApprovers.map(u => u.userId));
      } else if (action === 'return-to-analyst') {
        // Notify Budget Planning Analysts (budgetAnalyst role)
        const analysts = await findUsersByWorkflowRole(['budgetAnalyst', 'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGET_ANALYST'], proposalRegionId);
        const filteredAnalysts = analysts.filter(u => u.userId !== currentUserIdString);
        console.log('[getNotificationRecipients] Found', filteredAnalysts.length, 'analysts for return-to-analyst');
        recipients.push(...filteredAnalysts.map(u => u.userId));
      } else if (action === 'return-to-officer') {
        // Notify Budget Officers
        const officers = await findUsersByWorkflowRole(['officeFinalVerifier', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'budgetOfficer'], proposalRegionId);
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
const { sendWorkflowEmail } = require('./emailNotificationController');

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

    const notificationData = recipientUserIds.map(uid => {
      const recipientUserId = String(uid);
      return {
        recipientUserId,
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
          comment: comment || '',
          uniqueKey
        },
        status: 'UNREAD',
        createdAt: new Date()
      };
    });

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
 * Simple helper endpoint: check if there are any FINALIZED proposals
 * Optionally filtered by fiscalYear. Used by frontend to decide when to
 * show NEP Ceiling Management menu for BRD-level users.
 */
exports.hasFinalizedProposals = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    const query = { status: 'FINALIZED' };
    if (fiscalYear !== undefined && fiscalYear !== null && fiscalYear !== '') {
      const fyNum = Number(fiscalYear);
      if (!Number.isNaN(fyNum)) {
        query.fiscalYear = fyNum;
      }
    }
    const count = await NewProposalWorkflow.countDocuments(query);
    return res.json({
      success: true,
      hasFinalized: count > 0,
      count,
    });
  } catch (err) {
    console.error('[hasFinalizedProposals] Error:', err.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to check finalized proposals',
      error: err.message,
    });
  }
};

const normalizePreparerAccessStatus = (status) => {
  const raw = String(status || '').trim().toUpperCase();
  const statusMap = {
    'DRAFT': 'DRAFT',
    'INITIAL': 'INITIAL',
    'RETURNED': 'RETURNED',
    'RETURNED TO PREPARER': 'RETURNED_TO_PREPARER',
    'RETURNED_TO_PREPARER': 'RETURNED_TO_PREPARER',
  };

  return statusMap[raw] || raw.replace(/\s+/g, '_');
};

const isPreparerEditableStatus = (status) => {
  const normalizedStatus = normalizePreparerAccessStatus(status);
  // Treat empty/unknown status as non-blocking (no actionable in-process state)
  if (!normalizedStatus) return true;

  // Terminal completed states — proposal is done, preparer is free to create a new one
  if (
    normalizedStatus === 'FINALIZED' ||
    normalizedStatus === 'APPROVED' ||
    normalizedStatus === 'COMPLETED' ||
    normalizedStatus === 'REJECTED' ||
    normalizedStatus === 'CANCELLED' ||
    normalizedStatus === 'CLOSED'
  ) {
    return true;
  }

  if (
    normalizedStatus === 'DRAFT' ||
    normalizedStatus === 'INITIAL' ||
    normalizedStatus === 'RETURNED' ||
    normalizedStatus === 'RETURNED_TO_PREPARER'
  ) {
    return true;
  }

  return normalizedStatus.includes('PREPARER');
};

exports.getPreparerCreateProposalAccess = async (req, res) => {
  try {
    const roleSet = new Set(
      (Array.isArray(req.user?.Roles) ? req.user.Roles : [])
        .map((role) => String(role || '').toUpperCase().replace(/\s+/g, '_'))
    );
    const isSuperAdmin = roleSet.has('SUPER_ADMIN') || roleSet.has('SUPERADMIN');
    const isBudgetPreparer = roleSet.has('BUDGET_PREPARER');

    // Strict preparer status lock should not affect SUPER ADMIN or non-preparer roles.
    if (isSuperAdmin || !isBudgetPreparer) {
      return res.json({
        success: true,
        canAccessCreateProposal: true,
        hasInProcessProposal: false,
        bypassed: true,
      });
    }

    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : '';

    const usernameField = Array.isArray(req.user?.Username)
      ? req.user.Username[0]
      : req.user?.Username;

    const displayName = [
      req.user?.name,
      req.user?.UserName,
      `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(),
    ].find((v) => v && String(v).trim().length > 0) || '';

    const identityCandidates = [userIdString, usernameField]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    // Constrain lock checks to the user's current assignment scope so in-process
    // proposals from a different division/office do not block proposal creation.
    const orgScopeFilter = {};
    if (userIdString) {
      try {
        const assignment = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName')
          .populate('regionId', '_id')
          .lean();

        if (assignment) {
          const assignmentLevelRaw = String(assignment.assignmentLevel || '').toUpperCase();
          const assignmentLevel = ({
            DIVISION_LEVEL: 'DIVISION',
            RESPONSIBILITY_CENTER: 'DIVISION',
            DEPARTMENT_LEVEL: 'DEPARTMENT',
            DEPARTMENT_REGIONAL_LEVEL: 'DEPARTMENT',
            OFFICE_LEVEL: 'DEPARTMENT',
            REGION_LEVEL: 'REGION',
          })[assignmentLevelRaw] || assignmentLevelRaw;

          const assignedDivision = String(assignment.divisionName || '').trim();
          const assignedDepartment = String(
            assignment.departmentId?.Department ||
            assignment.departmentId?.departmentName ||
            assignment.departmentId?.DepartmentName ||
            ''
          ).trim();
          const assignedRegionId = assignment.regionId?._id || assignment.regionId || null;

          if (assignmentLevel === 'DIVISION' && assignedDivision) {
            orgScopeFilter.division = assignedDivision;
          } else if ((assignmentLevel === 'DEPARTMENT' || assignmentLevel === 'OFFICE') && assignedDepartment) {
            orgScopeFilter.department = assignedDepartment;
          } else if (assignmentLevel === 'REGION' && assignedRegionId) {
            orgScopeFilter.region = assignedRegionId;
          }
        }
      } catch (scopeError) {
        console.warn('[getPreparerCreateProposalAccess] Failed to resolve assignment scope:', scopeError.message);
      }
    }

    if (identityCandidates.length === 0) {
      return res.json({
        success: true,
        canAccessCreateProposal: false,
        hasInProcessProposal: true,
      });
    }

    let proposals = await NewProposalWorkflow.find(
      {
        $or: [
          { createdBy: { $in: identityCandidates } },
          { createdByName: { $in: identityCandidates } },
        ],
        ...orgScopeFilter,
      },
      'status createdBy createdByName division department region'
    ).lean();

    // Legacy fallback: only if strict identifiers have no hit, try displayName.
    if ((!proposals || proposals.length === 0) && displayName) {
      proposals = await NewProposalWorkflow.find(
        { createdByName: displayName, ...orgScopeFilter },
        'status createdBy createdByName division department region'
      ).lean();
    }

    const hasInProcessProposal = (proposals || []).some(
      (proposal) => !isPreparerEditableStatus(proposal?.status)
    );

    return res.json({
      success: true,
      canAccessCreateProposal: !hasInProcessProposal,
      hasInProcessProposal,
      proposalCount: proposals.length,
    });
  } catch (err) {
    console.error('[getPreparerCreateProposalAccess] Error:', err.message || err);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate preparer create access',
      error: err.message,
    });
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

const normalizeComparableText = (value) => String(value || '').trim().toLowerCase();

const extractRegionName = (region) => {
  if (!region) return '';
  if (typeof region === 'string') return region;
  return region.Region || region.regionName || region.RegionName || region.name || '';
};

const buildIdentityCandidates = (userId, userName) => {
  const values = [userId, userName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(values));
};

const getInsertedCountFromBulkError = (error) => {
  if (Array.isArray(error?.insertedDocs)) return error.insertedDocs.length;
  if (typeof error?.result?.result?.nInserted === 'number') return error.result.result.nInserted;
  if (typeof error?.result?.nInserted === 'number') return error.result.nInserted;
  return 0;
};

const insertManyWithCount = async (Model, docs) => {
  if (!docs.length) return 0;

  try {
    const insertedDocs = await Model.insertMany(docs, { ordered: false });
    return insertedDocs.length;
  } catch (error) {
    if (error?.name === 'BulkWriteError' || error?.name === 'MongoBulkWriteError' || Array.isArray(error?.writeErrors)) {
      const insertedCount = getInsertedCountFromBulkError(error);
      console.warn(`[carryForward] Partial insert for ${Model.modelName}:`, error.message);
      return insertedCount;
    }
    throw error;
  }
};

const pickBestCarryForwardCandidate = (candidates = []) => {
  if (!candidates.length) return null;

  const statusPriority = {
    FINALIZED: 5,
    FORWARDED_TO_BRD_MANAGER: 4,
    FORWARDED_TO_BRD_OFFICER: 4,
    FORWARDED_TO_BRD_ANALYST: 4,
    FORWARDED_TO_APPROVER: 4,
    FORWARDED_TO_REVIEWER: 4,
    RETURNED_TO_PREPARER: 3,
    RETURNED_TO_REVIEWER: 3,
    RETURNED_TO_APPROVER: 3,
    RETURNED_TO_PLANNING_ANALYST: 3,
    RETURNED_TO_OFFICER: 3,
    DRAFT: 1,
    Draft: 1,
    Finalized: 5
  };

  return [...candidates].sort((left, right) => {
    const leftCoverage = Number(left?.sourceCounts?.populatedModules || 0);
    const rightCoverage = Number(right?.sourceCounts?.populatedModules || 0);
    const coverageDiff = rightCoverage - leftCoverage;
    if (coverageDiff !== 0) return coverageDiff;

    const leftTotalRows = Number(left?.sourceCounts?.totalRows || 0);
    const rightTotalRows = Number(right?.sourceCounts?.totalRows || 0);
    const totalRowsDiff = rightTotalRows - leftTotalRows;
    if (totalRowsDiff !== 0) return totalRowsDiff;

    const fiscalDiff = Number(right?.fiscalYear || 0) - Number(left?.fiscalYear || 0);
    if (fiscalDiff !== 0) return fiscalDiff;

    const statusDiff = (statusPriority[right?.status] || 0) - (statusPriority[left?.status] || 0);
    if (statusDiff !== 0) return statusDiff;

    return new Date(right?.updatedAt || 0).getTime() - new Date(left?.updatedAt || 0).getTime();
  })[0];
};

const getCarryForwardSourceCounts = async ({ sourceWorkflowId, sourceLegacyId }) => {
  const sourceQuery = buildCarryForwardSourceQuery({ sourceWorkflowId, sourceLegacyId });
  if (!sourceQuery) {
    return {
      income: 0,
      personnel: 0,
      mooe: 0,
      capitalOutlay: 0,
      populatedModules: 0,
      totalRows: 0
    };
  }

  const [income, personnel, mooe, capitalOutlay] = await Promise.all([
    Income.countDocuments(sourceQuery),
    PersonnelServices.countDocuments(sourceQuery),
    MooeProposal.countDocuments(sourceQuery),
    CapitalOutlay.countDocuments(sourceQuery)
  ]);

  const counts = { income, personnel, mooe, capitalOutlay };
  const populatedModules = Object.values(counts).filter((count) => Number(count) > 0).length;
  const totalRows = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);

  return {
    ...counts,
    populatedModules,
    totalRows
  };
};

const matchesCarryForwardScope = ({ candidate, regionName, department, division }) => {
  const candidateRegion = normalizeComparableText(extractRegionName(candidate?.region));
  const targetRegion = normalizeComparableText(regionName);
  const candidateDepartment = normalizeComparableText(candidate?.department);
  const targetDepartment = normalizeComparableText(department);
  const candidateDivision = normalizeComparableText(candidate?.division);
  const targetDivision = normalizeComparableText(division);

  if (targetRegion && candidateRegion && candidateRegion !== targetRegion) return false;
  if (targetDivision && candidateDivision && candidateDivision !== targetDivision) return false;
  if (!targetDivision && targetDepartment && candidateDepartment && candidateDepartment !== targetDepartment) return false;

  return true;
};

const findCarryForwardSource = async ({ fiscalYear, userId, userName, regionId, regionName, department, division }) => {
  const identityCandidates = buildIdentityCandidates(userId, userName);
  const normalizedRegionName = normalizeComparableText(regionName);

  const workflowQuery = {
    modelType: 'Initial',
    fiscalYear: { $lt: Number(fiscalYear) },
    $or: [
      { createdBy: { $in: identityCandidates } },
      { createdByName: { $in: identityCandidates } }
    ]
  };

  if (regionId) {
    workflowQuery.region = regionId;
  }

  const workflowCandidates = await NewProposalWorkflow.find(workflowQuery)
    .sort({ fiscalYear: -1, updatedAt: -1 })
    .limit(12)
    .populate('region', 'Region regionName RegionName name')
    .lean();

  const scopedWorkflowCandidates = workflowCandidates.filter((candidate) =>
    matchesCarryForwardScope({ candidate, regionName: normalizedRegionName, department, division })
  );

  const enrichedWorkflowCandidates = await Promise.all(
    scopedWorkflowCandidates.map(async (candidate) => {
      const linkedLegacy = await Proposal.findOne({ workflowRef: candidate._id })
        .select('_id')
        .lean();

      return {
        ...candidate,
        sourceWorkflowId: candidate._id,
        sourceLegacyId: linkedLegacy?._id || null,
        sourceCounts: await getCarryForwardSourceCounts({
          sourceWorkflowId: candidate._id,
          sourceLegacyId: linkedLegacy?._id || null
        })
      };
    })
  );

  const matchedWorkflow = pickBestCarryForwardCandidate(enrichedWorkflowCandidates);

  if (matchedWorkflow) {
    return {
      sourceWorkflowId: matchedWorkflow.sourceWorkflowId || matchedWorkflow._id,
      sourceLegacyId: matchedWorkflow.sourceLegacyId || null,
      sourceFiscalYear: Number(matchedWorkflow.fiscalYear),
      sourceStatus: matchedWorkflow.status,
      sourceRegion: extractRegionName(matchedWorkflow.region),
      sourceDepartment: matchedWorkflow.department || '',
      sourceDivision: matchedWorkflow.division || '',
      sourceCounts: matchedWorkflow.sourceCounts
    };
  }

  const legacyQuery = {
    budgetType: 'Initial',
    fiscalYear: { $lt: String(fiscalYear) },
    $or: [
      { createdByUserId: String(userId || '') },
      { createdBy: { $in: identityCandidates } },
      { createdByName: { $in: identityCandidates } },
      { processBy: { $in: identityCandidates } }
    ]
  };

  if (regionName) {
    legacyQuery.region = regionName;
  }

  const legacyCandidates = await Proposal.find(legacyQuery)
    .select('_id fiscalYear status workflowRef updatedAt region department division')
    .sort({ fiscalYear: -1, updatedAt: -1 })
    .limit(12)
    .lean();

  const scopedLegacyCandidates = legacyCandidates.filter((candidate) =>
    matchesCarryForwardScope({ candidate, regionName: normalizedRegionName, department, division })
  );

  const enrichedLegacyCandidates = await Promise.all(
    scopedLegacyCandidates.map(async (candidate) => ({
      ...candidate,
      sourceWorkflowId: candidate.workflowRef || null,
      sourceLegacyId: candidate._id,
      sourceCounts: await getCarryForwardSourceCounts({
        sourceWorkflowId: candidate.workflowRef || null,
        sourceLegacyId: candidate._id
      })
    }))
  );

  const matchedLegacy = pickBestCarryForwardCandidate(enrichedLegacyCandidates);

  if (!matchedLegacy) return null;

  return {
    sourceWorkflowId: matchedLegacy.sourceWorkflowId || matchedLegacy.workflowRef || null,
    sourceLegacyId: matchedLegacy.sourceLegacyId || matchedLegacy._id,
    sourceFiscalYear: Number(matchedLegacy.fiscalYear),
    sourceStatus: matchedLegacy.status,
    sourceRegion: matchedLegacy.region || '',
    sourceDepartment: matchedLegacy.department || '',
    sourceDivision: matchedLegacy.division || '',
    sourceCounts: matchedLegacy.sourceCounts
  };
};

const buildCarryForwardSourceQuery = ({ sourceWorkflowId, sourceLegacyId }) => {
  const orConditions = [];

  if (sourceWorkflowId) {
    orConditions.push({ workflowRef: sourceWorkflowId });
  }

  if (sourceLegacyId) {
    orConditions.push({ proposalId: sourceLegacyId });
  }

  if (orConditions.length === 0) return null;
  if (orConditions.length === 1) return orConditions[0];
  return { $or: orConditions };
};

const resolveCarryForwardOrgValue = (targetValue, sourceValue) => {
  const normalizedTargetValue = typeof targetValue === 'string' ? targetValue.trim() : targetValue;
  if (normalizedTargetValue) return normalizedTargetValue;

  const normalizedSourceValue = typeof sourceValue === 'string' ? sourceValue.trim() : sourceValue;
  return normalizedSourceValue || '';
};

const cloneIncomeEntries = async ({ sourceQuery, target }) => {
  const rows = await Income.find(sourceQuery).lean();
  if (!rows.length) return 0;

  const docs = rows.map((row) => ({
    particulars: row.particulars,
    cost: Number(row.cost ?? row.amount ?? 0),
    incomecategory: row.incomecategory,
    subcategory: row.subcategory,
    category: row.category,
    amount: Number(row.amount || 0),
    fiscalYear: target.fiscalYearString,
    budgetType: target.budgetType,
    region: resolveCarryForwardOrgValue(target.regionName, row.region),
    processBy: target.userName,
    processDate: target.now,
    status: 'Draft',
    workflowLevel: 'BUDGET PREPARER',
    department: resolveCarryForwardOrgValue(target.department, row.department),
    division: resolveCarryForwardOrgValue(target.division, row.division),
    originalLevel: row.originalLevel || null,
    consolidatedFrom: row.consolidatedFrom || null,
    proposalId: target.legacyProposalId,
    workflowRef: target.workflowId,
    createdBy: target.userId
  }));

  return insertManyWithCount(Income, docs);
};

const clonePersonnelEntries = async ({ sourceQuery, target }) => {
  const rows = await PersonnelServices.find(sourceQuery).lean();
  if (!rows.length) return 0;

  const docs = rows.map((row) => {
    const cloned = { ...row };
    delete cloned._id;
    delete cloned.createdAt;
    delete cloned.updatedAt;
    delete cloned.__v;

    return {
      ...cloned,
      region: resolveCarryForwardOrgValue(target.regionName, row.region),
      department: resolveCarryForwardOrgValue(target.department, row.department),
      division: resolveCarryForwardOrgValue(target.division, row.division),
      fiscalYear: target.fiscalYearString,
      fiscal_year: target.fiscalYearNumber,
      budgetType: target.budgetType,
      proposalId: target.legacyProposalId,
      workflowRef: target.workflowId,
      processBy: target.userName,
      processDate: target.now,
      username_process: target.userName,
      date_process: target.now,
      status: 'Draft',
      workflowLevel: 'BUDGET PREPARER',
      createdBy: target.userId
    };
  });

  return insertManyWithCount(PersonnelServices, docs);
};

const cloneMooeEntries = async ({ sourceQuery, target }) => {
  const rows = await MooeProposal.find(sourceQuery).lean();
  if (!rows.length) return 0;

  const docs = rows.map((row) => ({
    uacsCode: row.uacsCode,
    accountingTitle: row.accountingTitle,
    sublineItem: row.sublineItem,
    income: Number(row.income || 0),
    subsidy: Number(row.subsidy || 0),
    amount: Number(row.amount || 0),
    nis: Number(row.nis || 0),
    cis: Number(row.cis || 0),
    processBy: target.userName,
    processDate: target.now,
    region: resolveCarryForwardOrgValue(target.regionName, row.region),
    department: resolveCarryForwardOrgValue(target.department, row.department),
    division: resolveCarryForwardOrgValue(target.division, row.division),
    status: 'Draft',
    workflowLevel: 'BUDGET PREPARER',
    fiscalYear: target.fiscalYearString,
    proposalId: target.legacyProposalId,
    workflowRef: target.workflowId,
    budgetType: target.budgetType,
    originalLevel: row.originalLevel || null,
    createdBy: target.userId
  }));

  return insertManyWithCount(MooeProposal, docs);
};

const cloneCapitalOutlayEntries = async ({ sourceQuery, target }) => {
  const rows = await CapitalOutlay.find(sourceQuery).lean();
  if (!rows.length) return 0;

  const docs = rows.map((row) => ({
    particulars: row.particulars,
    cost: Number(row.cost || 0),
    income: Number(row.income || 0),
    subsidy: Number(row.subsidy || 0),
    category: row.category,
    date_process: target.now,
    department: resolveCarryForwardOrgValue(target.department, row.department),
    division: resolveCarryForwardOrgValue(target.division, row.division),
    region: resolveCarryForwardOrgValue(target.regionName, row.region),
    fiscal_year: target.fiscalYearNumber,
    budgetType: target.budgetType,
    username_process: target.userName,
    status: 'Draft',
    workflowLevel: 'BUDGET PREPARER',
    proposalId: target.legacyProposalId,
    workflowRef: target.workflowId,
    processBy: target.userName,
    processDate: target.now,
    fiscalYear: target.fiscalYearString,
    sublineItem: row.sublineItem,
    accountingTitle: row.accountingTitle,
    uacsCode: row.uacsCode,
    createdBy: target.userId
  }));

  return insertManyWithCount(CapitalOutlay, docs);
};

const carryForwardInitialProposalData = async ({ fiscalYear, userId, userName, regionId, regionName, department, division, workflowId, legacyProposalId, budgetType }) => {
  const source = await findCarryForwardSource({
    fiscalYear,
    userId,
    userName,
    regionId,
    regionName,
    department,
    division
  });

  if (!source) {
    return {
      carriedForward: false,
      source: null,
      counts: { income: 0, personnel: 0, mooe: 0, capitalOutlay: 0 }
    };
  }

  const sourceQuery = buildCarryForwardSourceQuery(source);
  if (!sourceQuery) {
    return {
      carriedForward: false,
      source,
      counts: { income: 0, personnel: 0, mooe: 0, capitalOutlay: 0 }
    };
  }

  const targetContext = {
    fiscalYearNumber: Number(fiscalYear),
    fiscalYearString: String(fiscalYear),
    budgetType,
    regionName,
    department,
    division,
    workflowId,
    legacyProposalId,
    userId: String(userId),
    userName,
    now: new Date()
  };

  const counts = {
    income: await cloneIncomeEntries({ sourceQuery, target: targetContext }),
    personnel: await clonePersonnelEntries({ sourceQuery, target: targetContext }),
    mooe: await cloneMooeEntries({ sourceQuery, target: targetContext }),
    capitalOutlay: await cloneCapitalOutlayEntries({ sourceQuery, target: targetContext })
  };

  return {
    carriedForward: Object.values(counts).some((count) => count > 0),
    source,
    counts
  };
};

const formatCarryForwardMessage = (result) => {
  if (!result?.source) {
    return 'No previous Initial proposal data was found to carry forward.';
  }

  const parts = [];
  if (result.counts.income) parts.push(`${result.counts.income} Income`);
  if (result.counts.personnel) parts.push(`${result.counts.personnel} Personnel Services`);
  if (result.counts.mooe) parts.push(`${result.counts.mooe} MOOE`);
  if (result.counts.capitalOutlay) parts.push(`${result.counts.capitalOutlay} Capital Outlay`);

  if (!parts.length) {
    return `Matched FY ${result.source.sourceFiscalYear} as the previous Initial proposal, but there were no linked line items to carry forward.`;
  }

  return `Carried forward ${parts.join(', ')} from FY ${result.source.sourceFiscalYear}.`;
};

/**
 * Synchronize unlinked records (bulk uploaded by Super Admin) to a newly created proposal.
 * Finds records with matching organizational context that don't have a proposalId yet.
 */
const syncUnlinkedRecordsToProposal = async ({ 
  workflowId, 
  legacyProposalId, 
  fiscalYear, 
  budgetType, 
  regionName, 
  department, 
  division,
  userName 
}) => {
  try {
    const searchRegions = [regionName];
    if (regionName === 'Region 10') searchRegions.push('Region X');
    if (regionName === 'Region X') searchRegions.push('Region 10');

    // Build organizational match filter similar to getByParams
    const orgClauses = [];
    if (division) {
      orgClauses.push({ division: division });
      orgClauses.push({ department: division });
    }
    if (department) {
      orgClauses.push({ department: department });
      orgClauses.push({ division: department });
    }
    // Also include records that have NO division/department (Central/Region level)
    orgClauses.push({ $and: [{ division: { $in: [null, ""] } }, { department: { $in: [null, ""] } }] });

    const unlinkedQuery = {
      $and: [
        { $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
        { $or: [{ proposalId: null }, { proposalId: { $exists: false } }] },
        { $or: orgClauses },
        { region: { $in: searchRegions } },
        { fiscalYear: String(fiscalYear) },
        { budgetType: budgetType }
      ]
    };

    const updateFields = {
      workflowRef: workflowId,
      proposalId: legacyProposalId,
      processBy: userName,
      processDate: new Date()
    };

    // Special handling for PersonnelServices which uses both fiscalYear and fiscal_year
    const psUpdateFields = {
      ...updateFields,
      fiscal_year: Number(fiscalYear)
    };

    const [incomeResult, personnelResult, mooeResult, capitalResult] = await Promise.all([
      Income.updateMany(unlinkedQuery, { $set: updateFields }),
      PersonnelServices.updateMany(unlinkedQuery, { $set: psUpdateFields }),
      MooeProposal.updateMany(unlinkedQuery, { $set: updateFields }),
      CapitalOutlay.updateMany(unlinkedQuery, { $set: updateFields })
    ]);

    const totalModified = (incomeResult.modifiedCount || 0) + 
                          (personnelResult.modifiedCount || 0) + 
                          (mooeResult.modifiedCount || 0) + 
                          (capitalResult.modifiedCount || 0);

    return {
      income: incomeResult.modifiedCount || 0,
      personnel: personnelResult.modifiedCount || 0,
      mooe: mooeResult.modifiedCount || 0,
      capitalOutlay: capitalResult.modifiedCount || 0,
      total: totalModified
    };
  } catch (err) {
    console.error('[syncUnlinked] Error syncing records to proposal:', err.message);
    return { income: 0, personnel: 0, mooe: 0, capitalOutlay: 0, total: 0 };
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
      division,
      carryForwardPreviousYear = true
    } = req.body;

    // Robust user identifiers (avoid undefined createdBy)
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const usernameField = Array.isArray(req.user?.Username) ? req.user.Username[0] : req.user?.Username;
    const nameFallback = [
      req.user?.userName,
      req.user?.particular,
      req.user?.name,
      req.user?.UserName,
      `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(),
      usernameField,
      req.user?.email,
      userId ? String(userId) : null,
    ].find(v => v && String(v).trim().length > 0);
    const userName = String(nameFallback || '').trim() || (userId ? String(userId) : 'SYSTEM_USER');

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

    // ============ PREVENT DUPLICATE PROPOSAL CREATION ============
    const duplicateQuery = {
      $and: [
        { fiscalYear: parseInt(fiscalYear, 10) },
        { modelType: normalizedModelType }
      ]
    };

    if (finalRegionId) {
      duplicateQuery.$and.push({ region: finalRegionId });
    }

    if (derivedDepartment) {
      duplicateQuery.$and.push({ department: derivedDepartment });
    } else {
      duplicateQuery.$and.push({ 
        $or: [{ department: null }, { department: "" }, { department: { $exists: false } }] 
      });
    }

    if (derivedDivision) {
      duplicateQuery.$and.push({ division: derivedDivision });
    } else {
      duplicateQuery.$and.push({ 
        $or: [{ division: null }, { division: "" }, { division: { $exists: false } }] 
      });
    }

    const existingProposal = await NewProposalWorkflow.findOne(duplicateQuery).lean();
    if (existingProposal) {
      return res.status(409).json({
        success: false,
        message: 'A budget proposal already exists for this organizational scope (Region/Department/Division) and Fiscal Year. Please refresh the page to view and co-edit the existing proposal.'
      });
    }
    // ==============================================================

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

    // ✅ SYNC UNLINKED RECORDS: Automatically adopt records bulk-uploaded by Super Admin
    // matching this proposal's organizational context (Region/Dept/Div).
    let syncResult = { total: 0 };
    try {
      syncResult = await syncUnlinkedRecordsToProposal({
        workflowId: proposal._id,
        legacyProposalId: legacyProposal._id,
        fiscalYear: fiscalYear,
        budgetType: normalizedModelType,
        regionName: legacyProposalData.region,
        department: derivedDepartment || '',
        division: derivedDivision || '',
        userName: userName
      });

      if (syncResult.total > 0) {
        proposal.workflowHistory = proposal.workflowHistory || [];
        proposal.workflowHistory.push({
          action: 'SYNCED_UNLINKED_DATA',
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          performedBy: String(userId),
          performedByName: userName,
          comment: `Automatically synced ${syncResult.total} unlinked records (${syncResult.income} Income, ${syncResult.personnel} PS, ${syncResult.mooe} MOOE, ${syncResult.capitalOutlay} CO)`,
          timestamp: new Date()
        });
        await proposal.save();
      }
    } catch (syncErr) {
      console.warn('[createProposal] Failed to sync unlinked records:', syncErr.message);
    }

    let carryForwardResult = {
      carriedForward: false,
      source: null,
      counts: { income: 0, personnel: 0, mooe: 0, capitalOutlay: 0 }
    };

    const shouldCarryForward = normalizedModelType === 'Initial' && carryForwardPreviousYear !== false;

    if (shouldCarryForward) {
      try {
        carryForwardResult = await carryForwardInitialProposalData({
          fiscalYear,
          userId,
          userName,
          regionId: finalRegionId,
          regionName: legacyProposalData.region,
          department: derivedDepartment || '',
          division: derivedDivision || '',
          workflowId: proposal._id,
          legacyProposalId: legacyProposal._id,
          budgetType: normalizedModelType
        });

        if (carryForwardResult.carriedForward) {
          proposal.workflowHistory = proposal.workflowHistory || [];
          proposal.workflowHistory.push({
            action: 'CREATED',
            fromStatus: 'DRAFT',
            toStatus: 'DRAFT',
            performedBy: String(userId),
            performedByName: userName,
            comment: formatCarryForwardMessage(carryForwardResult),
            timestamp: new Date()
          });
          await proposal.save();
        }
      } catch (carryForwardError) {
        console.error('[carryForward] Failed to clone previous fiscal year data:', carryForwardError);
        carryForwardResult = {
          carriedForward: false,
          source: null,
          counts: { income: 0, personnel: 0, mooe: 0, capitalOutlay: 0 },
          warning: carryForwardError.message
        };
      }
    }

    // CRITICAL FIX: Recalculate and sync totals after creating proposal
    // This ensures NewProposalWorkflow has correct initial totals (0 if no data yet)
    try {
      const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
      await recalculateAndSaveProposalTotals({ proposalId: legacyProposal._id });
    } catch (err) {
      console.error('Warning: Failed to recalculate initial proposal totals:', err.message);
      // Continue - don't block proposal creation if recalculation fails
    }

    const messageParts = ['Proposal created successfully'];
    if (shouldCarryForward) {
      messageParts.push(formatCarryForwardMessage(carryForwardResult));
      if (carryForwardResult.warning) {
        messageParts.push('Previous-year carry-forward encountered an issue and may be incomplete.');
      }
    }

    if (syncResult.total > 0) {
      messageParts.push(`Automatically synced ${syncResult.total} unlinked records`);
    }

    res.status(201).json({
      success: true,
      message: `${messageParts.join('. ')}.`,
      data: proposal,
      carryForward: carryForwardResult,
      syncResult: syncResult
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

/**
 * Helper to check if a user has organizational access to a specific proposal.
 * Ensures users can only modify/view proposals within their assigned region/dept/division.
 * @param {Object} proposal - The proposal document
 * @param {string} userId - Current user ID
 * @param {string} userRole - Current user's primary role
 * @returns {Promise<boolean>}
 */
const checkProposalOrgAccess = async (proposal, userId, userRole) => {
  if (userRole === 'SUPER ADMIN') return true;
  
  // Ownership always grants access
  if (String(proposal.createdBy) === String(userId)) return true;

  try {
    const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId), isActive: true })
      .populate('departmentId')
      .populate('regionId')
      .lean();

    if (!assignment) {
      // Fallback: If no hierarchical assignment, check if proposal region matches user's region (legacy)
      // This is a safety fallback and might be less restrictive than intended.
      return true; 
    }

    const userDivision = assignment.divisionName || null;
    let userDepartment = null;
    let userRegion = null;

    if (assignment.departmentId) {
      userDepartment = assignment.departmentId.Department || assignment.departmentId.departmentName || null;
    }
    if (assignment.regionId) {
      userRegion = assignment.regionId.Region || assignment.regionId.regionName || null;
    }

    // Restrictive check (Intersection)
    if (userRegion && proposal.regionName !== userRegion && proposal.region !== userRegion) {
      // Handle cases where region might be stored as name string or object
      const propRegion = proposal.region?.Region || proposal.region?.regionName || proposal.region?.RegionName || proposal.regionName || proposal.region;
      if (propRegion && String(propRegion) !== userRegion) {
        // Additional fallback: sometimes userRegion is stored with different casing
        if (String(propRegion).toUpperCase() !== String(userRegion).toUpperCase()) {
          return false;
        }
      }
    }
    
    if (userDepartment && proposal.department !== userDepartment) return false;
    if (userDivision && proposal.division !== userDivision) return false;

    return true;
  } catch (err) {
    console.error('[checkProposalOrgAccess] Error:', err.message);
    return false;
  }
};

// Get proposals based on user role and filters
exports.getProposals = async (req, res) => {
  try {
    const userRole = getUserRole(req);
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const usernameField = Array.isArray(req.user?.Username) ? req.user.Username[0] : req.user?.Username;
    const userName = [req.user?.name, req.user?.UserName, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(), req.user?.email].find(v => v && v.length > 0) || 'UNKNOWN_USER';
    const { status, modelType, fiscalYear, page = 1, limit = 10, view } = req.query;
    // Normalize userId to string to avoid mismatches
    const userIdString = userId ? String(userId) : undefined;
    const strictIdentityCandidates = [userIdString, usernameField]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    
    // Resolve Organizational Scope
    let orgScope = {};
    let userAssignment = null;
    try {
      userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
        .populate('departmentId')
        .populate('regionId')
        .lean();

      if (userAssignment) {
        if (userAssignment.divisionName) orgScope.division = userAssignment.divisionName.trim();
        if (userAssignment.departmentId) {
          orgScope.department = (userAssignment.departmentId.Department || userAssignment.departmentId.departmentName || '').trim();
        }
        if (userAssignment.regionId) {
          orgScope.region = (userAssignment.regionId.Region || userAssignment.regionId.regionName || '').trim();
        }
      }
    } catch (err) {
      console.warn('[getProposals] Org scope error:', err.message);
    }
    
    // Fallback to legacy fields
    if (Object.keys(orgScope).length === 0) {
      if (req.user?.region) orgScope.region = req.user.region;
      if (req.user?.department) orgScope.department = req.user.department;
      if (req.user?.division) orgScope.division = req.user.division;
    }

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
    const isSuperAdmin = userRole === 'SUPER ADMIN';
    
    switch (view) {
      case 'my-proposals':
        if (isSuperAdmin) {
          // Super Admin: strict identity matching
          if (strictIdentityCandidates.length > 0) {
            query.$or = [
              { createdBy: { $in: strictIdentityCandidates } },
              { createdByName: { $in: strictIdentityCandidates } }
            ];
          } else {
            query.$or = [{ createdByName: userName }];
          }
        } else {
          // Allow co-editing: Users with the EXACT same organizational scope share the same drafts
          if (Object.keys(orgScope).length > 0) {
            const { region, ...orgScopeWithoutRegion } = orgScope;
            query = { ...query, ...orgScopeWithoutRegion };
            
            // Strict exact level matching to prevent seeing lower-level drafts
            if (!orgScope.division) query.division = { $in: [null, ""] };
            if (!orgScope.department) query.department = { $in: [null, ""] };
            
            if (region) {
              const regionDoc = await require('../models/Region').findOne({
                $or: [{ Region: region }, { regionName: region }, { RegionName: region }]
              });
              if (regionDoc) {
                query.region = regionDoc._id;
              }
            }
          } else {
            // Fallback for users with no org scope
            if (strictIdentityCandidates.length > 0) {
              query.$or = [
                { createdBy: { $in: strictIdentityCandidates } },
                { createdByName: { $in: strictIdentityCandidates } }
              ];
            } else {
              query.$or = [{ createdByName: userName }];
            }
          }
        }

        query.status = { $in: ['DRAFT', 'RETURNED_TO_PREPARER'] };
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
          
          // Apply Organizational Scope Restriction
          // Note: Exclude region from spread since region field is ObjectId, not String
          if (!isSuperAdmin && Object.keys(orgScope).length > 0) {
            const { region, ...orgScopeWithoutRegion } = orgScope;
            query = { ...query, ...orgScopeWithoutRegion };
          }

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
        // Show all non-draft proposals by default.
        // For Budget Preparer, also include OWN draft proposals so newly-created items are visible on this tab.
        if (userRole === 'BUDGET PREPARER') {
          query.$or = [
            { status: { $ne: 'DRAFT' } },
            {
              $and: [
                { status: 'DRAFT' },
                {
                  $or: [
                    { createdBy: userIdString },
                    { createdBy: userName },
                    { createdByName: userName }
                  ]
                }
              ]
            }
          ];
        } else {
          query.status = { $ne: 'DRAFT' };  // Use DRAFT enum
        }

        // Apply Organizational Scope Restriction (intersection) for ALL non-Super Admins
        // Note: Exclude region from spread since region field is ObjectId, not String
        if (!isSuperAdmin && Object.keys(orgScope).length > 0) {
          const { region, ...orgScopeWithoutRegion } = orgScope;
          query = { ...query, ...orgScopeWithoutRegion };
        }
        break;
      case 'monitoring':
        // Monitoring tab for Budget Manager and SUPER ADMIN: show all proposals except drafts
        if (userRole === 'BUDGET MANAGER' || isSuperAdmin) {
          // Show all non-DRAFT statuses. SUPER ADMIN sees same view as Budget Manager.
          query.status = { $ne: 'DRAFT' };
          
          // Apply Organizational Scope Restriction for Managers
          // Note: Exclude region from spread since region field is ObjectId, not String
          if (!isSuperAdmin && Object.keys(orgScope).length > 0) {
            const { region, ...orgScopeWithoutRegion } = orgScope;
            query = { ...query, ...orgScopeWithoutRegion };
          }
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
    const legacyList = await Proposal.find(
      { workflowRef: { $in: wfIds } },
      'workflowRef region totalIncome totalExpenses proposedBudget projectedSubsidy projectedCorporateIncome department division originalDepartment originalDivision amount'
    ).lean();
    const legacyMap = new Map(legacyList.map(lp => [String(lp.workflowRef), lp]));

    // Fallback organizational info from line-item collections when proposal-level fields are missing.
    // This keeps Responsibility Center in list aligned with Proposal Details dialog values.
    const orgFallbackMap = new Map();
    const upsertOrgFallback = (rawKey, org = {}) => {
      const key = rawKey ? String(rawKey) : '';
      if (!key) return;
      const existing = orgFallbackMap.get(key) || {};
      const merged = {
        division: existing.division || org.division || '',
        department: existing.department || org.department || '',
        region: existing.region || org.region || '',
      };
      orgFallbackMap.set(key, merged);
    };

    try {
      const [incomeOrgRows, personnelOrgRows, mooeOrgRows, capitalOrgRows] = await Promise.all([
        Income.find(
          { $or: [{ workflowRef: { $in: wfIds } }, { proposalId: { $in: wfIds } }] },
          'workflowRef proposalId division department responsibilityCenter office region'
        ).lean(),
        PersonnelServices.find(
          { $or: [{ workflowRef: { $in: wfIds } }, { proposalId: { $in: wfIds } }] },
          'workflowRef proposalId division department responsibilityCenter office region'
        ).lean(),
        MooeProposal.find(
          { $or: [{ workflowRef: { $in: wfIds } }, { proposalId: { $in: wfIds } }] },
          'workflowRef proposalId division department responsibilityCenter office region'
        ).lean(),
        CapitalOutlay.find(
          { $or: [{ workflowRef: { $in: wfIds } }, { proposalId: { $in: wfIds } }] },
          'workflowRef proposalId division department responsibilityCenter office region'
        ).lean(),
      ]);

      const allOrgRows = [
        ...(incomeOrgRows || []),
        ...(personnelOrgRows || []),
        ...(mooeOrgRows || []),
        ...(capitalOrgRows || []),
      ];

      allOrgRows.forEach((row) => {
        const key = row?.workflowRef || row?.proposalId;
        const division = row?.division || row?.responsibilityCenter || '';
        const department = row?.department || row?.office || '';
        const region = row?.region || '';
        upsertOrgFallback(key, { division, department, region });
      });
    } catch (orgErr) {
      console.warn('[RC_FALLBACK] Failed to gather org fallback from line items:', orgErr.message);
    }

    // Fallback: if my-proposals view returned none, broaden search to createdBy only (no status) then re-filter
    if (view === 'my-proposals' && newProposals.length === 0) {
      // First fallback: direct createdBy match (string cast)
      // Note: Exclude region from spread since region field is ObjectId, not String
      const { region, ...orgScopeWithoutRegion } = orgScope;
      const fallbackQuery = { createdBy: userIdString, ...orgScopeWithoutRegion };
  const fallbackAll = await NewProposalWorkflow.find(fallbackQuery).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
      newProposals = fallbackAll.filter(p => p.status === 'DRAFT' || p.status === 'RETURNED_TO_PREPARER');
      // Second fallback: try createdByName if still empty
      if (newProposals.length === 0) {
        const { region: _r, ...orgScopeWithoutRegion } = orgScope;
  const nameFallback = await NewProposalWorkflow.find({ createdByName: userName, status: { $in: ['DRAFT', 'RETURNED_TO_PREPARER'] }, ...orgScopeWithoutRegion }).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
        newProposals = nameFallback;
      }
      // Final fallback: only return user-specific drafts. Do NOT return ALL drafts to avoid exposure.
      if (newProposals.length === 0) {
        const { region: _r2, ...orgScopeWithoutRegion } = orgScope;
        const allUserDrafts = await NewProposalWorkflow.find({ createdBy: userIdString, status: { $in: ['DRAFT', 'RETURNED_TO_PREPARER'] }, ...orgScopeWithoutRegion }).sort({ createdAt: -1 }).limit(25).populate('region','Region regionName RegionName');
        // Also try createdByName fallback, but do not broaden to all drafts
        if (allUserDrafts.length > 0) {
          newProposals = allUserDrafts;
        } else {
          const { region: _r3, ...orgScopeWithoutRegion } = orgScope;
          const nameFallback = await NewProposalWorkflow.find({ createdByName: userName, status: { $in: ['DRAFT', 'RETURNED_TO_PREPARER'] }, ...orgScopeWithoutRegion }).sort({ createdAt: -1 }).populate('region','Region regionName RegionName');
          newProposals = nameFallback;
        }
      }
    }

    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's organizational assignment
    // Apply to all views EXCEPT 'monitoring' (which is for Budget Manager who sees all)
    // and SUPER ADMIN (who sees everything)
    // Budget Planning Analyst uses separate region filter below (isNIAWide / assignedRegions)
    if (userRole !== 'SUPER ADMIN' && userRole !== 'BUDGET MANAGER' && userRole !== 'BUDGET PLANNING ANALYST' && view !== 'monitoring' && view !== 'my-proposals') {
      try {
        // Use previously fetched assignment if available
        if (!userAssignment) {
          userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
            .populate('departmentId', 'Department DepartmentName department')
            .populate('regionId', 'Region RegionName region')
            .lean();
        }
        
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

          const normalizeOrgValue = (value) =>
            String(value || '')
              .trim()
              .toLowerCase()
              .replace(/\s+/g, ' ');

          const assignmentLevelRaw = String(userAssignment.assignmentLevel || '').toUpperCase();
          const assignmentLevel = ({
            DIVISION_LEVEL: 'DIVISION',
            BUDGET_AND_REVENUE_DIVISION: 'REGION',
            DEPARTMENT_LEVEL: 'DEPARTMENT',
            DEPARTMENT_REGIONAL_LEVEL: 'DEPARTMENT',
            RESPONSIBILITY_CENTER: 'DIVISION',
            OFFICE_LEVEL: 'OFFICE',
            REGION_LEVEL: 'REGION',
            FULL_ACCESS: 'FULL'
          })[assignmentLevelRaw] || assignmentLevelRaw;
          const assignedDepartmentNorm = normalizeOrgValue(assignedDepartment);
          const assignedDivisionNorm = normalizeOrgValue(assignedDivision);
          const assignedRegionNorm = normalizeOrgValue(assignedRegion);
          
          const filteredProposals = newProposals.filter(p => {
            const isOwnProposal =
              String(p?.createdBy || '') === String(userIdString || '') ||
              String(p?.createdBy || '').toLowerCase() === String(userName || '').toLowerCase() ||
              String(p?.createdByName || '').toLowerCase() === String(userName || '').toLowerCase();
            if (isOwnProposal) {
              console.log('[ORG_FILTER] ✓ ALLOWED (own proposal)');
              return true;
            }

            const legacy = legacyMap.get(String(p._id));
            const proposalDivision = normalizeOrgValue(
              legacy?.division ||
              legacy?.originalDivision ||
              p?.division ||
              p?.responsibilityCenter ||
              ''
            );
            const proposalDepartment = normalizeOrgValue(
              legacy?.department ||
              legacy?.originalDepartment ||
              p?.department ||
              ''
            );
            const proposalRegion = normalizeOrgValue(
              legacy?.region ||
              p?.region?.Region ||
              p?.region?.regionName ||
              p?.region?.RegionName ||
              ''
            );

            if (!legacy) {
              console.log('[ORG_FILTER] Legacy org row missing, using workflow-level fallback fields');
            }
            
            console.log(`[ORG_FILTER] Checking proposal: Div=${proposalDivision} Dept=${proposalDepartment} Region=${proposalRegion}`);

            const hasAnyOrgValue = Boolean(proposalDivision || proposalDepartment || proposalRegion);
            if (!hasAnyOrgValue) {
              // Avoid false-negative hiding when historical records have incomplete org metadata.
              // Role/status checks already ran earlier in query.
              console.log('[ORG_FILTER] ✓ ALLOWED (missing org metadata fallback)');
              return true;
            }
            
            // CASE 1: User assigned at DIVISION level - only show proposals from that division
            if (assignedDivisionNorm && assignmentLevel === 'DIVISION') {
              if (proposalDivision === assignedDivisionNorm) {
                console.log('[ORG_FILTER] ✓ ALLOWED (division match)');
                return true;
              }
            }
            
            // CASE 2: User assigned at DEPARTMENT level - only show proposals from that department
            if (assignedDepartmentNorm && (assignmentLevel === 'DEPARTMENT' || assignmentLevel === 'OFFICE')) {
              if (proposalDepartment === assignedDepartmentNorm) {
                console.log('[ORG_FILTER] ✓ ALLOWED (department match)');
                return true;
              }
            }
            
            // CASE 3: User assigned at REGION level - only show proposals from that region
            if (assignmentLevel === 'REGION') {
              // isNIAWide: Budget Planning Analyst covers all regions
              if (userAssignment.isNIAWide) {
                console.log('[ORG_FILTER] ✓ ALLOWED (NIA-Wide analyst)');
                return true;
              }
              if (assignedRegionNorm && proposalRegion === assignedRegionNorm) {
                console.log('[ORG_FILTER] ✓ ALLOWED (region match)');
                return true;
              }
              // Fallback: check assignedRegions array (region codes/names)
              if (Array.isArray(userAssignment.assignedRegions) && userAssignment.assignedRegions.length > 0) {
                const regionNorms = userAssignment.assignedRegions.map(r => normalizeOrgValue(r));
                if (regionNorms.includes(proposalRegion)) {
                  console.log('[ORG_FILTER] ✓ ALLOWED (assignedRegions match)');
                  return true;
                }
              }
            }
            
            // CASE 4: Full access (no restrictions)
            if (assignmentLevel === 'FULL') {
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

    // BUDGET PLANNING ANALYST REGION FILTER
    // BPAs are excluded from the generic ORG_FILTER above.
    // Their visibility is controlled by isNIAWide and assignedRegions on their assignment.
    if (userRole === 'BUDGET PLANNING ANALYST' && view !== 'monitoring' && view !== 'my-proposals') {
      try {
        const bpaAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('regionId', 'Region RegionName regionName region')
          .lean();

        if (bpaAssignment) {
          // isNIAWide → no regional restriction
          if (!bpaAssignment.isNIAWide) {
            const normalizeOrgValue = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

            // Build set of allowed region values from assignment
            const allowedRegions = new Set();
            // Primary regionId reference
            const primaryRegion = bpaAssignment.regionId?.Region || bpaAssignment.regionId?.RegionName || bpaAssignment.regionId?.regionName || bpaAssignment.regionId?.region;
            if (primaryRegion) allowedRegions.add(normalizeOrgValue(primaryRegion));
            // assignedRegions array (region codes)
            if (Array.isArray(bpaAssignment.assignedRegions)) {
              bpaAssignment.assignedRegions.forEach(r => { if (r) allowedRegions.add(normalizeOrgValue(r)); });
            }

            console.log('[BPA_FILTER] User:', userIdString, '| Allowed regions:', [...allowedRegions]);

            // Only filter if at least one region is configured; otherwise show all (misconfigured assignment)
            if (allowedRegions.size > 0) {
              newProposals = newProposals.filter(p => {
                const legacy = legacyMap.get(String(p._id));
                const proposalRegion = normalizeOrgValue(
                  legacy?.region ||
                  p?.region?.Region ||
                  p?.region?.regionName ||
                  p?.region?.RegionName ||
                  ''
                );
                if (!proposalRegion) return true; // no region metadata → show
                return allowedRegions.has(proposalRegion);
              });
              console.log(`[BPA_FILTER] Filtered to ${newProposals.length} proposals`);
            } else {
              console.log('[BPA_FILTER] No regions configured on assignment → showing all proposals');
            }
          } else {
            console.log('[BPA_FILTER] isNIAWide=true → showing all proposals');
          }
        } else {
          console.log('[BPA_FILTER] No assignment found → showing all proposals');
        }
      } catch (err) {
        console.error('[BPA_FILTER] Error:', err.message);
        // On error keep original (don't hide data)
      }
    }


    const mappedNewProposals = newProposals.map(p => {
      const legacy = legacyMap.get(String(p._id));
      const orgFallback = orgFallbackMap.get(String(p._id)) || {};
      // Use legacy info if available, otherwise fallback to NewProposalWorkflow fields
      const regionName = legacy?.region || p.region?.Region || p.region?.regionName || p.region?.RegionName || orgFallback.region || '';
      const divisionName = legacy?.division || legacy?.originalDivision || p.division || orgFallback.division || '';
      const departmentName = legacy?.department || legacy?.originalDepartment || p.department || orgFallback.department || '';
      // Responsibility Center display should respect the user's organizational level.
      // If user is DEPARTMENT level, only show department. If DIVISION level, show division.
      const rawLevel = String(userAssignment?.assignmentLevel || '').toUpperCase();
      const resolvedLevel = ({
        DIVISION_LEVEL: 'DIVISION',
        BUDGET_AND_REVENUE_DIVISION: 'REGION',
        DEPARTMENT_LEVEL: 'DEPARTMENT',
        DEPARTMENT_REGIONAL_LEVEL: 'DEPARTMENT',
        RESPONSIBILITY_CENTER: 'DIVISION',
        OFFICE_LEVEL: 'OFFICE',
        REGION_LEVEL: 'REGION'
      })[rawLevel] || rawLevel;

      let responsibilityCenter;
      if (resolvedLevel === 'DEPARTMENT' || resolvedLevel === 'OFFICE') {
        responsibilityCenter = departmentName || regionName || undefined;
      } else if (resolvedLevel === 'DIVISION') {
        responsibilityCenter = divisionName || departmentName || regionName || undefined;
      } else if (resolvedLevel === 'REGION') {
        responsibilityCenter = regionName || undefined;
      } else {
        // Default (Super Admin or no assignment): show full hierarchy
        responsibilityCenter =
          [departmentName, divisionName].filter(Boolean).join(' / ') ||
          divisionName ||
          departmentName ||
          regionName ||
          undefined;
      }
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
        // Responsibility Center: CO → Division/Department; Regional → Region (consolidated)
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
        // Prefer consolidated Proposal totals when available so Workflow matches Budgetary Support & PS
        proposedBudget: Number(
          legacy?.proposedBudget ??
          ((Number(legacy?.totalExpenses ?? p.totalExpenses ?? 0) +
            Number(legacy?.totalIncome ?? p.totalIncome ?? 0)) ||
            p.amount ||
            0)
        ),
        projectedCorporateIncome: Number(legacy?.projectedCorporateIncome ?? p.projectedCorporateIncome ?? 0),
        projectedSubsidy: Number(legacy?.projectedSubsidy ?? p.projectedSubsidy ?? 0),
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
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;

    // CRITICAL: First try to fetch from Proposal model (fmis_budget) which has projectedSubsidy
    // This is needed for BudgetarySupportTable which passes Proposal._id, not NewProposalWorkflow._id
    let proposal = await Proposal.findById(id).lean();
    
    if (proposal) {
      // Check organizational access for legacy proposal lookup
      const hasOrgAccess = await checkProposalOrgAccess(proposal, userId, userRole);
      if (!hasOrgAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to view this proposal'
        });
      }

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

    // Organizational Access Security Check
    const hasOrgAccess = await checkProposalOrgAccess(proposal, userId, userRole);
    if (!hasOrgAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view proposals outside your assigned organizational scope'
      });
    }

    // Check if user can access this proposal based on role/status
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
    // Responsibility Center display should prioritize the actual organizational unit
    // (department/division) and only fallback to region when unit fields are unavailable.
    const responsibilityCenter =
      [departmentName, divisionName].filter(Boolean).join(' / ') ||
      divisionName ||
      departmentName ||
      regionName ||
      undefined;

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

// Get Budget Planning Analysts eligible for a proposal (for Approver "Send to" options)
// Central Office proposals → analysts with Central Office in assignedRegions
// Other Region proposals → analysts with that region in assignedRegions
exports.getAnalystsForProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await NewProposalWorkflow.findById(id).populate('region', 'Region RegionName');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    const analysts = await getAnalystsEligibleForProposal(proposal);
    res.json({
      success: true,
      data: analysts,
      isCentralOffice: proposal.isCentralOffice === true ||
        (proposal.region && proposal.region.Region && String(proposal.region.Region).toLowerCase().includes('central office'))
    });
  } catch (error) {
    console.error('Error fetching analysts for proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysts',
      error: error.message
    });
  }
};

// Perform action on proposal
const TierRevision = require('../models/TierRevision');

exports.performAction = async (req, res) => {
  try {
    const { id } = req.params;
    let { action } = req.body;
    const { comment } = req.body;
    const eSignature = req.body?.eSignature || null;
    const userRole = getUserRole(req);
    const userId = req.user.id;
    const userIdString = String(userId);
    const userName = await resolveUserDisplayName(req, userIdString);

    console.log('[PERFORM_ACTION] User:', { userRole, userId, userName });
    console.log('[PERFORM_ACTION] Request:', { proposalId: id, action, comment });

    let userAssignment = null;
    if (action === 'submit-to-reviewer' && userRole === 'BUDGET PREPARER') {
      try {
        userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString }).lean();
        if (userAssignment && String(userAssignment.assignmentLevel).toUpperCase() === 'OFFICE') {
          action = 'submit-to-approver';
        }
      } catch (assignmentErr) {
        console.warn('[PERFORM_ACTION] Error fetching user assignment:', assignmentErr.message);
      }
    }

    const proposal = await NewProposalWorkflow.findById(id);
        if (action === 'submit-to-approver' && userRole === 'BUDGET PREPARER') {
          try {
            userAssignment = userAssignment || await HierarchicalUserAssignment.findOne({ userId: userIdString }).lean();
            if (!userAssignment || String(userAssignment.assignmentLevel).toUpperCase() !== 'OFFICE') {
              return res.status(403).json({ success: false, message: 'Direct submit to approver is only allowed for Office-level preparers' });
            }
          } catch (assignmentErr) {
            console.warn('[PERFORM_ACTION] Error enforcing assignment level for submit-to-approver:', assignmentErr.message);
          }
        }

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

    const eSignatureRequiredInSettings = await isWorkflowESignatureRequired();
    const requiresESignature = WORKFLOW_ACTIONS_REQUIRING_ESIGNATURE.has(action) && eSignatureRequiredInSettings;

    if (requiresESignature) {
      const eSignatureImage = String(eSignature?.imageDataUrl || '').trim();
      const eSignatureSignedAt = eSignature?.signedAt;
      if (!eSignatureImage || !eSignatureImage.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'A valid e-signature image is required for this submission action'
        });
      }
      if (eSignatureImage.length > 3000000) {
        return res.status(400).json({
          success: false,
          message: 'E-signature image is too large'
        });
      }
      if (!eSignatureSignedAt || Number.isNaN(new Date(eSignatureSignedAt).getTime())) {
        return res.status(400).json({
          success: false,
          message: 'A valid e-signature timestamp is required for this submission action'
        });
      }
    }

    let signatureVerification = null;
    const requiresDigitalSignature =
      WORKFLOW_ACTIONS_REQUIRING_SIGNATURE.has(action) && isCryptographicSignatureEnforced();

    if (requiresDigitalSignature) {
      if (!req.body.digitalSignature) {
        return res.status(400).json({
          success: false,
          message: 'Cryptographic digital signature is required for this workflow action'
        });
      }

      try {
        signatureVerification = verifyWorkflowDigitalSignature({
          proposal,
          action,
          fromStatus: proposal.status,
          toStatus: newWorkflowStatus,
          comment,
          signedBy: userIdString,
          digitalSignature: req.body.digitalSignature
        });
      } catch (signatureError) {
        return res.status(400).json({
          success: false,
          message: `Digital signature verification failed: ${signatureError.message}`
        });
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

    const workflowLevelByStatus = {
      'DRAFT': 'BUDGET PREPARER',
      'FORWARDED_TO_REVIEWER': 'BUDGET REVIEWER',
      'FORWARDED_TO_APPROVER': 'BUDGET APPROVER',
      'FORWARDED_TO_BRD_ANALYST': 'BUDGET_PLANNING_ANALYST',
      'FORWARDED_TO_BRD_OFFICER': 'BUDGET_OFFICER',
      'FORWARDED_TO_BRD_MANAGER': 'BUDGET_MANAGER',
      'FINALIZED': 'FINALIZED',
      'RETURNED_TO_PREPARER': 'BUDGET PREPARER',
      'RETURNED_TO_REVIEWER': 'BUDGET REVIEWER',
      'RETURNED_TO_APPROVER': 'BUDGET APPROVER',
      'RETURNED_TO_PLANNING_ANALYST': 'BUDGET_PLANNING_ANALYST',
      'RETURNED_TO_OFFICER': 'BUDGET_OFFICER',
    };
    const mappedWorkflowLevel = workflowLevelByStatus[newWorkflowStatus] || 'BUDGET PREPARER';

    // Update proposal
    const oldStatus = proposal.status;
    proposal.status = newWorkflowStatus;
    
    // Update projectedSubsidy if provided by frontend
    if (req.body.projectedSubsidy !== undefined) {
      proposal.projectedSubsidy = Number(req.body.projectedSubsidy) || 0;
    }
    
    proposal.workflowHistory = proposal.workflowHistory || [];

    // Attach current Tier version (if any) for this proposal's scope so we know
    // exactly which Tier 1 / Tier 2 split was in effect when this action ran.
    let tierHistoryFields = {};
    try {
      const fiscalYearStr = String(proposal.fiscalYear);
      const regionStr = proposal.region ? String(proposal.region) : '';
      const departmentStr = String(proposal.department || '');
      const divisionStr = String(proposal.division || '');

      const latestTierRevision = await TierRevision.findOne({
        fiscalYear: fiscalYearStr,
        region: regionStr,
        department: departmentStr,
        division: divisionStr,
      })
        .sort({ version: -1 })
        .select('_id version')
        .lean();

      if (latestTierRevision) {
        tierHistoryFields = {
          tierVersion: latestTierRevision.version || 0,
          tierRevisionId: latestTierRevision._id,
        };
      }
    } catch (tierErr) {
      console.warn('[PERFORM_ACTION] Failed to resolve Tier revision for history entry:', tierErr.message);
    }

    proposal.workflowHistory.push({
      action,
      fromStatus: oldStatus,
      toStatus: newWorkflowStatus,
      performedBy: userId,
      performedByName: userName,
      comment: comment || '',
      eSignature: requiresESignature ? {
        imageDataUrl: encryptESignatureDataUrl(String(eSignature?.imageDataUrl || '')),
        signedAt: eSignature?.signedAt ? new Date(eSignature.signedAt) : new Date(),
        signedBy: userIdString,
        signerName: String(eSignature?.signerName || userName || '')
      } : undefined,
      digitalSignature: signatureVerification ? {
        signatureAlgorithm: req.body?.digitalSignature?.algorithm || 'RSA-SHA256',
        signedAt: req.body?.digitalSignature?.signedAt ? new Date(req.body.digitalSignature.signedAt) : new Date(),
        signedPayloadHash: crypto.createHash('sha256').update(signatureVerification.signedPayload).digest('hex'),
        certificateSubject: signatureVerification.certificateSubject,
        certificateIssuer: signatureVerification.certificateIssuer,
        certificateSerialNumber: signatureVerification.certificateSerialNumber,
        certificateFingerprint256: signatureVerification.certificateFingerprint256,
        certificateValidFrom: signatureVerification.certificateValidFrom ? new Date(signatureVerification.certificateValidFrom) : undefined,
        certificateValidTo: signatureVerification.certificateValidTo ? new Date(signatureVerification.certificateValidTo) : undefined,
        trustBundleConfigured: signatureVerification.trustBundleConfigured
      } : undefined,
      ...tierHistoryFields,
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
        workflowLevel: mappedWorkflowLevel,
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
      const lineItemUpdatePayload = { status: legacyStatus, workflowLevel: mappedWorkflowLevel, updatedAt: new Date() };

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

    // After status + line items are synced, recalculate consolidated totals so
    // Proposal + NewProposalWorkflow reflect the same PROJECTED SUBSIDY / PROPOSED BUDGET
    try {
      console.log('[PERFORM_ACTION] Triggering recalculateAndSaveProposalTotals for workflowRef:', proposal._id);
      await recalculateAndSaveProposalTotals({ workflowRef: proposal._id });
      console.log('[PERFORM_ACTION] Recalculation completed successfully for workflowRef:', proposal._id);
    } catch (recalcError) {
      console.error('[PERFORM_ACTION] Error recalculating proposal totals:', recalcError.message);
      // Do not fail the workflow action if totals recalculation fails
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
        const recipientOptions = action === 'submit-to-analyst' ? { targetAnalystId: req.body.targetAnalystId } : {};
        const recipientUserIds = await getNotificationRecipients(action, proposal, userRole, userId, recipientOptions);
        
        console.log('[PERFORM_ACTION] Recipients found:', recipientUserIds.length, 'IDs:', recipientUserIds);
        
        // Create notifications for all recipients
        if (recipientUserIds.length > 0) {
          console.log('[PERFORM_ACTION] Creating notifications for action:', action);
          await createWorkflowNotification(action, proposal, recipientUserIds, userName, comment, userRole);
          
          // Email notifications are already handled by sendWorkflowEmails function
          // which is called separately and respects user email preferences
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
      signatureVerified: Boolean(signatureVerification),
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

    // Additional Organizational Security Check
    const hasOrgAccess = await checkProposalOrgAccess(proposal, userId, userRole);
    if (!hasOrgAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You can only edit proposals within your assigned organizational scope (Region/Department/Division)'
      });
    }

    // Optimistic locking: if client sent __v, ensure it matches (prevents overwriting concurrent edits)
    const clientVersion = req.body.__v;
    if (clientVersion !== undefined && proposal.__v !== clientVersion) {
      return res.status(409).json({
        success: false,
        message: 'This proposal was modified by another user. Please refresh and try again.',
        code: 'VERSION_CONFLICT',
        currentVersion: proposal.__v
      });
    }

    const allowedFields = ['title', 'description', 'modelType', 'fiscalYear', 'amount', 'income', 'personnel', 'mooe', 'capitalOutlay', 'division', 'department', 'office', 'isCentralOffice', 'projectedCorporateIncome', 'projectedSubsidy'];
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

    // Additional Organizational Security Check
    const hasOrgAccess = await checkProposalOrgAccess(proposal, userId, userRole);
    if (!hasOrgAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You can only delete proposals within your assigned organizational scope'
      });
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
const normalizeAttachmentWorkflowStatus = (status) => {
  const raw = String(status || '').trim().toUpperCase();
  const statusMap = {
    'DRAFT': 'DRAFT',
    'FINALIZED': 'FINALIZED',
    'FORWARDED TO REVIEWER': 'FORWARDED_TO_REVIEWER',
    'FORWARDED TO APPROVER': 'FORWARDED_TO_APPROVER',
    'FORWARDED TO BUDGET PLANNING ANALYST': 'FORWARDED_TO_BRD_ANALYST',
    'FORWARDED TO BUDGET OFFICER': 'FORWARDED_TO_BRD_OFFICER',
    'FORWARDED TO OVERALL BUDGET APPROVER': 'FORWARDED_TO_BRD_MANAGER',
    'RETURNED TO PREPARER': 'RETURNED_TO_PREPARER',
    'RETURNED TO REVIEWER': 'RETURNED_TO_REVIEWER',
    'RETURNED TO APPROVER': 'RETURNED_TO_APPROVER',
    'RETURNED TO BUDGET PLANNING ANALYST': 'RETURNED_TO_PLANNING_ANALYST',
    'RETURNED TO BUDGET OFFICER': 'RETURNED_TO_OFFICER',
  };

  return statusMap[raw] || raw.replace(/\s+/g, '_');
};

const canUploadAttachmentByStatus = ({ userRole, proposalStatus, isProposalOwner }) => {
  if (!userRole) return false;

  if (proposalStatus === 'FINALIZED') {
    return false;
  }

  if (userRole === 'SUPER ADMIN') {
    return true;
  }

  if (proposalStatus === 'DRAFT' && userRole === 'BUDGET PREPARER' && isProposalOwner) {
    return true;
  }

  if (proposalStatus === 'FORWARDED_TO_REVIEWER' && (
    (userRole === 'BUDGET PREPARER' && isProposalOwner) ||
    userRole === 'BUDGET REVIEWER'
  )) {
    return true;
  }

  if (proposalStatus === 'FORWARDED_TO_APPROVER' && userRole === 'BUDGET APPROVER') {
    return true;
  }

  if (proposalStatus === 'FORWARDED_TO_BRD_ANALYST' && (
    userRole === 'BUDGET APPROVER' || userRole === 'BUDGET PLANNING ANALYST'
  )) {
    return true;
  }

  if (proposalStatus === 'FORWARDED_TO_BRD_OFFICER' && (
    userRole === 'BUDGET OFFICER' || userRole === 'BUDGET MANAGER'
  )) {
    return true;
  }

  if (proposalStatus === 'FORWARDED_TO_BRD_MANAGER' && userRole === 'BUDGET MANAGER') {
    return true;
  }

  if (proposalStatus === 'RETURNED_TO_PREPARER' && userRole === 'BUDGET PREPARER' && isProposalOwner) {
    return true;
  }

  if (proposalStatus === 'RETURNED_TO_REVIEWER' && userRole === 'BUDGET REVIEWER') {
    return true;
  }

  if (proposalStatus === 'RETURNED_TO_APPROVER' && userRole === 'BUDGET APPROVER') {
    return true;
  }

  if (proposalStatus === 'RETURNED_TO_PLANNING_ANALYST' && userRole === 'BUDGET PLANNING ANALYST') {
    return true;
  }

  if (proposalStatus === 'RETURNED_TO_OFFICER' && userRole === 'BUDGET OFFICER') {
    return true;
  }

  return false;
};

const getNormalizedRoleSet = (req) => {
  const roles = Array.isArray(req.user?.Roles) ? req.user.Roles : [];
  return new Set(roles.map((role) => String(role || '').toUpperCase().replace(/\s+/g, '_')));
};

const getAttachmentRoleFlags = (req) => {
  const roleSet = getNormalizedRoleSet(req);
  return {
    isSuperAdmin: roleSet.has('SUPER_ADMIN') || roleSet.has('SUPERADMIN'),
    isPreparer: roleSet.has('BUDGET_PREPARER'),
    isReviewer: roleSet.has('BUDGET_REVIEWER'),
    isApprover: roleSet.has('BUDGET_APPROVER'),
    isPlanningAnalyst: roleSet.has('BUDGET_PLANNING_ANALYST'),
    isBudgetOfficer: roleSet.has('BUDGET_OFFICER'),
    isBudgetManager: roleSet.has('BUDGET_MANAGER') || roleSet.has('OVERALL_BUDGET_APPROVER'),
  };
};

const canUploadAttachmentByRoleFlags = ({ roleFlags, proposalStatus, isProposalOwner }) => {
  if (!roleFlags) return false;

  if (proposalStatus === 'FINALIZED') return false;
  if (roleFlags.isSuperAdmin) return true;

  if ((proposalStatus === 'DRAFT' || proposalStatus === 'RETURNED_TO_PREPARER') && roleFlags.isPreparer && isProposalOwner) return true;
  if ((proposalStatus === 'FORWARDED_TO_REVIEWER' || proposalStatus === 'RETURNED_TO_REVIEWER') && roleFlags.isReviewer) return true;
  if ((proposalStatus === 'FORWARDED_TO_APPROVER' || proposalStatus === 'RETURNED_TO_APPROVER') && roleFlags.isApprover) return true;
  if ((proposalStatus === 'FORWARDED_TO_BRD_ANALYST' || proposalStatus === 'RETURNED_TO_PLANNING_ANALYST') && roleFlags.isPlanningAnalyst) return true;
  if ((proposalStatus === 'FORWARDED_TO_BRD_OFFICER' || proposalStatus === 'RETURNED_TO_OFFICER') && roleFlags.isBudgetOfficer) return true;
  if (proposalStatus === 'FORWARDED_TO_BRD_MANAGER' && roleFlags.isBudgetManager) return true;

  return false;
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { module = 'general' } = req.query;
    const userRole = getUserRole(req);
    const roleFlags = getAttachmentRoleFlags(req);
    const requesterUserId = String(req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId || '');
    const requesterName = String(req.user?.name || req.user?.UserName || `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim() || req.user?.email || '').trim();
    
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

    const normalizedStatus = normalizeAttachmentWorkflowStatus(proposal.status);
    const isProposalOwnerById = String(proposal.createdBy || '') === requesterUserId;
    const isProposalOwnerByName = requesterName && String(proposal.createdByName || '').toLowerCase() === requesterName.toLowerCase();
    const isProposalOwner = isProposalOwnerById || isProposalOwnerByName;

    const canUpload = canUploadAttachmentByRoleFlags({
      roleFlags,
      proposalStatus: normalizedStatus,
      isProposalOwner,
    });

    if (!canUpload) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to attach files at the current workflow status'
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
    const userRole = getUserRole(req);
    const roleFlags = getAttachmentRoleFlags(req);
    const requesterUserId = String(req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId || '');
    const requesterName = String(req.user?.name || req.user?.UserName || `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim() || req.user?.email || '').trim();

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

    // At BRD Level, no one can delete attachments - view/download only
    const proposalStatus = normalizeAttachmentWorkflowStatus(proposal.status);

    if (proposalStatus === 'FINALIZED') {
      return res.status(403).json({ success: false, message: 'Deletion of attachments is not allowed for finalized proposals.' });
    }

    const isProposalOwnerById = String(proposal.createdBy || '') === requesterUserId;
    const isProposalOwnerByName = requesterName && String(proposal.createdByName || '').toLowerCase() === requesterName.toLowerCase();
    const isProposalOwner = isProposalOwnerById || isProposalOwnerByName;

    const canDeleteByStatus = canUploadAttachmentByRoleFlags({
      roleFlags,
      proposalStatus,
      isProposalOwner,
    });

    if (!canDeleteByStatus) {
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

    // First, find which model the ID belongs to so we can recalculate with the correct ref
    let proposal = await Proposal.findOne({
      $or: [
        { workflowRef: workflowRefId },
        { proposalId: workflowRefId },
        { _id: workflowRefId }
      ]
    }).lean();
    
    if (!proposal) {
      console.log('[getProposalTotalsByWorkflowRef] Proposal not found for ID:', workflowRefId);
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // Determine the correct workflowRef to use for recalculation
    const correctWorkflowRef = proposal.workflowRef || proposal.proposalId || workflowRefId;
    
    // Always recalculate before returning totals so Workflow, Budgetary Support,
    // and Personnel Services views stay aligned.
    try {
      await recalculateAndSaveProposalTotals({ 
        proposalId: proposal._id,  // Use the Proposal._id which we found
        workflowRef: correctWorkflowRef
      });
    } catch (recalcError) {
      console.warn('[getProposalTotalsByWorkflowRef] Recalculation warning:', recalcError.message);
      // Continue and return best available persisted totals
    }
    
    // Fetch the updated proposal after recalculation
    proposal = await Proposal.findById(proposal._id).lean();
    
    console.log('[getProposalTotalsByWorkflowRef] Returning Proposal totals for ID:', workflowRefId);
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