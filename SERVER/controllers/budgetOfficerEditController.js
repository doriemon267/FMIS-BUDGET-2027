const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const ProposalEditLog = require('../models/ProposalEditLog');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const { createNotification } = require('./notificationController');
const { resolveUserIdentity, getClientIp } = require('../utils/requestContext');

const buildRequestAuditContext = async (req) => {
  const user = req.user || {};
  const identity = req.identity || await resolveUserIdentity({ req });

  const usernameArray = Array.isArray(user.Username)
    ? user.Username
    : user.Username
    ? [user.Username]
    : [];

  const candidateIds = [
    identity?.userId,
    user.userId,
    user.id,
    user.Id,
    user.userCode,
    usernameArray[0],
    user.username,
    user.name
  ].filter(Boolean);

  const userId = candidateIds.length ? String(candidateIds[0]).trim() : null;
  const userName = (identity?.displayName || user.displayName || user.fullName || user.name || user.username || userId || 'Unknown user').toString();
  const email = identity?.email || user.email || null;
  const ipAddress = req.clientIp || getClientIp(req);
  const roles = Array.isArray(user.Roles) ? user.Roles : user.Roles ? [user.Roles] : [];

  return {
    userId,
    userName,
    email,
    ipAddress,
    roles,
    identitySource: identity?.source || user.identitySource || null
  };
};

/**
 * Deep equality comparison function
 * Handles type coercion for numbers/strings and nested objects/arrays
 */
const isEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
};

/**
 * Get proposal data for Budget Officer to edit
 * This fetches all 4 tables: Income, Personnel Services, MOOE, Capital Outlay
 */
exports.getProposalForEdit = async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, region, processBy } = req.query;
    
    if (!proposalId && (!fiscalYear || !budgetType || !region || !processBy)) {
      return res.status(400).json({
        success: false,
        message: 'Either proposalId or (fiscalYear, budgetType, region, processBy) is required'
      });
    }
    
    // Find the proposal
    let proposal;
    if (proposalId) {
      proposal = await Proposal.findById(proposalId);
    } else {
      proposal = await Proposal.findOne({ fiscalYear, budgetType, region, processBy });
    }
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // Get user roles
    const userRoles = req.user?.Roles || [];
    const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    
    // Check if proposal is already submitted or approved - prevent further editing
    // BUDGET_MANAGER can view "Office Submitted" proposals (to approve/reject)
    // BUDGET_OFFICER cannot edit "Office Submitted", "Office Approved", or "Approved" proposals
    if (proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be edited',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Office Approved' || proposal.status === 'Approved') {
      // Block everyone from editing approved proposals
      return res.status(403).json({
        success: false,
        message: 'This proposal has already been approved and cannot be edited',
        proposalStatus: proposal.status
      });
    }
    
    // Check if there's an existing draft edit
    const existingEdit = await BudgetOfficerEdit.findOne({
      proposalId: proposal._id,
      status: 'Draft'
    });
    
    // Fetch all data for the proposal
    const queryParams = {
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      processBy: proposal.processBy
    };
    
    const [income, personnelServices, mooe, capitalOutlayRaw] = await Promise.all([
      Income.find(queryParams).lean(),
      PersonnelServices.find(queryParams).lean(),
      MOOE.find(queryParams).lean(),
  CapitalOutlay.find(queryParams).populate('category', 'categoryName sublineItems').lean()
    ]);
    
    // Fetch CapitalOutlayDetails for each CapitalOutlay item
    const capitalOutlay = await Promise.all(
      capitalOutlayRaw.map(async (co) => {
        const details = await CapitalOutlayDetails.find({ 
          capital_outlay_id: co._id 
        }).lean();
        
        // Combine all particulars from details array
        const combinedParticulars = details
          .map(d => d.particulars)
          .filter(Boolean)
          .join('; ');
        
        // Sum up all income and subsidy amounts from details
        const totalIncome = details.reduce((sum, d) => sum + (d.income_amount || 0), 0);
        const totalSubsidy = details.reduce((sum, d) => sum + (d.subsidy_amount || 0), 0);
        
        // Merge details into the capital outlay object
        const merged = {
          ...co,
          details: details, // Array of all details
          particulars: combinedParticulars || '',
          income: totalIncome || co.income || 0,
          subsidy: totalSubsidy || co.subsidy || 0,
          cost: totalIncome + totalSubsidy,
          categoryName: co.category?.categoryName || co.categoryName || ''
        };
        
        console.log('Capital Outlay merged data:', {
          id: co._id,
          categoryName: merged.categoryName,
          particulars: merged.particulars,
          detailsCount: details.length,
          totalIncome,
          totalSubsidy
        });
        
        return merged;
      })
    );
    
    console.log(`Fetched ${capitalOutlay.length} Capital Outlay items with details`);
    
    // If there's an existing draft, merge it with the original data
    let responseData = {
      proposal: proposal.toObject(),
      income,
      personnelServices,
      mooe,
      capitalOutlay,
      hasExistingEdit: !!existingEdit,
      existingEditId: existingEdit?._id
    };
    
    if (existingEdit) {
      // Merge edited data with original data
      responseData.editedData = {
        income: existingEdit.editedIncome,
        personnelServices: existingEdit.editedPersonnelServices,
        mooe: existingEdit.editedMOOE,
        capitalOutlay: existingEdit.editedCapitalOutlay
      };
      responseData.editComments = existingEdit.comments;
      responseData.editStatus = existingEdit.status;
    }
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Error fetching proposal for edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal data',
      error: error.message
    });
  }
};

