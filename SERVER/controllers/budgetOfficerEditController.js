const mongoose = require('mongoose');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const ProposalEditLog = require('../models/ProposalEditLog');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const { createNotification, createNotifications } = require('./notificationController');
const { resolveUserIdentity, getClientIp } = require('../utils/requestContext');
// const { validateAnalystSubmissionReadiness } = require('./proposalWorkflowController'); // REMOVED: Unused import causing circular dependency
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');

// Role aliasing: map internal persisted roles to 6-step display roles
const ROLE_ALIAS_TO_DISPLAY = {
  PREPARER: 'PREPARER',
  BUDGET_ANALYST: 'PREPARER', // Legacy analyst acting as preparer in 6-step
  BUDGET_COORDINATOR: 'REVIEWER',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER',
  BUDGET_OFFICER: 'BUDGET_OFFICER',
  BUDGET_MANAGER: 'OVERALL_BUDGET_APPROVER',
  OVERALL_BUDGET_APPROVER: 'OVERALL_BUDGET_APPROVER',
  BUDGET_ADMIN: 'BUDGET_ADMIN'
};

const toDisplayRole = (role) => ROLE_ALIAS_TO_DISPLAY[role] || role;

// Reverse aliasing: allow lookups when assignments use display roles instead of persisted ones
const DISPLAY_TO_PERSISTED = {
  PREPARER: ['BUDGET_ANALYST', 'PREPARER'],
  REVIEWER: ['BUDGET_COORDINATOR', 'REVIEWER'],
  APPROVER: ['BUDGET_OFFICER', 'APPROVER'],
  OVERALL_BUDGET_APPROVER: ['BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER'],
  BUDGET_ADMIN: ['BUDGET_ADMIN']
};
const roleVariantsForQuery = (role) => {
  const variants = new Set();
  if (role) variants.add(role);
  const display = toDisplayRole(role);
  if (display) variants.add(display);
  const persistedList = DISPLAY_TO_PERSISTED[role] || DISPLAY_TO_PERSISTED[display] || [];
  for (const r of persistedList) variants.add(r);
  return Array.from(variants);
};

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
 * Find all users with a specific role in a department/region
 * Used for sending notifications to all users responsible for the next workflow step
 * @param {String} targetRole - The budget role to search for (e.g., 'BUDGET_MANAGER')
 * @param {String} region - The region name
 * @param {String} department - The department name (optional)
 * @returns {Promise<Array>} - Array of user IDs with that role in the location
 */
const findUsersByRoleAndLocation = async (targetRole, region, department) => {
  try {
    const rolesToMatch = roleVariantsForQuery(targetRole);
    const query = {
      userRole: { $in: rolesToMatch },
      isActive: true
    };

    // Find region by name for ID
    let regionObj = null;
    if (region) {
      regionObj = await Region.findOne({ 
        $or: [
          { regionName: region },
          { Region: region }
        ]
      });
    }

    // Add region to query if found
    if (regionObj) {
      query.regionId = regionObj._id;
    }

    // Add department to query if provided
    if (department) {
      const deptObj = await Department.findOne({
        $or: [
          { departmentName: department },
          { Department: department },
          { DepartmentName: department }
        ]
      });
      if (deptObj) {
        query.departmentId = deptObj._id;
      }
    }

    const assignments = await HierarchicalUserAssignment.find(query)
      .select('userId userName email')
      .lean();

    return assignments.map(a => ({
      userId: a.userId,
      userName: a.userName,
      email: a.email
    }));
  } catch (error) {
    console.error('Error finding users by role and location:', error);
    return [];
  }
};

/**
 * Apply Budget Officer/Coordinator edits to the original proposal documents
 * This updates the actual Income, PS, MOOE, and CO documents with the edited values
 * @param {Object} budgetOfficerEdit - The BudgetOfficerEdit document containing the edits
 * @returns {Promise<Object>} - Summary of applied changes
 */
