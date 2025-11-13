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
  }
};

// Get user's role from request
const getUserRole = (req) => {
  console.log('[getUserRole] Full req.user object:', JSON.stringify(req.user, null, 2));
  const userRoles = req.user?.Roles || [];
  console.log('[getUserRole] User Roles from request:', userRoles);
  
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
      console.log('[getUserRole] Mapped role:', roleMapping[role]);
      return roleMapping[role];
    }
  }

  console.log('[getUserRole] No role mapping found for roles:', userRoles);
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
      amount: calculatedAmount,
      createdBy: req.user.id,
      createdByName: req.user.name || req.user.email,
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
      budgetType: modelType,
      region: region || 'CENTRAL OFFICE',
      department: department || '',
      division: division || '',
      originalDepartment: department || '',
      originalDivision: division || '',
      processBy: req.user.name || req.user.email,
      status: 'Draft',
      workflowLevel: 'BUDGET PREPARER',
      currentStep: 'PREPARER_DRAFT',
      proposalId: proposal._id.toString(),  // Link to NewProposalWorkflow
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id,
      createdByName: req.user.name || req.user.email
    };

    const legacyProposal = new Proposal(legacyProposalData);
    await legacyProposal.save();

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
        query.createdBy = userId;  // Use userId for NewProposalWorkflow
        query.status = 'DRAFT';     // Use DRAFT enum value
        break;
      case 'pending-review':
        console.log('[PENDING-REVIEW] User Role:', userRole);
        if (userRole && WORKFLOW_TRANSITIONS[userRole]) {
          const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole]);
          console.log('[PENDING-REVIEW] Allowed Statuses (enum):', allowedStatuses);
          const pendingStatuses = allowedStatuses.filter(status => status !== 'DRAFT');
          console.log('[PENDING-REVIEW] Pending Statuses (after filter):', pendingStatuses);
          
          if (pendingStatuses.length === 0) {
            console.log('[PENDING-REVIEW] No pending statuses, returning empty array');
            return res.json({
              success: true,
              proposals: [],
              pagination: { page: 1, limit: 10, total: 0, pages: 0 }
            });
          }
          query.status = { $in: pendingStatuses };  // Use enum statuses directly
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
        query.status = { $ne: 'DRAFT' };  // Use DRAFT enum
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

    // Manual pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log('[GET PROPOSALS] View:', view);
    console.log('[GET PROPOSALS] User ID:', userId);
    console.log('[GET PROPOSALS] User Name:', userName);
    console.log('[GET PROPOSALS] User Role:', userRole);
    console.log('[GET PROPOSALS] Final Query:', JSON.stringify(query));

    // Query NewProposalWorkflow model directly
    const total = await NewProposalWorkflow.countDocuments(query);
    const proposals = await NewProposalWorkflow.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('region', 'name regionName');

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

    console.log('[PERFORM_ACTION] User:', { userRole, userId, userName });
    console.log('[PERFORM_ACTION] Request:', { proposalId: id, action, comment });

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
      'RETURNED_TO_APPROVER': 'Returned',
      'RETURNED_TO_PLANNING_ANALYST': 'Returned to Budget Planning Analyst',
      'RETURNED_TO_OFFICER': 'Returned to Budget Officer'
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
    const userName = req.user.name || req.user.email;

    const proposal = await NewProposalWorkflow.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Only allow editing if user is the creator and status is DRAFT, or user has BRD roles
    const isBRDStaff = ['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST', 'BUDGET OFFICER', 'BUDGET_OFFICER', 'BUDGET MANAGER', 'BUDGET_MANAGER'].includes(userRole);
    const isCreatorEditingDraft = proposal.createdBy === userId && proposal.status === 'DRAFT';
    
    if (!isCreatorEditingDraft && !isBRDStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this proposal'
      });
    }

    const allowedFields = ['title', 'description', 'modelType', 'fiscalYear', 'amount', 'income', 'personnel', 'mooe', 'capitalOutlay'];
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

    // Filter workflow history to include only edits and field changes
    const auditTrail = proposal.workflowHistory
      .filter(entry => entry.action === 'EDIT' || entry.changeType === 'PROPOSAL_EDIT' || entry.changes)
      .map(entry => ({
        action: entry.action,
        performedBy: entry.performedByName,
        role: entry.position,
        timestamp: entry.timestamp,
        changedFields: entry.changes ? Object.keys(entry.changes) : [],
        details: entry.changes || {},
        comment: entry.comment
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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