/**
 * Save Budget Officer edits as draft
 */
exports.saveDraftEdit = async (req, res) => {
  try {
    console.log('=== Save Draft Edit Request ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User object:', req.user);
    
    const {
      proposalId,
      editedIncome,
      editedPersonnelServices,
      editedMOOE,
      editedCapitalOutlay,
      comments
    } = req.body;
    
    console.log('Extracted data:', {
      proposalId,
      editedIncomeLength: editedIncome?.length,
      editedPersonnelServicesLength: editedPersonnelServices?.length,
      editedMOOELength: editedMOOE?.length,
      editedCapitalOutlayLength: editedCapitalOutlay?.length,
      comments
    });
    
    const auditContext = await buildRequestAuditContext(req);
    
    if (!auditContext.userId) {
      console.error('ERROR: Unable to resolve user identity for request');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
  const { userId, userName, email: userEmail, ipAddress, roles } = auditContext;
    
    console.log('User info:', { userId, userName, userEmail, ipAddress });
    
    // Find the proposal
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // Get user roles
    const userRoles = req.user?.Roles || [];
    const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    
    // Check if proposal is already submitted or approved - prevent further editing
    // BUDGET_MANAGER can view "Office Submitted" proposals (to approve/reject)
    // BUDGET_OFFICER cannot edit "Office Submitted", "Office Approved", or "Approved" proposals
    if (proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be edited',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Office Approved' || proposal.status === 'Approved') {
      // Block everyone from editing approved proposals
      return res.status(403).json({
        success: false,
        message: 'This proposal has already been approved and cannot be edited',
        proposalStatus: proposal.status
      });
    }
    
    console.log('Proposal found:', {
      _id: proposal._id,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      processBy: proposal.processBy,
      cobExpenditures: proposal.cobExpenditures
    });
    
    // Check if there's an existing draft
    let budgetOfficerEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: 'Draft'
    });
    
    if (budgetOfficerEdit) {
      // Update existing draft
      budgetOfficerEdit.editedIncome = editedIncome || [];
      budgetOfficerEdit.editedPersonnelServices = editedPersonnelServices || [];
      budgetOfficerEdit.editedMOOE = editedMOOE || [];
      budgetOfficerEdit.editedCapitalOutlay = editedCapitalOutlay || [];
      budgetOfficerEdit.comments = comments;
      budgetOfficerEdit.updatedAt = new Date();
    } else {
      // Create new draft
      budgetOfficerEdit = new BudgetOfficerEdit({
        proposalId,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        processBy: proposal.processBy,
        cobExpenditures: proposal.cobExpenditures || '',
        status: 'Draft',
        editedIncome: editedIncome || [],
        editedPersonnelServices: editedPersonnelServices || [],
        editedMOOE: editedMOOE || [],
        editedCapitalOutlay: editedCapitalOutlay || [],
        comments,
        editedBy: {
          userId,
          userName,
          email: userEmail
        }
      });
    }
    
    console.log('BudgetOfficerEdit object created/updated:', {
      _id: budgetOfficerEdit._id,
      proposalId: budgetOfficerEdit.proposalId,
      status: budgetOfficerEdit.status,
      cobExpenditures: budgetOfficerEdit.cobExpenditures
    });
    
    await budgetOfficerEdit.save();
    
    // Log the action
    await ProposalEditLog.logChange({
      proposalId,
      budgetOfficerEditId: budgetOfficerEdit._id,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      changeType: 'UPDATE',
      entityType: 'Proposal',
      changedBy: {
        userId,
        userName,
        email: userEmail,
        role: roles && roles.length ? roles[0] : 'BUDGET_OFFICER'
      },
      summary: 'Saved draft edits',
      comments,
      ipAddress,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: {
        _id: budgetOfficerEdit._id,
        proposalId: budgetOfficerEdit.proposalId,
        fiscalYear: budgetOfficerEdit.fiscalYear,
        budgetType: budgetOfficerEdit.budgetType,
        region: budgetOfficerEdit.region,
        department: budgetOfficerEdit.department,
        division: budgetOfficerEdit.division,
        processBy: budgetOfficerEdit.processBy,
        cobExpenditures: budgetOfficerEdit.cobExpenditures,
        status: budgetOfficerEdit.status,
        editedBy: budgetOfficerEdit.editedBy,
        createdAt: budgetOfficerEdit.createdAt,
        updatedAt: budgetOfficerEdit.updatedAt,
        changeSummary: budgetOfficerEdit.getChangeSummary()
      }
    });
    
  } catch (error) {
    console.error('=== Error saving draft edit ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : undefined
    });
  }
};