const applyEditsToOriginalDocuments = async (budgetOfficerEdit) => {
  console.log('🔄 Applying edits to original documents...', {
    proposalId: budgetOfficerEdit.proposalId,
    editId: budgetOfficerEdit._id,
    role: budgetOfficerEdit.editedBy?.role
  });

  const results = {
    income: { modified: 0, added: 0, deleted: 0, errors: [] },
    personnelServices: { modified: 0, added: 0, deleted: 0, errors: [] },
    mooe: { modified: 0, added: 0, deleted: 0, errors: [] },
    capitalOutlay: { modified: 0, added: 0, deleted: 0, errors: [] }
  };

  try {
    // Apply Income edits
    if (budgetOfficerEdit.editedIncome && budgetOfficerEdit.editedIncome.length > 0) {
      for (const edit of budgetOfficerEdit.editedIncome) {
        try {
          const targetId = edit.originalId || edit._id;

          if (edit.changeType === 'added') {
            const data = sanitizeEditPayload(edit);
            if (data.amount !== undefined) data.amount = Number(data.amount);
            const newIncome = new Income({
              ...data,
              fiscalYear: budgetOfficerEdit.fiscalYear,
              budgetType: budgetOfficerEdit.budgetType,
              region: budgetOfficerEdit.region,
              department: budgetOfficerEdit.department,
              division: budgetOfficerEdit.division,
              processBy: budgetOfficerEdit.processBy,
              proposalId: budgetOfficerEdit.proposalId  // CRITICAL: Link to this proposal
            });
            await newIncome.save();
            results.income.added++;
            continue;
          }

          if (edit.changeType === 'deleted' && targetId) {
            await Income.findByIdAndDelete(targetId);
            results.income.deleted++;
            continue;
          }

          if (targetId && (edit.changeType === 'modified' || !edit.changeType || edit.changeType === 'changed')) {
            const updateData = {};
            if (edit.amount !== undefined) updateData.amount = Number(edit.amount);
            if (edit.amount !== undefined) updateData.cost = Number(edit.amount);
            if (edit.category !== undefined) updateData.category = edit.category;
            if (edit.subcategory !== undefined) updateData.subcategory = edit.subcategory;
            if (edit.particulars !== undefined) updateData.particulars = edit.particulars;
            
            const result = await Income.findByIdAndUpdate(
              targetId,
              { $set: updateData },
              { new: true }
            );
            if (result) results.income.modified++;
          }
        } catch (error) {
          console.error(`❌ Error updating Income ${edit._id}:`, error);
          results.income.errors.push({ id: edit._id, error: error.message });
        }
      }
    }

    // Apply Personnel Services edits
    if (budgetOfficerEdit.editedPersonnelServices && budgetOfficerEdit.editedPersonnelServices.length > 0) {
      for (const edit of budgetOfficerEdit.editedPersonnelServices) {
        try {
          const targetId = edit.originalId || edit._id;

          if (edit.changeType === 'added') {
            const data = sanitizeEditPayload(edit);
            if (data.monthlySalary !== undefined) data.monthlySalary = Number(data.monthlySalary);
            if (data.annualSalary !== undefined) data.annualSalary = Number(data.annualSalary);
            if (data.total !== undefined) data.total = Number(data.total);
            const newPS = new PersonnelServices({
              ...data,
              fiscalYear: budgetOfficerEdit.fiscalYear,
              budgetType: budgetOfficerEdit.budgetType,
              region: budgetOfficerEdit.region,
              department: budgetOfficerEdit.department,
              division: budgetOfficerEdit.division,
              processBy: budgetOfficerEdit.processBy,
              proposalId: budgetOfficerEdit.proposalId  // CRITICAL: Link to this proposal
            });
            await newPS.save();
            results.personnelServices.added++;
            continue;
          }

          if (edit.changeType === 'deleted' && targetId) {
            await PersonnelServices.findByIdAndDelete(targetId);
            results.personnelServices.deleted++;
            continue;
          }

          if (targetId && (edit.changeType === 'modified' || !edit.changeType || edit.changeType === 'changed')) {
            const updateData = {};
            if (edit.salaryGrade !== undefined) updateData.salaryGrade = edit.salaryGrade;
            if (edit.step !== undefined) updateData.step = edit.step;
            if (edit.monthlySalary !== undefined) updateData.monthlySalary = Number(edit.monthlySalary);
            if (edit.annualSalary !== undefined) updateData.annualSalary = Number(edit.annualSalary);
            if (edit.total !== undefined) updateData.total = Number(edit.total);
            
            const result = await PersonnelServices.findByIdAndUpdate(
              targetId,
              { $set: updateData },
              { new: true }
            );
            if (result) results.personnelServices.modified++;
          }
        } catch (error) {
          console.error(`❌ Error updating PersonnelServices ${edit._id}:`, error);
          results.personnelServices.errors.push({ id: edit._id, error: error.message });
        }
      }
    }

    // Apply MOOE edits
    if (budgetOfficerEdit.editedMOOE && budgetOfficerEdit.editedMOOE.length > 0) {
      for (const edit of budgetOfficerEdit.editedMOOE) {
        try {
          const targetId = edit.originalId || edit._id;

          if (edit.changeType === 'added') {
            const data = sanitizeEditPayload(edit);
            if (data.amount !== undefined) data.amount = Number(data.amount);
            const newMooe = new MOOE({
              ...data,
              fiscalYear: budgetOfficerEdit.fiscalYear,
              budgetType: budgetOfficerEdit.budgetType,
              region: budgetOfficerEdit.region,
              department: budgetOfficerEdit.department,
              division: budgetOfficerEdit.division,
              processBy: budgetOfficerEdit.processBy,
              proposalId: budgetOfficerEdit.proposalId  // CRITICAL: Link to this proposal
            });
            await newMooe.save();
            results.mooe.added++;
            continue;
          }

          if (edit.changeType === 'deleted' && targetId) {
            await MOOE.findByIdAndDelete(targetId);
            results.mooe.deleted++;
            continue;
          }

          if (targetId && (edit.changeType === 'modified' || !edit.changeType || edit.changeType === 'changed')) {
            const updateData = {};
            if (edit.amount !== undefined) updateData.amount = Number(edit.amount);
            if (edit.generalType !== undefined) updateData.generalType = edit.generalType;
            if (edit.category !== undefined) updateData.category = edit.category;
            if (edit.particulars !== undefined) updateData.particulars = edit.particulars;
            
            const result = await MOOE.findByIdAndUpdate(
              targetId,
              { $set: updateData },
              { new: true }
            );
            if (result) results.mooe.modified++;
          }
        } catch (error) {
          console.error(`❌ Error updating MOOE ${edit._id}:`, error);
          results.mooe.errors.push({ id: edit._id, error: error.message });
        }
      }
    }

    // Apply Capital Outlay edits
    if (budgetOfficerEdit.editedCapitalOutlay && budgetOfficerEdit.editedCapitalOutlay.length > 0) {
      for (const edit of budgetOfficerEdit.editedCapitalOutlay) {
        try {
          const targetId = edit.originalId || edit._id;

          if (edit.changeType === 'added') {
            const data = sanitizeEditPayload(edit);
            if (data.income !== undefined) data.income = Number(data.income);
            if (data.subsidy !== undefined) data.subsidy = Number(data.subsidy);
            if (data.cost !== undefined) {
              data.cost = Number(data.cost);
              data.total = Number(data.cost);
            } else if (data.total !== undefined) {
              data.total = Number(data.total);
              data.cost = Number(data.total);
            }
            const newCapitalOutlay = new CapitalOutlay({
              ...data,
              fiscalYear: budgetOfficerEdit.fiscalYear,
              budgetType: budgetOfficerEdit.budgetType,
              region: budgetOfficerEdit.region,
              department: budgetOfficerEdit.department,
              division: budgetOfficerEdit.division,
              processBy: budgetOfficerEdit.processBy,
              proposalId: budgetOfficerEdit.proposalId  // CRITICAL: Link to this proposal
            });
            await newCapitalOutlay.save();
            results.capitalOutlay.added++;
            continue;
          }

          if (edit.changeType === 'deleted' && targetId) {
            await CapitalOutlay.findByIdAndDelete(targetId);
            results.capitalOutlay.deleted++;
            continue;
          }

          if (targetId && (edit.changeType === 'modified' || !edit.changeType || edit.changeType === 'changed')) {
            const updateData = {};
            if (edit.ppmpCode !== undefined) updateData.ppmpCode = edit.ppmpCode;
            if (edit.particulars !== undefined) updateData.particulars = edit.particulars;
            if (edit.sublineItem !== undefined) updateData.sublineItem = edit.sublineItem;
            if (edit.accountingTitle !== undefined) updateData.accountingTitle = edit.accountingTitle;
            if (edit.uacsCode !== undefined) updateData.uacsCode = edit.uacsCode;
            if (edit.income !== undefined) updateData.income = Number(edit.income);
            if (edit.subsidy !== undefined) updateData.subsidy = Number(edit.subsidy);
            if (edit.cost !== undefined) {
              updateData.cost = Number(edit.cost);
              updateData.total = Number(edit.cost);
            } else if (edit.total !== undefined) {
              updateData.cost = Number(edit.total);
              updateData.total = Number(edit.total);
            }

            const result = await CapitalOutlay.findByIdAndUpdate(
              targetId,
              { $set: updateData },
              { new: true }
            );
            if (result) results.capitalOutlay.modified++;
          }
        } catch (error) {
          console.error(`❌ Error updating CapitalOutlay ${edit._id}:`, error);
          results.capitalOutlay.errors.push({ id: edit._id, error: error.message });
        }
      }
    }

    console.log('✅ Edits applied to original documents:', {
      income: `${results.income.modified} modified, ${results.income.added} added, ${results.income.deleted} deleted`,
      personnelServices: `${results.personnelServices.modified} modified, ${results.personnelServices.added} added, ${results.personnelServices.deleted} deleted`,
      mooe: `${results.mooe.modified} modified, ${results.mooe.added} added, ${results.mooe.deleted} deleted`,
      capitalOutlay: `${results.capitalOutlay.modified} modified, ${results.capitalOutlay.added} added, ${results.capitalOutlay.deleted} deleted`
    });

    // Recalculate proposal totals after applying edits
    try {
      const proposal = await Proposal.findById(budgetOfficerEdit.proposalId);
      if (proposal) {
        // Aggregate totals from budget items SPECIFIC TO THIS PROPOSAL
        // Using proposalId to ensure we only sum items for this proposal
        const filterCriteria = {
          proposalId: mongoose.Types.ObjectId(budgetOfficerEdit.proposalId)
        };

        const [incomeTotal, psTotal, mooeTotal, coTotal] = await Promise.all([
          Income.aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          PersonnelServices.aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ]),
          require('../models/mooeProposals').aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          CapitalOutlay.aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$cost', { $ifNull: ['$total', 0] }] } } } }
          ])
        ]);

        const incomeSum = incomeTotal[0]?.total || 0;
        const psSum = psTotal[0]?.total || 0;
        const mooeSum = mooeTotal[0]?.total || 0;
        const coSum = coTotal[0]?.total || 0;
        const expenseSum = psSum + mooeSum + coSum;
        const newTotal = incomeSum + expenseSum;

        console.log('📊 Recalculated proposal totals after edits:', {
          proposalId: proposal._id,
          income: incomeSum,
          personnelServices: psSum,
          mooe: mooeSum,
          capitalOutlay: coSum,
          oldTotalIncome: proposal.totalIncome,
          oldTotalExpenses: proposal.totalExpenses,
          newTotal: newTotal
        });

        // Update proposal with new totals
        proposal.totalIncome = incomeSum;
        proposal.totalExpenses = expenseSum;
        proposal.proposedBudget = expenseSum;
        proposal.projectedCorporateIncome = incomeSum;
        proposal.updatedAt = new Date();
        
        await proposal.save();
        console.log('✅ Proposal totals updated and saved');

        results.proposalTotalRecalculated = true;
        results.newProposalTotal = newTotal;
        results.proposalUpdated = true;
      }
    } catch (error) {
      console.error('❌ Error recalculating proposal totals:', error);
      results.proposalTotalRecalculationError = error.message;
      // Don't throw - edits were already applied successfully
    }

    // Mark the edit as Approved (successfully applied)
    budgetOfficerEdit.status = 'Approved';
    budgetOfficerEdit.appliedAt = new Date();
    budgetOfficerEdit.appliedBy = {
      userId: budgetOfficerEdit.editedBy?.userId || 'system',
      userName: budgetOfficerEdit.editedBy?.userName || 'System',
      role: budgetOfficerEdit.editedBy?.role || 'SYSTEM'
    };
    await budgetOfficerEdit.save();
    console.log('✅ BudgetOfficerEdit marked as Approved (applied)');

    results.editStatusUpdated = true;

    return results;
  } catch (error) {
    console.error('❌ Error applying edits to original documents:', error);
    throw error;
  }
};

