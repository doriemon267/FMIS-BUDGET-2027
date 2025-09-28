const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Notification = require('../models/Notification');
const User = require('../models/User');

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
      const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

      // Super admin and budget admin can see everything
      if (isSuperAdmin || userRoles.includes('BUDGET_ADMIN')) {
        return next();
      }

      if (operation === 'read') {
        // Build visibility filter based on role
        let visibilityFilter = {};

        if (isBudgetAnalyst) {
          // Budget Analysts can only see their own proposals
          visibilityFilter.createdByUserId = userId;
        } else if (isBudgetCoordinator) {
          // Budget Coordinators can see proposals from their department
          // This would need department matching logic
          visibilityFilter.$or = [
            { createdByUserId: userId },
            { status: { $in: ['Division Submitted', 'Office', 'Office Approved', 'Office Submitted'] } }
          ];
        } else if (isBudgetOfficer) {
          // Budget Officers can see submitted proposals for approval
          visibilityFilter.status = { $in: ['Division Submitted', 'Office', 'Office Approved'] };
        } else if (isBudgetManager) {
          // Budget Managers can only see consolidated proposals
          visibilityFilter.status = 'Office Submitted';
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
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

  // Super admin and budget admin can access everything
  if (isSuperAdmin || userRoles.includes('BUDGET_ADMIN')) {
    return true;
  }

  // Users can always access their own proposals
  if (proposal.createdByUserId === userId) {
    return true;
  }

  // Role-based access
  if (isBudgetOfficer && ['Division Submitted', 'Office', 'Office Approved'].includes(proposal.status)) {
    return true;
  }

  if (isBudgetManager && proposal.status === 'Office Submitted') {
    return true;
  }

  return false;
}

/**
 * Budget Proposal Workflow Controller
 * Implements hierarchical workflow with mandatory comments and user tracking
 */

// Submit proposal to Budget Officer
exports.submitProposal = async (req, res) => {
  try {
    const { proposalId, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.FirstName + ' ' + req.user.LastName;
    const userRoles = req.user.Roles || [];

    // First try to find by proposal ID (for consolidated proposals)
    let proposal = await Proposal.findById(proposalId);

    // If not found and proposalId looks like a personnel service ID, try to find the consolidated proposal
    if (!proposal) {
      console.log('Submit: Proposal not found by ID, checking if this is a personnel service ID:', proposalId);

      // Check if this ID belongs to a personnel service with Division Submitted status
      const PersonnelServices = require('../models/PersonnelServices');
      const personnelRecord = await PersonnelServices.findById(proposalId);

      if (personnelRecord && personnelRecord.status === 'Division Submitted') {
        console.log('Submit: Found personnel service record, looking for consolidated proposal');

        // Find the consolidated proposal based on organizational criteria
        proposal = await Proposal.findOne({
          division: personnelRecord.division,
          fiscalYear: personnelRecord.fiscalYear,
          budgetType: personnelRecord.budgetType,
          region: personnelRecord.region,
          status: 'Division Submitted'
        });

        if (proposal) {
          console.log('Submit: Found consolidated proposal:', proposal._id);
        } else {
          console.log('Submit: No consolidated proposal found for personnel service criteria');
        }
      }
    }

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Determine submitter role
    let submitterRole = 'BUDGET_ANALYST';
    if (userRoles.includes('BUDGET_COORDINATOR')) {
      submitterRole = 'BUDGET_COORDINATOR';
    }

    // Update proposal status
    const previousStatus = proposal.status;
    let newStatus = 'Division Submitted';
    let workflowLevel = 'OFFICER';

    if (submitterRole === 'BUDGET_COORDINATOR') {
      newStatus = 'Office';
      workflowLevel = 'OFFICER';
    }

    proposal.status = newStatus;
    proposal.workflowLevel = workflowLevel;
    proposal.submittedByRole = submitterRole;
    proposal.submittedDate = new Date();

    // Add to workflow history
    proposal.workflowHistory.push({
      action: 'SUBMIT',
      comment: comment || '',
      userId,
      userName,
      timestamp: new Date(),
      previousStatus,
      newStatus
    });

    await proposal.save();

    // Send notification to Budget Officer
    await sendNotification({
      recipientRole: 'BUDGET_OFFICER',
      title: 'New Proposal Submitted',
      message: `New proposal "${proposal.title}" submitted from ${proposal.division || proposal.department} by ${userName}`,
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
      message: 'Proposal submitted successfully',
      proposal: {
        id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
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

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for approval' });
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

    const previousStatus = proposal.status;
    let newStatus;
    let approvalField;

    if (userRoles.includes('BUDGET_OFFICER')) {
      newStatus = 'Office Approved';
      approvalField = 'approvedByOfficer';
      proposal.workflowLevel = 'OFFICER';
    } else if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) {
      newStatus = 'Finalized';
      approvalField = 'approvedByManager';
      proposal.workflowLevel = 'FINALIZED';
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to approve proposals' });
    }

    proposal.status = newStatus;
    proposal[approvalField] = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    // Add to workflow history
    proposal.workflowHistory.push({
      action: 'APPROVE',
      comment,
      userId,
      userName,
      timestamp: new Date(),
      previousStatus,
      newStatus
    });

    await proposal.save();

    // Send notification to submitter
    const submitterMessage = `Your proposal "${proposal.title}" has been approved by ${userName} with comment: ${comment}`;
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

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for return' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const previousStatus = proposal.status;
    const newStatus = 'Returned';
    let returnField;

    if (userRoles.includes('BUDGET_OFFICER')) {
      returnField = 'returnedByOfficer';
      proposal.workflowLevel = 'DIVISION';
    } else if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) {
      returnField = 'returnedByManager';
      proposal.workflowLevel = 'OFFICER';
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to return proposals' });
    }

    proposal.status = newStatus;
    proposal[returnField] = {
      userId,
      userName,
      date: new Date(),
      comment
    };

    // Add to workflow history
    proposal.workflowHistory.push({
      action: 'RETURN',
      comment,
      userId,
      userName,
      timestamp: new Date(),
      previousStatus,
      newStatus
    });

    await proposal.save();

    // Send notification to submitter
    const submitterMessage = `Your proposal "${proposal.title}" has been returned by ${userName} with comment: ${comment}`;
    await sendNotification({
      recipientUserId: proposal.createdByUserId,
      title: 'Proposal Returned',
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

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required for bulk approval' });
    }

    const proposals = await Proposal.find({ _id: { $in: proposalIds } });
    const updatedProposals = [];

    for (const proposal of proposals) {
      const previousStatus = proposal.status;
      proposal.status = 'Office Approved';
      proposal.workflowLevel = 'OFFICER';
      proposal.approvedByOfficer = {
        userId,
        userName,
        date: new Date(),
        comment
      };

      // Add to workflow history
      proposal.workflowHistory.push({
        action: 'APPROVE',
        comment,
        userId,
        userName,
        timestamp: new Date(),
        previousStatus,
        newStatus: 'Office Approved'
      });

      await proposal.save();
      updatedProposals.push({
        id: proposal._id,
        title: proposal.title,
        status: proposal.status
      });

      // Send notification to submitter
      const submitterMessage = `Your proposal "${proposal.title}" has been approved by ${userName} with comment: ${comment}`;
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
    const unapproved = proposals.filter(p => p.status !== 'Office Approved');
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

    // Create consolidated proposal
    const consolidatedProposal = new Proposal({
      title: consolidatedTitle,
      description: `Consolidated proposal from ${proposals.length} approved proposals`,
      fiscalYear,
      budgetType,
      region,
      department,
      processBy: userId,
      status: 'Office Submitted',
      workflowLevel: 'MANAGER',
      isConsolidated: true,
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
      submittedDate: new Date()
    });

    // Add consolidation to workflow history
    consolidatedProposal.workflowHistory.push({
      action: 'CONSOLIDATE',
      comment: `Consolidated ${proposals.length} proposals`,
      userId,
      userName,
      timestamp: new Date(),
      previousStatus: 'Draft',
      newStatus: 'Office Submitted'
    });

    await consolidatedProposal.save();

    // Update original proposals to mark as consolidated
    await Proposal.updateMany(
      { _id: { $in: proposalIds } },
      {
        $set: { isConsolidated: true },
        $push: {
          workflowHistory: {
            action: 'CONSOLIDATE',
            comment: `Included in consolidated proposal: ${consolidatedTitle}`,
            userId,
            userName,
            timestamp: new Date(),
            previousStatus: 'Office Approved',
            newStatus: 'Office Approved'
          }
        }
      }
    );

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

module.exports = {
  ...exports,
  budgetRoleAccessControl
};