/**
 * Submit Budget Officer edits for approval
 */
exports.submitEdit = async (req, res) => {
  try {
    const {
      proposalId,
      editedIncome,
      editedPersonnelServices,
      editedMOOE,
      editedCapitalOutlay,
      comments
    } = req.body;
    
    const auditContext = await buildRequestAuditContext(req);
    if (!auditContext.userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    const { userId, userName, email: userEmail, ipAddress, roles } = auditContext;
    
    // Find the proposal
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // Get user roles
    const userRoles = req.user?.Roles || [];
    const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    
    // Check if proposal is already submitted or approved - prevent further editing
    // BUDGET_MANAGER can view "Office Submitted" proposals (to approve/reject)
    // BUDGET_OFFICER cannot submit "Office Submitted", "Office Approved", or "Approved" proposals
    if (proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER from submitting
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be submitted again',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Office Approved' || proposal.status === 'Approved') {
      // Block everyone from submitting approved proposals
      return res.status(403).json({
        success: false,
        message: 'This proposal has already been approved and cannot be submitted again',
        proposalStatus: proposal.status
      });
    }
    
    // Check if there's already a submitted or approved edit for this proposal
    const existingSubmittedEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: { $in: ['Submitted', 'Approved'] }
    });
    
    if (existingSubmittedEdit) {
      return res.status(400).json({
        success: false,
        message: 'This proposal already has a submitted edit. Cannot submit again.',
        existingEditStatus: existingSubmittedEdit.status
      });
    }
    
    // Check if there's an existing draft
    let budgetOfficerEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: 'Draft'
    });
    
    if (budgetOfficerEdit) {
      // Update and submit existing draft
      budgetOfficerEdit.editedIncome = editedIncome || [];
      budgetOfficerEdit.editedPersonnelServices = editedPersonnelServices || [];
      budgetOfficerEdit.editedMOOE = editedMOOE || [];
      budgetOfficerEdit.editedCapitalOutlay = editedCapitalOutlay || [];
      budgetOfficerEdit.comments = comments;
      budgetOfficerEdit.status = 'Submitted';
      budgetOfficerEdit.submittedAt = new Date();
    } else {
      // Create and submit new edit
      budgetOfficerEdit = new BudgetOfficerEdit({
        proposalId,
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        region: proposal.region,
        department: proposal.department,
        division: proposal.division,
        processBy: proposal.processBy,
        cobExpenditures: proposal.cobExpenditures || '',
        status: 'Submitted',
        editedIncome: editedIncome || [],
        editedPersonnelServices: editedPersonnelServices || [],
        editedMOOE: editedMOOE || [],
        editedCapitalOutlay: editedCapitalOutlay || [],
        comments,
        editedBy: {
          userId,
          userName,
          email: userEmail
        },
        submittedAt: new Date()
      });
    }
    
    await budgetOfficerEdit.save();
    
    // Update proposal status
    proposal.status = 'Office Submitted';
    proposal.workflowLevel = 'OFFICER';
    proposal.workflowHistory.push({
      action: 'EDIT',
      comment: comments || 'Budget Officer submitted edits',
      userId,
      userName,
      timestamp: new Date(),
      previousStatus: proposal.status,
      newStatus: 'Office Submitted'
    });
    
    await proposal.save();
    
    // Log the action
    await ProposalEditLog.logChange({
      proposalId,
      budgetOfficerEditId: budgetOfficerEdit._id,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      changeType: 'UPDATE',
      entityType: 'Proposal',
      changedBy: {
        userId,
        userName,
        email: userEmail,
        role: roles && roles.length ? roles[0] : 'BUDGET_OFFICER'
      },
      summary: 'Submitted edits for approval',
      comments,
      ipAddress,
      userAgent: req.get('user-agent')
    });
    
    // Create notification for Budget Analyst
    if (proposal.processBy) {
      await createNotification({
        userId: proposal.processBy,
        type: 'PROPOSAL_EDITED',
        title: 'Proposal Edited by Budget Officer',
        message: `Your proposal for ${proposal.fiscalYear} - ${proposal.budgetType} has been edited by Budget Officer ${userName}`,
        relatedId: proposalId,
        relatedType: 'Proposal',
        metadata: {
          proposalId,
          fiscalYear: proposal.fiscalYear,
          budgetType: proposal.budgetType,
          editedBy: userName,
          changeSummary: budgetOfficerEdit.getChangeSummary()
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Edits submitted successfully',
      data: {
        _id: budgetOfficerEdit._id,
        proposalId: budgetOfficerEdit.proposalId,
        fiscalYear: budgetOfficerEdit.fiscalYear,
        budgetType: budgetOfficerEdit.budgetType,
        region: budgetOfficerEdit.region,
        department: budgetOfficerEdit.department,
        division: budgetOfficerEdit.division,
        processBy: budgetOfficerEdit.processBy,
        cobExpenditures: budgetOfficerEdit.cobExpenditures,
        status: budgetOfficerEdit.status,
        editedBy: budgetOfficerEdit.editedBy,
        submittedAt: budgetOfficerEdit.submittedAt,
        changeSummary: budgetOfficerEdit.getChangeSummary()
      }
    });
    
  } catch (error) {
    console.error('Error submitting edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit edits',
      error: error.message
    });
  }
};