const WORKFLOW_STATUS_MAPPING = {
  'Division Submitted': 'Division Submitted',
  'Under Review by Coordinator': 'Division Submitted',
  'Coordinator Approved': 'Division Submitted',
  'Forwarded to Officer': 'Department Verified',
  'Under Review by Officer': 'Department Verified',
  'Officer Approved': 'Department Submitted',
  'Forwarded to Manager': 'Region Approved',
  'Under Review by Manager': 'Region Approved',
  'Finalized': 'Finalized',
  Returned: 'Returned'
};

const WORKFLOW_LEVEL_MAPPING = {
  COORDINATOR: 'DIVISION',
  OFFICER: 'DEPARTMENT',
  MANAGER: 'REGION',
  FINALIZED: 'FINALIZED'
};

async function syncRelatedBudgetItems(proposal) {
  try {
    const mappedStatus = WORKFLOW_STATUS_MAPPING[proposal.status] || proposal.status;
    const mappedWorkflowLevel = WORKFLOW_LEVEL_MAPPING[proposal.workflowLevel] || 'DIVISION';

    const criteria = {
      region: proposal.region,
      department: proposal.department,
      division: proposal.division,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType
    };

    await Promise.all([
      Income.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
      PersonnelServices.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
      MOOE.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
      CapitalOutlay.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } })
    ]);
  } catch (error) {
    console.error('❌ Failed to sync related budget items after workflow transition:', error);
  }
}

