const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const User = require('../models/User');

// Workflow status transitions based on the specification
const WORKFLOW_TRANSITIONS = {
  'BUDGET PREPARER': {
    'DRAFT': {
      'submit-to-reviewer': 'FORWARDED_TO_REVIEWER'
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
    }
  },
  'BUDGET MANAGER': {
    'FORWARDED_TO_BRD_MANAGER': {
      'finalize': 'FINALIZED',
      'return-to-officer': 'RETURNED_TO_OFFICER'
    }
  }
};

// Get user's role from request
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
    'SUPER_ADMIN': 'SUPER ADMIN',
    'SUPER ADMIN': 'SUPER ADMIN'
  };

  for (const role of userRoles) {
    if (roleMapping[role]) {
      return roleMapping[role];
    }
  }

  return null;
};

// Check if user can perform action on proposal
const canPerformAction = (userRole, proposal, action) => {
  if (userRole === 'SUPER ADMIN') return true;

  const transitions = WORKFLOW_TRANSITIONS[userRole];
  if (!transitions) return false;

  // Map status from Proposal format to workflow format
  const statusMapping = {
    'Draft': 'DRAFT',
    'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
    'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
    'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
    'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
    'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
    'Finalized': 'FINALIZED',
    'Returned': 'RETURNED_TO_PREPARER'
  };

  const workflowStatus = statusMapping[proposal.status] || proposal.status;
  return transitions[workflowStatus] && transitions[workflowStatus][action];
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
      projectedSubsidy 
    } = req.body;

    // Validate modelType - Updated to use new valid types
    const validModelTypes = ['Initial', 'NEP', 'GAA'];
    if (!validModelTypes.includes(modelType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid modelType. Must be one of: ${validModelTypes.join(', ')}`
      });
    }

    // Calculate the proposed budget amount
    const calculatedAmount = (Number(projectedCorporateIncome) || 0) + (Number(projectedSubsidy) || 0);

    const proposalData = {
      title,
      description,
      modelType,
      fiscalYear,
      projectedCorporateIncome: Number(projectedCorporateIncome) || 0,
      projectedSubsidy: Number(projectedSubsidy) || 0,
      amount: calculatedAmount, // Use the calculated amount
      createdBy: req.user.id,
      createdByName: req.user.name || req.user.email,
      status: 'DRAFT'
    };

    const proposal = new NewProposalWorkflow(proposalData);
    await proposal.save();

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
    console.log('[GET PROPOSALS] req.user object:', JSON.stringify(req.user, null, 2));
    const userRole = getUserRole(req);
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.FirstName || ''} ${req.user.LastName || ''}`.trim();
    const { status, modelType, fiscalYear, page = 1, limit = 10, view } = req.query;

    let query = {};

    // Apply standard filters
    if (status) query.status = status;
    if (modelType) query.modelType = modelType;
    if (fiscalYear) query.fiscalYear = parseInt(fiscalYear);

    // Apply view-based and role-based filtering
    switch (view) {
      case 'my-proposals':
        query.createdBy = userName;
        // Only show DRAFT proposals in "My Proposals" tab for Budget Preparer
        query.status = 'Draft';
        break;
      case 'pending-review':
        console.log('[PENDING-REVIEW] User Role:', userRole);
        if (userRole && WORKFLOW_TRANSITIONS[userRole]) {
          const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole]);
          console.log('[PENDING-REVIEW] Allowed Statuses (enum):', allowedStatuses);
          const pendingStatuses = allowedStatuses.filter(status => status !== 'DRAFT');
          console.log('[PENDING-REVIEW] Pending Statuses (after filter):', pendingStatuses);
          
          // Map enum statuses to human-readable statuses
          const statusMapping = {
            'DRAFT': 'Draft',
            'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
            'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
            'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
            'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
            'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
            'FINALIZED': 'Finalized',
            'RETURNED_TO_PREPARER': 'Returned',
            'RETURNED_TO_REVIEWER': 'Returned',
            'RETURNED_TO_APPROVER': 'Returned',
            'RETURNED_TO_PLANNING_ANALYST': 'Returned',
            'RETURNED_TO_OFFICER': 'Returned'
          };
          
          const mappedStatuses = pendingStatuses.map(s => statusMapping[s] || s);
          console.log('[PENDING-REVIEW] Mapped Statuses:', mappedStatuses);
          
          if (mappedStatuses.length === 0) {
            console.log('[PENDING-REVIEW] No pending statuses, returning empty array');
            return res.json({
              success: true,
              proposals: [],
              pagination: { page: 1, limit: 10, total: 0, pages: 0 }
            });
          }
          query.status = { $in: mappedStatuses };
          console.log('[PENDING-REVIEW] Query:', JSON.stringify(query));
        } else {
          console.log('[PENDING-REVIEW] No user role or transitions, returning empty array');
          return res.json({
            success: true,
            proposals: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 }
          });
        }
        break;
      case 'all-proposals':
        query.status = { $ne: 'Draft' };
        if (userRole !== 'SUPER ADMIN' && userRole !== 'BUDGET MANAGER') {
          // Restrict 'all' view for non-admins, e.g., to their region/department
          // This logic can be expanded based on hierarchical assignments
        }
        break;
      default:
        // Default to 'my-proposals' if view is not specified
        query.createdBy = userId;
        break;
    }

    // Map status from NewProposalWorkflow format to Proposal format
    const statusMapping = {
      'DRAFT': 'Draft',
      'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
      'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
      'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
      'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
      'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
      'FINALIZED': 'Finalized',
      'RETURNED_TO_PREPARER': 'Returned',
      'RETURNED_TO_REVIEWER': 'Returned',
      'RETURNED_TO_APPROVER': 'Returned',
      'RETURNED_TO_PLANNING_ANALYST': 'Returned',
      'RETURNED_TO_OFFICER': 'Returned'
    };

    // Convert query status to Proposal format
    if (query.status && typeof query.status === 'string') {
      query.status = statusMapping[query.status] || query.status;
    } else if (query.status && query.status.$in) {
      query.status.$in = query.status.$in.map(s => statusMapping[s] || s);
    } else if (query.status && query.status.$ne) {
      query.status.$ne = statusMapping[query.status.$ne] || query.status.$ne;
    }

    // Convert createdBy to processBy for Proposal model
    if (query.createdBy) {
      query.processBy = query.createdBy;
      delete query.createdBy;
    }

    // Manual pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log('[GET PROPOSALS] View:', view);
    console.log('[GET PROPOSALS] User ID:', userId);
    console.log('[GET PROPOSALS] User Name:', userName);
    console.log('[GET PROPOSALS] User Role:', userRole);
    console.log('[GET PROPOSALS] Final Query:', JSON.stringify(query));

    const total = await Proposal.countDocuments(query);
    const proposals = await Proposal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    console.log('[GET PROPOSALS] Total found:', total);
    console.log('[GET PROPOSALS] Proposals returned:', proposals.length);

    res.json({
      success: true,
      proposals: proposals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
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

    const proposal = await NewProposalWorkflow.findById(id)
      .populate('region', 'name regionName');

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

    res.json({
      success: true,
      data: proposal
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
    const userName = req.user.name || req.user.email;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Map status from Proposal format to workflow format for validation
    const statusMapping = {
      'Draft': 'DRAFT',
      'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
      'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
      'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
      'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
      'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
      'Finalized': 'FINALIZED',
      'Returned': 'RETURNED_TO_PREPARER'
    };

    const workflowStatus = statusMapping[proposal.status] || proposal.status;

    // Check if user can perform this action
    if (!canPerformAction(userRole, proposal, action)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action'
      });
    }

    const transitions = WORKFLOW_TRANSITIONS[userRole];
    if (!transitions || !transitions[workflowStatus] || !transitions[workflowStatus][action]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action for current status'
      });
    }

    const newWorkflowStatus = transitions[workflowStatus][action];

    // Map status back from workflow format to Proposal format
    const reverseStatusMapping = {
      'DRAFT': 'Draft',
      'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
      'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
      'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
      'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
      'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
      'FINALIZED': 'Finalized',
      'RETURNED_TO_PREPARER': 'Returned',
      'RETURNED_TO_REVIEWER': 'Returned',
      'RETURNED_TO_APPROVER': 'Returned'
    };

    const newStatus = reverseStatusMapping[newWorkflowStatus] || newWorkflowStatus;

    // Update proposal
    const oldStatus = proposal.status;
    proposal.status = newStatus;
    proposal.workflowHistory = proposal.workflowHistory || [];
    proposal.workflowHistory.push({
      action,
      fromStatus: oldStatus,
      toStatus: newStatus,
      performedBy: userId,
      performedByName: userName,
      comment: comment || ''
    });

    await proposal.save();

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

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Only allow editing if user is the creator and status is DRAFT
    if (proposal.createdBy !== userId || proposal.status !== 'DRAFT') {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own draft proposals'
      });
    }

    const allowedFields = ['title', 'description', 'modelType', 'fiscalYear', 'amount'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedProposal = await NewProposalWorkflow.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Proposal updated successfully',
      data: updatedProposal
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

// Delete proposal (only for drafts by creator)
exports.deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Only allow deletion if user is the creator and status is DRAFT
    if (proposal.createdBy !== userId || proposal.status !== 'DRAFT') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own draft proposals'
      });
    }

    await NewProposalWorkflow.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Proposal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete proposal',
      error: error.message
    });
  }
};