/**
 * Get Budget Officer edit by ID
 */
exports.getEditById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const edit = await BudgetOfficerEdit.findById(id)
      .populate('proposalId')
      .lean();
    
    if (!edit) {
      return res.status(404).json({
        success: false,
        message: 'Edit not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        _id: edit._id,
        proposalId: edit.proposalId,
        fiscalYear: edit.fiscalYear,
        budgetType: edit.budgetType,
        region: edit.region,
        department: edit.department,
        division: edit.division,
        processBy: edit.processBy,
        cobExpenditures: edit.cobExpenditures,
        status: edit.status,
        editedBy: edit.editedBy,
        submittedAt: edit.submittedAt,
        approvedAt: edit.approvedAt,
        approvedBy: edit.approvedBy,
        createdAt: edit.createdAt,
        updatedAt: edit.updatedAt,
        changeSummary: edit.getChangeSummary()
      }
    });
    
  } catch (error) {
    console.error('Error fetching edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch edit',
      error: error.message
    });
  }
};

/**
 * Get edits for a specific proposal
 */
exports.getEditsByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const edits = await BudgetOfficerEdit.find({ proposalId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: edits
    });
    
  } catch (error) {
    console.error('Error fetching edits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch edits',
      error: error.message
    });
  }
};