function sanitizeEditPayload(edit) {
  const clone = { ...edit };
  ['_id', 'originalId', 'changeType', 'originalValues', 'original', '__v', 'createdAt', 'updatedAt', 'details'].forEach((key) => {
    if (key in clone) {
      delete clone[key];
    }
  });
  return clone;
}

// Export for use in other controllers
exports.applyEditsToOriginalDocuments = applyEditsToOriginalDocuments;

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
    // BUDGET_MANAGER can view "Forwarded to Manager" proposals (to approve/reject)
    // BUDGET_OFFICER cannot edit "Forwarded to Manager", "Officer Approved", or "Approved" proposals
    if (proposal.status === 'Forwarded to Manager' || proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be edited',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Officer Approved' || proposal.status === 'Office Approved' || proposal.status === 'Approved') {
      // Block everyone from editing approved proposals
      return res.status(403).json({
        success: false,
        message: 'This proposal has already been approved and cannot be edited',
        proposalStatus: proposal.status
      });
    }
    
    // Check if there's an existing edit
    // Budget Manager should ONLY see edits submitted by Budget Officer (not Budget Coordinator)
    // Budget Officer should see their own Draft or edits from Budget Coordinator
    let existingEdit;
    if (isBudgetManager && !isBudgetOfficer) {
      // Budget Manager: Only show edits submitted by BUDGET_OFFICER
      existingEdit = await BudgetOfficerEdit.findOne({
        proposalId: proposal._id,
        status: 'Submitted',
        'editedBy.role': 'BUDGET_OFFICER'
      }).sort({ updatedAt: -1 });
    } else {
      // Budget Officer: Show Draft or Submitted edits (including from Budget Coordinator)
      existingEdit = await BudgetOfficerEdit.findOne({
        proposalId: proposal._id,
        status: { $in: ['Draft', 'Submitted'] }
      }).sort({ updatedAt: -1 });
    }
    
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
    // BUDGET_MANAGER can view "Forwarded to Manager" proposals (to approve/reject)
    // BUDGET_OFFICER cannot edit "Forwarded to Manager", "Officer Approved", or "Approved" proposals
    if (proposal.status === 'Forwarded to Manager' || proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be edited',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Officer Approved' || proposal.status === 'Office Approved' || proposal.status === 'Approved') {
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
    
    // Determine the role of the editor
    const editorRole = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')
      ? 'BUDGET_MANAGER'
      : userRoles.includes('APPROVER') || userRoles.includes('BUDGET_OFFICER')
      ? 'BUDGET_OFFICER'
      : userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR')
      ? 'BUDGET_COORDINATOR'
      : userRoles.includes('BUDGET_ANALYST')
      ? 'BUDGET_ANALYST'
      : 'PREPARER';
    // Map editor role for BudgetOfficerEdit.editedBy.role enum (no PREPARER in schema)
    const editDocRole = editorRole === 'PREPARER' ? 'BUDGET_ANALYST' : editorRole;
    
    if (budgetOfficerEdit) {
      // Update existing draft
      budgetOfficerEdit.editedIncome = editedIncome || [];
      budgetOfficerEdit.editedPersonnelServices = editedPersonnelServices || [];
      budgetOfficerEdit.editedMOOE = editedMOOE || [];
      budgetOfficerEdit.editedCapitalOutlay = editedCapitalOutlay || [];
      budgetOfficerEdit.comments = comments;
      budgetOfficerEdit.updatedAt = new Date();
      // Update the role if it changed
  budgetOfficerEdit.editedBy.role = editDocRole;
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
          email: userEmail,
          role: editDocRole
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
        role: editorRole
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
    // 🔴🔴🔴 RAW REQUEST LOGGING - BEFORE ANY PROCESSING 🔴🔴🔴
    console.log('\n\n🔴🔴🔴 BUDGET OFFICER EDIT SUBMIT - RAW REQUEST RECEIVED 🔴🔴🔴');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('\n');
    
    const {
      proposalId,
      editedIncome,
      editedPersonnelServices,
      editedMOOE,
      editedCapitalOutlay,
      comments,
      submitTargetRole
    } = req.body;
    
    // 🔴 LOG THE EXTRACTED ARRAYS IMMEDIATELY
    console.log('🔴 EXTRACTED ARRAYS FROM REQUEST BODY:');
    console.log('editedPersonnelServices type:', typeof editedPersonnelServices, 'isArray:', Array.isArray(editedPersonnelServices), 'length:', editedPersonnelServices?.length);
    console.log('editedMOOE type:', typeof editedMOOE, 'isArray:', Array.isArray(editedMOOE), 'length:', editedMOOE?.length);
    console.log('editedCapitalOutlay type:', typeof editedCapitalOutlay, 'isArray:', Array.isArray(editedCapitalOutlay), 'length:', editedCapitalOutlay?.length);
    console.log('editedIncome type:', typeof editedIncome, 'isArray:', Array.isArray(editedIncome), 'length:', editedIncome?.length);
    
    const auditContext = await buildRequestAuditContext(req);
    if (!auditContext.userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
  const { userId, userName, email: userEmail, ipAddress } = auditContext;
    
    // Find the proposal
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    
    // ✅ VALIDATE: Check if the EDITED entries have all required modules before allowing submission
    // In Edit Mode, we must validate the DRAFT EDITED ENTRIES, not just the original records
    console.log('🔍🔍🔍 VALIDATING BUDGET OFFICER EDIT SUBMISSION 🔍🔍🔍', {
      proposalId,
      region: proposal.region,
      budgetType: proposal.budgetType,
      editedPersonnelCount: editedPersonnelServices?.length || 0,
      editedMOOECount: editedMOOE?.length || 0,
      editedCapitalCount: editedCapitalOutlay?.length || 0,
      editedIncomeCount: editedIncome?.length || 0,
      receivedArrayTypes: {
        personnel: Array.isArray(editedPersonnelServices) ? 'ARRAY' : typeof editedPersonnelServices,
        mooe: Array.isArray(editedMOOE) ? 'ARRAY' : typeof editedMOOE,
        capital: Array.isArray(editedCapitalOutlay) ? 'ARRAY' : typeof editedCapitalOutlay,
        income: Array.isArray(editedIncome) ? 'ARRAY' : typeof editedIncome
      }
    });
    
    // Log first entry of each module to inspect field names and actual data
    console.log('📋📋 CHECKING FIRST ENTRIES 📋📋');
    if (editedPersonnelServices?.length > 0) {
      console.log('📋 First Personnel entry fields:', Object.keys(editedPersonnelServices[0]));
      console.log('📋 First Personnel entry (full):', JSON.stringify(editedPersonnelServices[0], null, 2));
    } else {
      console.log('⚠️ Personnel array is empty or null');
    }
    if (editedMOOE?.length > 0) {
      console.log('📋 First MOOE entry fields:', Object.keys(editedMOOE[0]));
      console.log('📋 First MOOE entry (full):', JSON.stringify(editedMOOE[0], null, 2));
    } else {
      console.log('⚠️ MOOE array is empty or null');
    }
    if (editedCapitalOutlay?.length > 0) {
      console.log('📋 First Capital entry fields:', Object.keys(editedCapitalOutlay[0]));
      console.log('📋 First Capital entry (full):', JSON.stringify(editedCapitalOutlay[0], null, 2));
    } else {
      console.log('⚠️ Capital array is empty or null');
    }
    if (editedIncome?.length > 0) {
      console.log('📋 First Income entry fields:', Object.keys(editedIncome[0]));
      console.log('📋 First Income entry (full):', JSON.stringify(editedIncome[0], null, 2));
    } else {
      console.log('⚠️ Income array is empty or null');
    }
    
    // ⚠️ STRICT VALIDATION: Do NOT allow any module to be empty
    // FAILSAFE CHECK: Ensure arrays are actually arrays
    if (!Array.isArray(editedPersonnelServices)) {
      console.log('🛑 FAILSAFE: editedPersonnelServices is not an array, it is:', typeof editedPersonnelServices);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format: Personnel Services must be an array',
        missingModules: ['Personnel Services - Invalid Format']
      });
    }
    if (!Array.isArray(editedMOOE)) {
      console.log('🛑 FAILSAFE: editedMOOE is not an array, it is:', typeof editedMOOE);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format: MOOE must be an array',
        missingModules: ['MOOE - Invalid Format']
      });
    }
    if (!Array.isArray(editedCapitalOutlay)) {
      console.log('🛑 FAILSAFE: editedCapitalOutlay is not an array, it is:', typeof editedCapitalOutlay);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format: Capital Outlay must be an array',
        missingModules: ['Capital Outlay - Invalid Format']
      });
    }
    if (!Array.isArray(editedIncome)) {
      console.log('🛑 FAILSAFE: editedIncome is not an array, it is:', typeof editedIncome);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format: Income must be an array',
        missingModules: ['Income - Invalid Format']
      });
    }
    
    // Helper function to calculate total from entries
    const calculateModuleTotal = (entries, amountField) => {
      if (!Array.isArray(entries) || entries.length === 0) return 0;
      return entries.reduce((sum, entry) => {
        const amount = Number(entry[amountField] || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    };
    
    const regionName = (proposal.region || '').trim().toUpperCase();
    const isCentralOffice = regionName.includes('CENTRAL') && regionName.includes('OFFICE');
    
    // ⚠️ CRITICAL: Calculate totals for each module USING ALL POSSIBLE FIELD NAMES
    const personnelTotal = calculateModuleTotal(editedPersonnelServices, 'Total');
    const mooeTotal = calculateModuleTotal(editedMOOE, 'amount');
    const capitalTotal = calculateModuleTotal(editedCapitalOutlay, 'cost');
    const incomeTotal = calculateModuleTotal(editedIncome, 'amount');
    
    console.log('💰💰 MODULE TOTALS CALCULATED 💰💰', {
      personnelTotal,
      mooeTotal,
      capitalTotal,
      incomeTotal,
      isCentralOffice
    });
    
    // ⚠️ BUILD LIST OF MISSING MODULES
    const missingEditedModules = [];
    
    // Check Personnel Services - ALWAYS required
    // MUST have entries AND positive total
    if (!editedPersonnelServices || editedPersonnelServices.length === 0) {
      missingEditedModules.push('Personnel Services (no entries)');
      console.log('❌ Personnel Services missing: array is empty');
    } else if (personnelTotal <= 0.0001) {
      missingEditedModules.push('Personnel Services (total is zero)');
      console.log('❌ Personnel Services has zero total');
    } else {
      console.log('✅ Personnel Services OK: ' + editedPersonnelServices.length + ' entries, Total: ' + personnelTotal);
    }
    
    // Check MOOE - ALWAYS required
    // MUST have entries AND positive total
    if (!editedMOOE || editedMOOE.length === 0) {
      missingEditedModules.push('MOOE (no entries)');
      console.log('❌ MOOE missing: array is empty');
    } else if (mooeTotal <= 0.0001) {
      missingEditedModules.push('MOOE (total is zero)');
      console.log('❌ MOOE has zero total');
    } else {
      console.log('✅ MOOE OK: ' + editedMOOE.length + ' entries, Total: ' + mooeTotal);
    }
    
    // Check Capital Outlay - ALWAYS required
    // MUST have entries AND positive total
    if (!editedCapitalOutlay || editedCapitalOutlay.length === 0) {
      missingEditedModules.push('Capital Outlay (no entries)');
      console.log('❌ Capital Outlay missing: array is empty');
    } else if (capitalTotal <= 0.0001) {
      missingEditedModules.push('Capital Outlay (total is zero)');
      console.log('❌ Capital Outlay has zero total');
    } else {
      console.log('✅ Capital Outlay OK: ' + editedCapitalOutlay.length + ' entries, Total: ' + capitalTotal);
    }
    
    // Check Income - ALWAYS required for regional, not required for central office
    if (isCentralOffice) {
      console.log('ℹ️ Central Office detected - Income not required');
    } else {
      if (!editedIncome || editedIncome.length === 0) {
        missingEditedModules.push('Income (no entries)');
        console.log('❌ Income missing: array is empty (required for regional)');
      } else if (incomeTotal <= 0.0001) {
        missingEditedModules.push('Income (total is zero)');
        console.log('❌ Income has zero total (required for regional)');
      } else {
        console.log('✅ Income OK: ' + editedIncome.length + ' entries, Total: ' + incomeTotal);
      }
    }
    
    // 🛑 BLOCK SUBMISSION IF ANY REQUIRED MODULE IS MISSING
    if (missingEditedModules.length > 0) {
      const requirementMessage = isCentralOffice
        ? 'Central Office proposals must include Personnel Services, MOOE, and Capital Outlay with positive amounts before submitting.'
        : 'Regional proposals must include all four modules (Personnel Services, MOOE, Capital Outlay, and Income) with positive amounts before submitting.';
      
      console.log('🛑🛑🛑 SUBMISSION BLOCKED: MISSING MODULES 🛑🛑🛑', {
        proposalId,
        missingModules: missingEditedModules,
        requirement: requirementMessage,
        moduleTotals: {
          personnelTotal,
          mooeTotal,
          capitalTotal,
          incomeTotal
        }
      });
      
      return res.status(400).json({
        success: false,
        message: `${requirementMessage} Missing modules: ${missingEditedModules.join(', ')}.`,
        missingModules: missingEditedModules,
        requirementMessage,
        moduleTotals: { personnelTotal, mooeTotal, capitalTotal, incomeTotal }
      });
    }
    
    console.log('✅✅✅ VALIDATION PASSED - ALL REQUIRED MODULES ARE PRESENT ✅✅✅');
    
    // Get user roles
    const userRoles = req.user?.Roles || [];
    const isBudgetManager = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    
    // Check if proposal is already submitted or approved - prevent further editing
    // BUDGET_MANAGER can view "Forwarded to Manager" proposals (to approve/reject)
    // BUDGET_OFFICER cannot submit "Forwarded to Manager", "Officer Approved", or "Approved" proposals
    if (proposal.status === 'Forwarded to Manager' || proposal.status === 'Office Submitted') {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER from submitting
      if (isBudgetOfficer && !isBudgetManager) {
        return res.status(403).json({
          success: false,
          message: 'This proposal has already been submitted to Budget Manager and cannot be submitted again',
          proposalStatus: proposal.status
        });
      }
    } else if (proposal.status === 'Officer Approved' || proposal.status === 'Office Approved' || proposal.status === 'Approved') {
      // Block everyone from submitting approved proposals
      return res.status(403).json({
        success: false,
        message: 'This proposal has already been approved and cannot be submitted again',
        proposalStatus: proposal.status
      });
    }
    
    // Check if there's already a SUBMITTED (not yet processed) edit for this proposal
    // "Approved" edits have been processed and should not block submissions
    const existingSubmittedEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: 'Submitted'
    });
    
    if (existingSubmittedEdit) {
      return res.status(400).json({
        success: false,
        message: 'This proposal already has a submitted edit. Cannot submit again.',
        existingEditStatus: existingSubmittedEdit.status
      });
    }
    
    // Determine the role of the editor
    const editorRole = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')
      ? 'BUDGET_MANAGER'
      : userRoles.includes('APPROVER') || userRoles.includes('BUDGET_OFFICER')
      ? 'BUDGET_OFFICER'
      : userRoles.includes('REVIEWER') || userRoles.includes('BUDGET_COORDINATOR')
      ? 'BUDGET_COORDINATOR'
      : userRoles.includes('BUDGET_ANALYST')
      ? 'BUDGET_ANALYST'
      : 'PREPARER';
    // Map editor role for BudgetOfficerEdit.editedBy.role enum (no PREPARER in schema)
    const editDocRole = editorRole === 'PREPARER' ? 'BUDGET_ANALYST' : editorRole;
    
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
  // Update the role if it changed
  budgetOfficerEdit.editedBy.role = editDocRole;
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
          email: userEmail,
          role: editDocRole
        },
        submittedAt: new Date()
      });
    }
    
    await budgetOfficerEdit.save();
    
    // Apply the edits to the original documents BEFORE updating status
    // This ensures that when Budget Officer loads the proposal, they see the Coordinator's changes
    console.log('📝 Applying edits to original documents before status update...', {
      editorRole: editorRole,
      proposalId: proposalId,
      editId: budgetOfficerEdit._id
    });
    
    try {
      const applyResults = await applyEditsToOriginalDocuments(budgetOfficerEdit);
      console.log('✅ Edits successfully applied:', applyResults);
    } catch (applyError) {
      console.error('❌ Error applying edits to original documents:', applyError);
      // Continue with status update even if some edits failed
      // The edits are still stored in budgetofficeredits for comparison view
    }
    
    const previousStatus = proposal.status;
    const now = new Date();

    let newStatus = previousStatus;
    let newWorkflowLevel = proposal.workflowLevel || 'COORDINATOR';
    let historyAction = 'EDIT';
    let historyComment = comments || `${editorRole} submitted edits`;
    let currentStep = proposal.currentStep;
    let currentAssigneeRole = proposal.currentAssigneeRole;
    let pendingRoles = Array.isArray(proposal.pendingWithRoles) ? [...proposal.pendingWithRoles] : [];

    if (editorRole === 'PREPARER') {
      // PREPARER submits to COORDINATOR (Reviewer in new naming)
      newStatus = 'Division Submitted';
      newWorkflowLevel = 'COORDINATOR';
      historyAction = 'ANALYST_SUBMIT_TO_COORDINATOR';
      historyComment = comments || 'Preparer submitted edits to Coordinator';
      currentStep = 'COORDINATOR_REVIEW';
      currentAssigneeRole = 'BUDGET_COORDINATOR';
      pendingRoles = ['BUDGET_COORDINATOR'];
      proposal.submittedByRole = 'PREPARER';
      proposal.submittedToDivisionAt = now;
      proposal.submittedToDivisionBy = { userId, userName };
    } else if (editorRole === 'BUDGET_ANALYST') {
      // New BUDGET_ANALYST role (different level from old workflow)
      // Note: Keep within valid enums for Proposal
      newStatus = 'Division Submitted';
      newWorkflowLevel = 'COORDINATOR';
      historyAction = 'ANALYST_SUBMIT_TO_COORDINATOR';
      historyComment = comments || 'Budget Analyst submitted for coordination review';
      currentStep = 'COORDINATOR_REVIEW';
      currentAssigneeRole = 'BUDGET_COORDINATOR';
      pendingRoles = ['BUDGET_COORDINATOR'];
      proposal.submittedByRole = 'BUDGET_ANALYST';
      proposal.submittedToAnalystAt = now;
      proposal.submittedToAnalystBy = { userId, userName };
    } else if (editorRole === 'BUDGET_COORDINATOR') {
      // Check if reviewer wants to bypass officer and submit directly to manager
      if (submitTargetRole === 'BUDGET_MANAGER') {
        newStatus = 'Forwarded to Manager';
        newWorkflowLevel = 'MANAGER';
        historyAction = 'COORDINATOR_SUBMIT_TO_MANAGER';
        historyComment = comments || 'Coordinator submitted edits to Budget Manager';
        currentStep = 'MANAGER_REVIEW';
        currentAssigneeRole = 'BUDGET_MANAGER';
        pendingRoles = ['BUDGET_MANAGER'];
        proposal.submittedByRole = 'BUDGET_COORDINATOR';
        proposal.forwardedToManagerAt = now;
        proposal.forwardedToManagerBy = { userId, userName };
        proposal.bypassedOfficerReview = true;
      } else {
        // Standard flow: submit to APPROVER (first approval step in new workflow)
        // Retain legacy status label for backward compatibility; UI will show alias as needed
        newStatus = 'Forwarded to Officer';
        newWorkflowLevel = 'OFFICER';
        historyAction = 'COORDINATOR_SUBMIT_TO_OFFICER';
        historyComment = comments || 'Coordinator submitted edits to Approver';
        currentStep = 'OFFICER_REVIEW';
        currentAssigneeRole = 'APPROVER';
        pendingRoles = ['APPROVER'];
        proposal.submittedByRole = 'BUDGET_COORDINATOR';
        proposal.forwardedToOfficerAt = now;
        proposal.forwardedToOfficerBy = { userId, userName };
        proposal.bypassedOfficerReview = false;
      }
    } else if (editorRole === 'BUDGET_OFFICER') {
      // Officer submits to Manager
      newStatus = 'Forwarded to Manager';
      newWorkflowLevel = 'MANAGER';
      historyAction = 'OFFICER_SUBMIT_TO_MANAGER';
      historyComment = comments || 'Budget Officer submitted edits to Budget Manager';
      currentStep = 'MANAGER_REVIEW';
      currentAssigneeRole = 'BUDGET_MANAGER';
      pendingRoles = ['BUDGET_MANAGER'];
      proposal.submittedByRole = 'BUDGET_OFFICER';
      proposal.forwardedToManagerAt = now;
      proposal.forwardedToManagerBy = { userId, userName };
    } else if (editorRole === 'BUDGET_MANAGER') {
      newStatus = 'Finalized';
      newWorkflowLevel = 'FINALIZED';
      historyAction = 'MANAGER_APPROVE';
      historyComment = comments || 'Budget Manager finalized proposal edits';
      currentStep = 'FINALIZED';
      currentAssigneeRole = 'BUDGET_MANAGER';
      pendingRoles = [];
      proposal.submittedByRole = 'BUDGET_MANAGER';
      proposal.finalizedAt = now;
      proposal.finalizedBy = { userId, userName };
    }

    proposal.status = newStatus;
    proposal.workflowLevel = newWorkflowLevel;
    proposal.currentStep = currentStep;
    proposal.currentAssigneeRole = currentAssigneeRole;
    proposal.pendingWithRoles = pendingRoles;
    proposal.lastActionBy = userName;
    proposal.lastActionDate = now;

    proposal.workflowHistory.push({
      action: historyAction,
      comment: historyComment,
      userId,
      userName,
      timestamp: now,
      previousStatus,
      newStatus
    });

    await proposal.save();
    await syncRelatedBudgetItems(proposal);
    console.log('➡️ Workflow routed:', {
      proposalId: proposal._id.toString(),
      newStatus,
      newWorkflowLevel,
      currentStep,
      currentAssigneeRole,
      pendingRoles
    });
    
    let logSummary = 'Submitted edits for approval';
    if (editorRole === 'PREPARER') {
      logSummary = 'Submitted edits to Budget Coordinator';
    } else if (editorRole === 'BUDGET_ANALYST') {
      logSummary = 'Submitted analysis';
    } else if (editorRole === 'BUDGET_COORDINATOR') {
      if (submitTargetRole === 'BUDGET_MANAGER') {
        logSummary = 'Submitted edits directly to Budget Manager (bypassed Officer)';
      } else {
        logSummary = 'Submitted edits to Budget Officer';
      }
    } else if (editorRole === 'BUDGET_OFFICER') {
      logSummary = 'Submitted edits to Budget Manager';
    } else if (editorRole === 'BUDGET_MANAGER') {
      logSummary = 'Finalized proposal edits';
    }

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
        role: editorRole
      },
  summary: logSummary,
      comments,
      ipAddress,
      userAgent: req.get('user-agent')
    });
    
    // Create notifications for all users with the next role in the workflow
    // EXCEPTION: If BUDGET_MANAGER is finalizing, don't send notifications (workflow is complete)
  const notificationsToSend = [];
  let recipientUserIds = [];
  // Default display role for response (6-step alias)
  let displayRoleForResponse = toDisplayRole(currentAssigneeRole);
    
    if (editorRole !== 'BUDGET_MANAGER') {
      const nextRoleUsers = await findUsersByRoleAndLocation(
        currentAssigneeRole,
        proposal.region,
        proposal.department
      );

      // If no specific users found for the role, fallback to original processBy
      recipientUserIds = nextRoleUsers.length > 0 
        ? nextRoleUsers.map(u => u.userId) 
        : (proposal.processBy ? [proposal.processBy] : []);

      const usedFallbackToProcessBy = nextRoleUsers.length === 0 && !!proposal.processBy;
      console.log('📣 Notification recipients resolution:', {
        currentAssigneeRole,
        region: proposal.region,
        department: proposal.department,
        foundUsersForRole: nextRoleUsers.length,
        usedFallbackToProcessBy,
        recipientCount: recipientUserIds.length
      });

      // Store which users the edit is forwarded to
      budgetOfficerEdit.forwardedTo_UserId = recipientUserIds;
      budgetOfficerEdit.forwardedTo_Role = currentAssigneeRole;

      // Build notification message based on who's submitting and who's receiving
  let displayTargetRole = toDisplayRole(currentAssigneeRole);
  const displaySubmitterRole = toDisplayRole(editorRole);
  let notificationTitle = `Proposal Submitted for ${displayTargetRole} Review`;
  let notificationMessage = `${displaySubmitterRole} has submitted the proposal "${proposal.title}" for your review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;

      if (editorRole === 'BUDGET_ANALYST') {
        notificationTitle = 'Proposal Submitted for Coordination';
        notificationMessage = `Budget Analyst has submitted the proposal "${proposal.title}" for your coordination review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
      } else if (editorRole === 'BUDGET_COORDINATOR') {
        if (currentAssigneeRole === 'BUDGET_MANAGER') {
          notificationTitle = 'Proposal Submitted for OVERALL_BUDGET_APPROVER Review (Bypassed Officer)';
          notificationMessage = `REVIEWER has submitted the proposal "${proposal.title}" directly to you for final review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
          displayTargetRole = 'OVERALL_BUDGET_APPROVER';
          displayRoleForResponse = 'OVERALL_BUDGET_APPROVER';
        } else {
          // Reviewer forwarding to Approver (maps to persisted BUDGET_OFFICER)
          notificationTitle = 'Proposal Submitted for APPROVER Review';
          notificationMessage = `REVIEWER has submitted the proposal "${proposal.title}" for your review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
          displayTargetRole = 'APPROVER';
          displayRoleForResponse = 'APPROVER';
        }
      } else if (editorRole === 'BUDGET_OFFICER') {
        notificationTitle = 'Proposal Submitted for OVERALL_BUDGET_APPROVER Review';
        notificationMessage = `BUDGET_OFFICER has submitted the proposal "${proposal.title}" for your final review and approval. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
      }

      // Create notifications for each recipient
      for (const recipientId of recipientUserIds) {
        notificationsToSend.push({
          userId: recipientId,
          type: 'PROPOSAL_WORKFLOW',
          title: notificationTitle,
          message: notificationMessage,
          relatedId: proposalId.toString(),
          relatedType: 'Proposal',
          relatedLink: `/AllProposals?proposalId=${proposalId}`,
          metadata: {
            proposalId: proposalId.toString(),
            fiscalYear: proposal.fiscalYear,
            budgetType: proposal.budgetType,
            region: proposal.region,
            department: proposal.department,
            submittedBy: userName,
            submittedByRole: displaySubmitterRole,
            targetRole: displayTargetRole,
            changeSummary: budgetOfficerEdit.getChangeSummary()
          }
        });
      }
    } else {
      // BUDGET_MANAGER finalized - mark forwardedTo as empty (no further routing)
      budgetOfficerEdit.forwardedTo_UserId = [];
      budgetOfficerEdit.forwardedTo_Role = 'FINALIZED';
    }

    // Send all notifications
    if (notificationsToSend.length > 0) {
      try {
        await createNotifications(notificationsToSend);
        console.log(`📧 Sent ${notificationsToSend.length} notification(s) to ${currentAssigneeRole} users`);
      } catch (notifError) {
        console.error('❌ Error sending notifications:', notifError);
        // Continue even if notifications fail - the edit submission should not fail
      }
    }

    // Save the budgetOfficerEdit again to persist forwardedTo fields
    try {
      await budgetOfficerEdit.save();
    } catch (saveError) {
      console.error('❌ Error saving budgetOfficerEdit with forwardedTo fields:', saveError);
      // Continue - this is not critical for the response
    }
    
    // Return appropriate message based on action
    const responseMessage = editorRole === 'BUDGET_MANAGER' 
      ? 'Proposal Finalized Successfully' 
      : 'Edits Submitted Successfully';
    
    res.json({
      success: true,
      message: responseMessage,
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
  displayCurrentAssigneeRole: displayRoleForResponse,
        displayEditedByRole: toDisplayRole(budgetOfficerEdit.editedBy?.role),
    forwardedToRole: budgetOfficerEdit.forwardedTo_Role,
    forwardedToUsersCount: Array.isArray(budgetOfficerEdit.forwardedTo_UserId) ? budgetOfficerEdit.forwardedTo_UserId.length : 0,
        submittedAt: budgetOfficerEdit.submittedAt,
        finalizedAt: editorRole === 'BUDGET_MANAGER' ? proposal.finalizedAt : undefined,
        finalizedBy: editorRole === 'BUDGET_MANAGER' ? proposal.finalizedBy : undefined,
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
        newStatus: 'Officer Approved'
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