/**
 * Get comparison data for Budget Analyst
 * Shows original vs edited data with highlights
 */
exports.getComparisonData = async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    // Find the proposal
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // Find the latest submitted or approved edit
    const edit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: { $in: ['Submitted', 'Approved'] }
    }).sort({ submittedAt: -1 });
    
    if (!edit) {
      return res.status(404).json({
        success: false,
        message: 'No edits found for this proposal'
      });
    }
    
    // Fetch original data
    const queryParams = {
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      processBy: proposal.processBy
    };
    
    const [originalIncome, originalPS, originalMOOE, originalCORaw] = await Promise.all([
      Income.find(queryParams).lean(),
      PersonnelServices.find(queryParams).lean(),
      MOOE.find(queryParams).lean(),
  CapitalOutlay.find(queryParams).populate('category', 'categoryName name sublineItems').lean()
    ]);
    
    // Fetch CapitalOutlayDetails for comparison
    const originalCO = await Promise.all(
      originalCORaw.map(async (co) => {
        const details = await CapitalOutlayDetails.find({ 
          capital_outlay_id: co._id 
        }).lean();
        
        // Combine all particulars from details array
        const combinedParticulars = details
          .map(d => d.particulars)
          .filter(Boolean)
          .join('; ');
        
        // Sum up all income and subsidy amounts from details
        const totalIncome = details.reduce((sum, d) => sum + (d.income_amount || 0), 0);
        const totalSubsidy = details.reduce((sum, d) => sum + (d.subsidy_amount || 0), 0);
        
        return {
          ...co,
          details: details,
          particulars: combinedParticulars || '',
          income: totalIncome || co.income || 0,
          subsidy: totalSubsidy || co.subsidy || 0,
          cost: totalIncome + totalSubsidy,
          categoryName: co.category?.categoryName || co.categoryName || co.category?.name || ''
        };
      })
    );
    
    // Helper function to compare and highlight changes
    const compareData = (original = [], edited = []) => {
      const comparison = [];
      const originalMap = new Map();
      const processedOriginalIds = new Set();

      original.forEach(item => {
        if (item?._id) {
          originalMap.set(item._id.toString(), item);
        }
      });

      const sanitizeKey = (key) => (
        ['_id', 'originalId', 'changeType', 'originalValues', '__v', 'createdAt', 'updatedAt'].includes(key)
      );

      edited.forEach(editedItem => {
        const changeType = editedItem?.changeType || (editedItem?.originalId ? 'modified' : 'added');
        let matchKey = null;
        let originalItem = null;

        if (editedItem?.originalId) {
          matchKey = editedItem.originalId.toString();
          originalItem = originalMap.get(matchKey) || null;
        }

        if (!originalItem && editedItem?._id) {
          const fallbackKey = editedItem._id.toString();
          if (originalMap.has(fallbackKey)) {
            matchKey = fallbackKey;
            originalItem = originalMap.get(fallbackKey) || null;
            if (!editedItem.originalId) {
              editedItem.originalId = fallbackKey;
            }
          }
        }

        if ((changeType === 'added' && !originalItem) || (!originalItem && !matchKey)) {
          comparison.push({
            type: 'added',
            edited: editedItem,
            original: null
          });
          return;
        }

        if (changeType === 'deleted' && originalItem) {
          comparison.push({
            type: 'deleted',
            edited: null,
            original: originalItem
          });
          if (matchKey) {
            processedOriginalIds.add(matchKey);
            originalMap.delete(matchKey);
          }
          return;
        }

        if (!originalItem) {
          // If we couldn't match the original but changeType isn't added/deleted, treat as added fallback
          comparison.push({
            type: 'added',
            edited: editedItem,
            original: null
          });
          return;
        }

        // Prepare original values for comparison if not provided
        if (!editedItem.originalValues) {
          editedItem.originalValues = { ...originalItem };
        }

        const changes = {};
        const allKeys = new Set([
          ...Object.keys(originalItem || {}),
          ...Object.keys(editedItem || {})
        ]);

        allKeys.forEach(key => {
          if (sanitizeKey(key)) return;
          const newValue = editedItem[key];
          const oldValue = originalItem[key];
          if (!isEqual(newValue, oldValue)) {
            changes[key] = {
              old: oldValue,
              new: newValue,
              increased: typeof newValue === 'number' && typeof oldValue === 'number'
                ? newValue > oldValue
                : null
            };
          }
        });

        const hasChanges = Object.keys(changes).length > 0;
        const entryType = changeType === 'unchanged' || !hasChanges ? 'unchanged' : 'modified';

        comparison.push({
          type: entryType,
          edited: editedItem,
          original: originalItem,
          changes: hasChanges ? changes : undefined
        });

        if (matchKey) {
          processedOriginalIds.add(matchKey);
          originalMap.delete(matchKey);
        }
      });

      // Remaining originals that weren't explicitly processed should be marked as unchanged
      originalMap.forEach((item, id) => {
        if (processedOriginalIds.has(id)) return;
        comparison.push({
          type: 'unchanged',
          edited: null,
          original: item
        });
      });

      return comparison;
    };
    
    const comparisonData = {
      proposal: proposal.toObject(),
      edit: edit.toObject(),
      income: compareData(originalIncome, edit.editedIncome),
      personnelServices: compareData(originalPS, edit.editedPersonnelServices),
      mooe: compareData(originalMOOE, edit.editedMOOE),
      capitalOutlay: compareData(originalCO, edit.editedCapitalOutlay),
      changeSummary: edit.getChangeSummary()
    };
    
    res.json({
      success: true,
      data: comparisonData
    });
    
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison data',
      error: error.message
    });
  }
};

/**
 * Approve Budget Officer edits (by Budget Manager or higher authority)
 * This will apply the changes to the original collections
 */
exports.approveEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    
    const auditContext = await buildRequestAuditContext(req);
    if (!auditContext.userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    const { userId, userName, email: userEmail, ipAddress, roles } = auditContext;
    
    const edit = await BudgetOfficerEdit.findById(id);
    if (!edit) {
      return res.status(404).json({
        success: false,
        message: 'Edit not found'
      });
    }
    
    if (edit.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted edits can be approved'
      });
    }
    
    // Apply changes to original collections
    // This is a complex operation that should be done in a transaction
    let session;
    try {
      session = await BudgetOfficerEdit.startSession();
      session.startTransaction();
      
      // Apply Income changes
      for (const item of edit.editedIncome) {
        if (item.changeType === 'added') {
          const newIncome = new Income({
            ...item,
            fiscalYear: edit.fiscalYear,
            budgetType: edit.budgetType,
            region: edit.region,
            processBy: edit.processBy
          });
          await newIncome.save({ session });
        } else if (item.changeType === 'modified' && item.originalId) {
          await Income.findByIdAndUpdate(item.originalId, item, { session });
        } else if (item.changeType === 'deleted' && item.originalId) {
          await Income.findByIdAndDelete(item.originalId, { session });
        }
      }
      
      // Apply Personnel Services changes
      for (const item of edit.editedPersonnelServices) {
        if (item.changeType === 'added') {
          const newPS = new PersonnelServices({
            ...item,
            fiscalYear: edit.fiscalYear,
            budgetType: edit.budgetType,
            region: edit.region,
            processBy: edit.processBy
          });
          await newPS.save({ session });
        } else if (item.changeType === 'modified' && item.originalId) {
          await PersonnelServices.findByIdAndUpdate(item.originalId, item, { session });
        } else if (item.changeType === 'deleted' && item.originalId) {
          await PersonnelServices.findByIdAndDelete(item.originalId, { session });
        }
      }
      
      // Apply MOOE changes
      for (const item of edit.editedMOOE) {
        if (item.changeType === 'added') {
          const newMOOE = new MOOE({
            ...item,
            fiscalYear: edit.fiscalYear,
            budgetType: edit.budgetType,
            region: edit.region,
            processBy: edit.processBy
          });
          await newMOOE.save({ session });
        } else if (item.changeType === 'modified' && item.originalId) {
          await MOOE.findByIdAndUpdate(item.originalId, item, { session });
        } else if (item.changeType === 'deleted' && item.originalId) {
          await MOOE.findByIdAndDelete(item.originalId, { session });
        }
      }
      
      // Apply Capital Outlay changes
      for (const item of edit.editedCapitalOutlay) {
        if (item.changeType === 'added') {
          const newCO = new CapitalOutlay({
            ...item,
            fiscalYear: edit.fiscalYear,
            budgetType: edit.budgetType,
            region: edit.region,
            processBy: edit.processBy
          });
          await newCO.save({ session });
        } else if (item.changeType === 'modified' && item.originalId) {
          await CapitalOutlay.findByIdAndUpdate(item.originalId, item, { session });
        } else if (item.changeType === 'deleted' && item.originalId) {
          await CapitalOutlay.findByIdAndDelete(item.originalId, { session });
        }
      }
      
      // Update edit status
      edit.status = 'Approved';
      edit.approvedBy = {
        userId,
        userName,
        email: userEmail,
        date: new Date(),
        comments
      };
      edit.approvedAt = new Date();
      await edit.save({ session });
      
      // Update proposal
      const proposal = await Proposal.findById(edit.proposalId);
      proposal.workflowHistory.push({
        action: 'APPROVE',
        comment: comments || 'Budget Officer edits approved',
        userId,
        userName,
        timestamp: new Date(),
        previousStatus: proposal.status,
        newStatus: 'Office Approved'
      });
      await proposal.save({ session });
      
      await session.commitTransaction();
      
      // Log the approval
      await ProposalEditLog.logChange({
        proposalId: edit.proposalId,
        budgetOfficerEditId: edit._id,
        fiscalYear: edit.fiscalYear,
        budgetType: edit.budgetType,
        region: edit.region,
        changeType: 'UPDATE',
        entityType: 'Proposal',
        changedBy: {
          userId,
          userName,
          email: userEmail,
          role: roles && roles.length ? roles[0] : 'BUDGET_MANAGER'
        },
        summary: 'Approved Budget Officer edits',
        comments,
        ipAddress,
        userAgent: req.get('user-agent')
      });
      
      // Notify Budget Analyst
      await createNotification({
        userId: edit.processBy,
        type: 'PROPOSAL_APPROVED',
        title: 'Proposal Edits Approved',
        message: `The edits made by Budget Officer have been approved for your proposal (${edit.fiscalYear} - ${edit.budgetType})`,
        relatedId: edit.proposalId,
        relatedType: 'Proposal'
      });
      
      res.json({
        success: true,
        message: 'Edits approved and applied successfully',
        data: {
          _id: edit._id,
          proposalId: edit.proposalId,
          fiscalYear: edit.fiscalYear,
          budgetType: edit.budgetType,
          region: edit.region,
          department: edit.department,
          division: edit.division,
          processBy: edit.processBy,
          cobExpenditures: edit.cobExpenditures,
          status: edit.status,
          editedBy: edit.editedBy,
          submittedAt: edit.submittedAt,
          approvedAt: edit.approvedAt,
          approvedBy: edit.approvedBy,
          changeSummary: edit.getChangeSummary()
        }
      });
      
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
    
  } catch (error) {
    console.error('Error approving edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve edits',
      error: error.message
    });
  }
};

/**
 * Delete a draft edit
 */
exports.deleteDraftEdit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const edit = await BudgetOfficerEdit.findById(id);
    if (!edit) {
      return res.status(404).json({
        success: false,
        message: 'Edit not found'
      });
    }
    
    if (edit.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft edits can be deleted'
      });
    }
    
    await edit.deleteOne();
    
    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete draft',
      error: error.message
    });
  }
};