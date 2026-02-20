const mongoose = require('mongoose');
const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');
const ProposalBudgetSnapshot = require('../models/ProposalBudgetSnapshot');
const ProposalEditLog = require('../models/ProposalEditLog');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const { createNotification, createNotifications } = require('./notificationController');
const { resolveUserIdentity, getClientIp } = require('../utils/requestContext');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
// const { validateAnalystSubmissionReadiness } = require('./proposalWorkflowController'); // REMOVED: Unused import causing circular dependency
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');

// Helper function to check if user has APPROVER role (handles different formats)
const hasApproverRole = (userRoles) => {
  if (!Array.isArray(userRoles)) return false;
  return userRoles.some(role => {
    const roleStr = String(role || '').toUpperCase();
    return roleStr === 'BUDGET APPROVER' ||
           roleStr === 'APPROVER' ||
           roleStr === 'DIVISION APPROVER' ||
           roleStr === 'OFFICE APPROVER' ||
           roleStr === 'DIVISIONAPPROVER' ||
           roleStr === 'OFFICEAPPROVER' ||
           roleStr.includes('APPROVER');
  });
};

// Mapping from persisted/internal role names to display-friendly versions
const ROLE_ALIAS_TO_DISPLAY = {
  'BUDGET PREPARER': 'BUDGET PREPARER',
  'BUDGET REVIEWER': 'BUDGET REVIEWER',
  'BUDGET APPROVER': 'BUDGET APPROVER',
  'BUDGET_PLANNING_ANALYST': 'BUDGET_PLANNING_ANALYST',
  'BUDGET_OFFICER': 'BUDGET_OFFICER',
  'BUDGET_MANAGER': 'BUDGET MANAGER',
  'SUPER ADMIN': 'SUPER ADMIN',
  'PREPARER': 'BUDGET PREPARER',
  'REVIEWER': 'BUDGET REVIEWER',
  'APPROVER': 'BUDGET APPROVER'
};

const toDisplayRole = (role) => ROLE_ALIAS_TO_DISPLAY[role] || role;

// Reverse aliasing: allow lookups when assignments use display roles instead of persisted ones
const DISPLAY_TO_PERSISTED = {
  'BUDGET PREPARER': ['BUDGET PREPARER'],
  BUDGET_REVIEWER: ['BUDGET REVIEWER'],
  'BUDGET APPROVER': ['BUDGET APPROVER'],
  BUDGET_PLANNING_ANALYST: ['BUDGET_PLANNING_ANALYST'],
  BUDGET_OFFICER: ['BUDGET_OFFICER'],
  'BUDGET MANAGER': ['BUDGET_MANAGER', 'BUDGET MANAGER'],
  'SUPER ADMIN': ['SUPER ADMIN']
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
 * Apply Budget Officer edits to the original proposal documents
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
            // Ensure proposalId is set for existing items
            updateData.proposalId = budgetOfficerEdit.proposalId;
            
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
            
            // Apply compensation settings for any missing fields
            const { getActiveSettingsWithCompensation } = require("../utils/settingsUtils");
            const activeSettings = await getActiveSettingsWithCompensation();
            
            if (activeSettings) {
              // Apply compensation settings for missing fields
              if (data.PERA === undefined || data.PERA === null) {
                data.PERA = (activeSettings.PERA || 0) * 12;
              }
              if (data.uniformALLOWANCE === undefined || data.uniformALLOWANCE === null) {
                data.uniformALLOWANCE = (activeSettings.uniformAllowance || 0) * 12;
              }
              if (data.productivityIncentive === undefined || data.productivityIncentive === null) {
                data.productivityIncentive = (activeSettings.productivityIncentive || 0) * 12;
              }
              if (data.cashGift === undefined || data.cashGift === null) {
                data.cashGift = (activeSettings.cashGift || 0) * 12;
              }
              if (data.pagibigPremium === undefined || data.pagibigPremium === null) {
                data.pagibigPremium = (activeSettings.pagibigPremium || 0) * 12;
              }
              if (data.medical === undefined || data.medical === null) {
                data.medical = (activeSettings.medicalAllowance || 0) * 12;
              }
              if (data.employeeCompensation === undefined || data.employeeCompensation === null) {
                data.employeeCompensation = (activeSettings.employeeCompensation || 0) * 12;
              }
              if (data.gsisPremium === undefined || data.gsisPremium === null) {
                data.gsisPremium = (data.annualSalary || 0) * (activeSettings.gsisPremium || 0);
              }
            }
            
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
            // Ensure proposalId is set for existing items
            updateData.proposalId = budgetOfficerEdit.proposalId;
            
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
            // Ensure proposalId is set for existing items
            updateData.proposalId = budgetOfficerEdit.proposalId;
            
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
            // Ensure proposalId is set for existing items
            updateData.proposalId = budgetOfficerEdit.proposalId;

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
          proposalId: new mongoose.Types.ObjectId(budgetOfficerEdit.proposalId)
        };

        const [incomeTotal, psTotal, mooeTotal, coTotal, psChargedToIncome, mooeIncome, coIncome] = await Promise.all([
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
          ]),
          // PS Charged to Income Amount
          PersonnelServices.aggregate([
            { $match: { ...filterCriteria, chargedToIncomeEligible: true } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$chargedToIncomeAmount', 0] } } } }
          ]),
          // MOOE Income
          require('../models/mooeProposals').aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$income', 0] } } } }
          ]),
          // Capital Outlay Income
          CapitalOutlay.aggregate([
            { $match: filterCriteria },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$income', 0] } } } }
          ])
        ]);

        const incomeSum = incomeTotal[0]?.total || 0; // Corporate Income (NOT included in projectedCorporateIncome)
        const psSum = psTotal[0]?.total || 0;
        const mooeSum = mooeTotal[0]?.total || 0;
        const coSum = coTotal[0]?.total || 0;
        const psChargedSum = psChargedToIncome[0]?.total || 0;
        const mooeIncomeSum = mooeIncome[0]?.total || 0;
        const coIncomeSum = coIncome[0]?.total || 0;
        
        const expenseSum = psSum + mooeSum + coSum;
        // Projected Income = PS Charged to Income + MOOE Income + CO Income (NOT including Corporate Income)
        const projectedIncomeSum = psChargedSum + mooeIncomeSum + coIncomeSum;
        const newTotal = projectedIncomeSum + expenseSum;

        console.log('📊 Recalculated proposal totals after edits:', {
          proposalId: proposal._id,
          corporateIncome: incomeSum + ' (NOT included in projectedCorporateIncome)',
          psChargedToIncome: psChargedSum,
          mooeIncome: mooeIncomeSum,
          coIncome: coIncomeSum,
          projectedIncome: projectedIncomeSum,
          personnelServices: psSum,
          mooe: mooeSum,
          capitalOutlay: coSum,
          oldTotalIncome: proposal.totalIncome,
          oldTotalExpenses: proposal.totalExpenses,
          newTotal: newTotal
        });

        // Update proposal with new totals
        // NOTE: projectedCorporateIncome = PS Charged + MOOE Income + CO Income (NOT Corporate Income)
        proposal.totalIncome = projectedIncomeSum;
        proposal.totalExpenses = expenseSum;
        proposal.proposedBudget = projectedIncomeSum + expenseSum;
        proposal.projectedCorporateIncome = projectedIncomeSum;
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
  'Under Review by Reviewer': 'Division Submitted',
  'Reviewer Approved': 'Division Submitted',
  'Forwarded to Officer': 'Department Verified',
  'Under Review by Officer': 'Department Verified',
  'Officer Approved': 'Department Submitted',
  'Forwarded to Manager': 'Region Approved',
  // New explicit status name (Nov 2025)
  'Forwarded to Overall Budget Approver': 'Region Approved',
  'Under Review by Manager': 'Region Approved',
  'Finalized': 'Finalized',
  Returned: 'Returned'
};

const WORKFLOW_LEVEL_MAPPING = {
  BUDGET_REVIEWER: 'DIVISION',
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

    // CRITICAL FIX: Also set proposalId to link line items to this proposal
    // This ensures recalculateProposalTotals can find the correct line items
    const updateFields = { 
      status: mappedStatus, 
      workflowLevel: mappedWorkflowLevel,
      proposalId: proposal._id  // Link line items to this proposal
    };

    await Promise.all([
      Income.updateMany(criteria, { $set: updateFields }),
      PersonnelServices.updateMany(criteria, { $set: updateFields }),
      MOOE.updateMany(criteria, { $set: updateFields }),
      CapitalOutlay.updateMany(criteria, { $set: updateFields })
    ]);

    console.log(`✅ Synced budget items to proposal ${proposal._id}:`, {
      status: mappedStatus,
      workflowLevel: mappedWorkflowLevel,
      itemsLinked: 'proposalId set'
    });
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

// BRD statuses: proposal first seen by Budget and Revenue Division
const BRD_STATUSES = [
  'Forwarded to Budget Planning Analyst',
  'Forwarded to Budget Officer',
  'Forwarded to Overall Budget Approver',
  'FORWARDED_TO_BRD_ANALYST',
  'FORWARDED_TO_BRD_OFFICER',
  'FORWARDED_TO_BRD_MANAGER'
];

/**
 * Capture initial budget snapshot when proposal first reaches BRD (for version history).
 * Idempotent: only creates if no snapshot exists for this proposal.
 */
const captureInitialBudgetSnapshotIfNeeded = async (proposal, income, personnelServices, mooe, capitalOutlay) => {
  if (!proposal || !proposal._id) return;
  const status = String(proposal.status || '').trim();
  if (!BRD_STATUSES.some(s => status === s)) return;
  const existing = await ProposalBudgetSnapshot.findOne({ proposalId: proposal._id }).lean();
  if (existing) return;
  const toNum = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  const sumIncome = (income || []).reduce((s, i) => s + toNum(i.amount), 0);
  const psFields = ['annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive', 'medical', 'childrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus', 'gsisPremium', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation', 'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'];
  const sumPS = (arr = []) => arr.reduce((s, p) => s + psFields.reduce((t, f) => t + toNum(p[f]), 0), 0);
  const sumMOOE = (mooe || []).reduce((s, m) => s + toNum(m.amount), 0);
  const sumCO = (capitalOutlay || []).reduce((s, c) => s + toNum(c.income) + toNum(c.subsidy), 0);
  await ProposalBudgetSnapshot.create({
    proposalId: proposal._id,
    capturedWhen: 'BRD_RECEIPT',
    proposalStatusAtCapture: status,
    proposalMeta: {
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      processBy: proposal.processBy,
      title: proposal.title,
      department: proposal.department,
      division: proposal.division
    },
    snapshot: {
      income: (income || []).map(doc => ({ ...doc })),
      personnelServices: (personnelServices || []).map(doc => ({ ...doc })),
      mooe: (mooe || []).map(doc => ({ ...doc })),
      capitalOutlay: (capitalOutlay || []).map(doc => ({ ...doc }))
    },
    totals: {
      totalIncome: sumIncome,
      totalPersonnel: sumPS(personnelServices),
      totalMOOE: sumMOOE,
      totalCapitalOutlay: sumCO
    }
  });
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
  const isOverallApprover = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('SUPER ADMIN');
  const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
  const isBudgetAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST');
  // Include hierarchical workflow roles for robust reviewer detection
  const assignment = req.userHierarchicalAssignment || {};
  const workflowRoles = Array.isArray(assignment.workflowRoles) ? assignment.workflowRoles.map(r => String(r).toLowerCase()) : [];
  const isReviewerUserRole = userRoles.some(r => String(r).toUpperCase() === 'REVIEWER' || String(r).toUpperCase() === 'BUDGET_REVIEWER');
  const isReviewerWorkflowRole = workflowRoles.includes('divisionreviewer') || workflowRoles.includes('officereviewer') || workflowRoles.includes('reviewer');
  const isReviewer = isReviewerUserRole || isReviewerWorkflowRole;
    const isApproverLevel = hasApproverRole(userRoles);
    
    // Get current user ID for filtering own edits
    const usernameArray = Array.isArray(req.user?.Username)
      ? req.user.Username
      : req.user?.Username
      ? [req.user.Username]
      : [];
    const userId = String(
      req.user?.userId || 
      req.user?.id || 
      req.user?.Id || 
      req.user?.userCode || 
      usernameArray[0] || 
      req.user?.username || 
      req.user?.name || 
      ''
    ).trim();
    
    console.log('🔍 User ID resolution details:', {
      rawUser: {
        userId: req.user?.userId,
        id: req.user?.id,
        Id: req.user?.Id,
        userCode: req.user?.userCode,
        Username: req.user?.Username,
        username: req.user?.username,
        name: req.user?.name
      },
      resolvedUserId: userId,
      usernameArray
    });
    
    console.log('🔐 getProposalForEdit - User identification:', {
      userId,
      userRoles,
      isOverallApprover,
      isBudgetOfficer,
      isBudgetAnalyst,
      isApproverLevel,
      hasApproverRole: hasApproverRole(userRoles)
    });
    
    // Check if proposal is already submitted or approved - prevent further editing
    // OVERALL_BUDGET_APPROVER can view proposals forwarded to them (to approve/reject)
    // BUDGET_OFFICER cannot edit proposals forwarded to manager, officer approved, or approved
    if (['Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Office Submitted'].includes(proposal.status)) {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isOverallApprover) {
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
    // Budget Manager should ONLY see edits submitted by Budget Officer (not Budget Reviewer)
    // Budget Officer should see their own Draft or edits from Budget Reviewer
    // APPROVER should see their own Draft or Submitted edits
    // Budget Planning Analyst should see edits from APPROVER or their own edits
    let existingEdit;
    let fetchQuery;
    
    if (isOverallApprover && !isBudgetOfficer) {
      // Overall Approver: Only show edits submitted by BUDGET_OFFICER
      fetchQuery = {
        proposalId: proposal._id,
        status: 'Submitted',
        'editedBy.role': 'BUDGET_OFFICER'
      };
      console.log('📋 OVERALL_APPROVER querying for submitted BUDGET_OFFICER edits:', fetchQuery);
      existingEdit = await BudgetOfficerEdit.findOne(fetchQuery).sort({ updatedAt: -1 });
    } else if (isBudgetAnalyst) {
      // Budget Planning Analyst: Show edits from APPROVER or their own edits
      fetchQuery = {
        proposalId: proposal._id,
        status: { $in: ['Draft', 'Submitted'] },
        'editedBy.role': { $in: ['APPROVER', 'BUDGET_PLANNING_ANALYST'] }
      };
      console.log('📋 BUDGET_PLANNING_ANALYST querying for APPROVER/BUDGET_PLANNING_ANALYST edits:', fetchQuery);
      existingEdit = await BudgetOfficerEdit.findOne(fetchQuery).sort({ updatedAt: -1 });
    } else {
      // APPROVER_LEVEL: Can see their own Draft edits OR Submitted edits from PREPARER/BUDGET_PLANNING_ANALYST
      if (isApproverLevel) {
        fetchQuery = {
          proposalId: proposal._id,
          $or: [
            { status: 'Draft', 'editedBy.userId': userId },
            { status: 'Submitted', 'editedBy.role': { $in: ['BUDGET PREPARER', 'BUDGET_PLANNING_ANALYST'] } }
          ]
        };
        console.log('📋 APPROVER_LEVEL querying for own drafts OR PREPARER/BUDGET_PLANNING_ANALYST submissions:', {
          fetchQuery,
          userId,
          isApproverLevel,
          userRoles
        });
      } else {
        // Others (BUDGET_OFFICER, etc.): Show their own Draft or Submitted edits ONLY
        fetchQuery = {
          proposalId: proposal._id,
          status: { $in: ['Draft', 'Submitted'] },
          'editedBy.userId': userId
        };
        console.log('📋 Other roles querying for THEIR OWN drafts/submitted edits:', {
          searchUserId: userId,
          queryObject: fetchQuery
        });
      }
      existingEdit = await BudgetOfficerEdit.findOne(fetchQuery).sort({ updatedAt: -1 });
      
      if (existingEdit) {
        console.log('✅ Found existing edit:', {
          editId: existingEdit._id,
          documentUserId: existingEdit.editedBy?.userId,
          documentUserName: existingEdit.editedBy?.userName,
          userIdMatch: existingEdit.editedBy?.userId === userId,
          searchedUserId: userId
        });
      } else {
        console.log('❌ NO existing edit found. Checking what edits exist in DB for this proposal...');
        const allEdits = await BudgetOfficerEdit.find({
          proposalId: proposal._id,
          status: { $in: ['Draft', 'Submitted'] }
        });
        console.log('📊 All edits for this proposal:', allEdits.map(e => ({
          _id: e._id,
          editedByUserId: e.editedBy?.userId,
          editedByUserName: e.editedBy?.userName,
          status: e.status
        })));
      }
      
      // Fallback: If no edit found with userId, check if there are any drafts without editedBy.userId
      // This handles edge cases with legacy documents
      if (!existingEdit) {
        console.log('⚠️  No edit found with userId filter, checking for legacy documents...');
        const legacyEdit = await BudgetOfficerEdit.findOne({
          proposalId: proposal._id,
          status: { $in: ['Draft', 'Submitted'] },
          'editedBy.userId': { $exists: false }
        }).sort({ updatedAt: -1 });
        
        if (legacyEdit) {
          console.log('⚠️  Found legacy document without editedBy.userId:', {
            editId: legacyEdit._id,
            processBy: legacyEdit.processBy
          });
          existingEdit = legacyEdit;
        }
      }
    }
    
    console.log('🔍 Existing edit search result:', {
      found: !!existingEdit,
      editId: existingEdit?._id,
      editStatus: existingEdit?.status,
      editedByRole: existingEdit?.editedBy?.role,
      editedByUserId: existingEdit?.editedBy?.userId,
      hasEditedIncome: !!existingEdit?.editedIncome?.length,
      editedIncomeCount: existingEdit?.editedIncome?.length || 0,
      hasEditedPersonnel: !!existingEdit?.editedPersonnelServices?.length,
      editedPersonnelCount: existingEdit?.editedPersonnelServices?.length || 0,
      hasEditedMOOE: !!existingEdit?.editedMOOE?.length,
      editedMOOECount: existingEdit?.editedMOOE?.length || 0,
      hasEditedCapitalOutlay: !!existingEdit?.editedCapitalOutlay?.length,
      editedCapitalOutlayCount: existingEdit?.editedCapitalOutlay?.length || 0,
      queryUsed: fetchQuery,
      rolesChecked: { isOverallApprover, isBudgetOfficer, isBudgetAnalyst, isApproverLevel }
    });
    
    // If no edit found, let's see what's in the database
    if (!existingEdit) {
      console.log('⚠️ NO EXISTING EDIT FOUND - Let\'s check what\'s in the database for this proposal:');
      const allEdits = await BudgetOfficerEdit.find({ proposalId: proposal._id }).lean();
      console.log('📊 All drafts/submissions for this proposal:', allEdits.map(e => ({
        _id: e._id,
        status: e.status,
        role: e.editedBy?.role,
        incomeCount: e.editedIncome?.length,
        personnelCount: e.editedPersonnelServices?.length
      })));
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

    // Capture initial budget snapshot for BRD version history (original vs revised) if not yet captured
    try {
      await captureInitialBudgetSnapshotIfNeeded(proposal, income, personnelServices, mooe, capitalOutlay);
    } catch (snapErr) {
      console.warn('ProposalBudgetSnapshot capture failed (non-fatal):', snapErr.message);
    }
    
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
      
      console.log('📝 Returning edited data for APPROVER:', {
        hasEditedMOOE: !!existingEdit.editedMOOE?.length,
        mooeSample: existingEdit.editedMOOE?.[0] ? {
          id: existingEdit.editedMOOE[0]._id || existingEdit.editedMOOE[0].id,
          particular: existingEdit.editedMOOE[0].particular,
          amount: existingEdit.editedMOOE[0].amount,
          subsidyAmount: existingEdit.editedMOOE[0].subsidyAmount
        } : 'No edited MOOE data'
      });
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
      comments,
      // Debug MOOE data specifically
      mooeSample: editedMOOE?.[0] ? {
        id: editedMOOE[0]._id || editedMOOE[0].id,
        particular: editedMOOE[0].particular,
        amount: editedMOOE[0].amount,
        subsidyAmount: editedMOOE[0].subsidyAmount
      } : 'No MOOE data'
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
    const isOverallApprover = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('SUPER ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    const isBudgetAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST');

    // Normalize workflow roles from hierarchical assignment for reviewer/approver detection
    const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
    const workflowRoles = Array.isArray(assignment.workflowRoles)
      ? assignment.workflowRoles.map((r) => String(r || '').toLowerCase())
      : [];

    // Reviewer detection (mirrors logic used elsewhere in this controller)
    const isReviewerUserRole = Array.isArray(userRoles)
      ? userRoles.some((r) => {
          const s = String(r || '').toUpperCase();
          return s === 'REVIEWER' || s === 'BUDGET REVIEWER' || s === 'BUDGET_REVIEWER';
        })
      : false;
    const isReviewerWorkflowRole = workflowRoles.includes('divisionreviewer') || workflowRoles.includes('officereviewer') || workflowRoles.includes('reviewer');
    const isReviewer = isReviewerUserRole || isReviewerWorkflowRole;
    
    
    // Check if proposal is already submitted or approved - prevent further editing
    // OVERALL_BUDGET_APPROVER can view proposals forwarded to them (to approve/reject)
    // BUDGET_OFFICER cannot edit proposals forwarded to manager, officer approved, or approved
    if (['Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Office Submitted'].includes(proposal.status)) {
      // Allow BUDGET_MANAGER to view, block BUDGET_OFFICER
      if (isBudgetOfficer && !isOverallApprover) {
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
    
    // Check if there's an existing draft - ONLY allow editing own drafts
    let budgetOfficerEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: 'Draft',
      'editedBy.userId': userId  // Only find drafts owned by current user
    });
    
    // Determine the role of the editor - PRIORITY ORDER MATTERS!
    // Must check specific roles BEFORE generic ones to avoid misclassification
    let editorRole;
    if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN')) {
      editorRole = 'BUDGET_MANAGER';
    } else if (userRoles.includes('BUDGET_OFFICER')) {
      editorRole = 'BUDGET_OFFICER';
    } else if (hasApproverRole(userRoles)) {
      editorRole = 'APPROVER';
    } else if (userRoles.includes('BUDGET_PLANNING_ANALYST')) {
      editorRole = 'BUDGET_PLANNING_ANALYST';
    } else if (userRoles.includes('BUDGET REVIEWER')) {
      editorRole = 'BUDGET REVIEWER';
    } else {
      editorRole = 'BUDGET PREPARER';
    }
    
    console.log('🔍 Editor role determination:', {
      userRoles,
      editorRole,
      isOverallApprover,
      isBudgetOfficer,
      isBudgetAnalyst
    });
    
    // Map editor role for BudgetOfficerEdit.editedBy.role enum
    const editDocRole = editorRole;
    
    if (budgetOfficerEdit) {
      // Update existing draft
      budgetOfficerEdit.editedIncome = editedIncome || [];
      budgetOfficerEdit.editedPersonnelServices = editedPersonnelServices || [];
      budgetOfficerEdit.editedMOOE = editedMOOE || [];
      budgetOfficerEdit.editedCapitalOutlay = editedCapitalOutlay || [];
      budgetOfficerEdit.comments = comments;
      budgetOfficerEdit.updatedAt = new Date();
      // Update the entire editedBy object (handle missing editedBy for backward compatibility)
      budgetOfficerEdit.editedBy = {
        userId,
        userName,
        email: userEmail,
        role: editDocRole
      };
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
      cobExpenditures: budgetOfficerEdit.cobExpenditures,
      editedMOOELength: budgetOfficerEdit.editedMOOE?.length,
      mooeSample: budgetOfficerEdit.editedMOOE?.[0] ? {
        id: budgetOfficerEdit.editedMOOE[0]._id || budgetOfficerEdit.editedMOOE[0].id,
        particular: budgetOfficerEdit.editedMOOE[0].particular,
        amount: budgetOfficerEdit.editedMOOE[0].amount,
        subsidyAmount: budgetOfficerEdit.editedMOOE[0].subsidyAmount
      } : 'No MOOE data in saved edit'
    });
    
    await budgetOfficerEdit.save();
    
    // Recalculate proposal totals after saving draft
    try {
      const totalsResult = await recalculateAndSaveProposalTotals({ proposalId: proposal._id });
      console.log('✅ Proposal totals recalculated after draft save:', {
        proposalId: proposal._id.toString(),
        totalIncome: totalsResult.totals.income,
        totalExpenses: totalsResult.totals.expenses,
        projectedSubsidy: totalsResult.totals.subsidies,
        proposedBudget: totalsResult.totals.proposedBudget
      });
    } catch (calcError) {
      console.warn('⚠️ Warning: Failed to recalculate proposal totals after draft save:', calcError.message);
      // Continue even if recalculation fails - the draft save shouldn't fail
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
    const isOverallApprover = userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET_ADMIN');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    const isBudgetAnalyst = userRoles.includes('BUDGET_PLANNING_ANALYST');
    
    // Normalize workflow roles from hierarchical assignment for reviewer/approver detection
    const assignment = req.userHierarchicalAssignment || req.user?.hierarchicalAssignment || {};
    const workflowRoles = Array.isArray(assignment.workflowRoles)
      ? assignment.workflowRoles.map((r) => String(r || '').toLowerCase())
      : [];

    // Reviewer detection (mirrors logic used elsewhere in this controller)
    const isReviewerUserRole = Array.isArray(userRoles)
      ? userRoles.some((r) => {
          const s = String(r || '').toUpperCase();
          return s === 'REVIEWER' || s === 'BUDGET REVIEWER' || s === 'BUDGET_REVIEWER';
        })
      : false;
    const isReviewerWorkflowRole = workflowRoles.includes('divisionreviewer') || workflowRoles.includes('officereviewer') || workflowRoles.includes('reviewer');
    const isReviewer = isReviewerUserRole || isReviewerWorkflowRole;
    
    // Check if proposal is already submitted or approved - prevent further editing
    // OVERALL_APPROVER can view proposals forwarded to them (to approve/reject)
    // BUDGET_OFFICER cannot submit proposals forwarded to manager, officer approved, or approved
    if (['Forwarded to Overall Budget Approver', 'Forwarded to Manager', 'Office Submitted'].includes(proposal.status)) {
      // Allow OVERALL_APPROVER to view, block BUDGET_OFFICER from submitting
      if (isBudgetOfficer && !isOverallApprover) {
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
      : userRoles.includes('BUDGET_OFFICER')
      ? 'BUDGET_OFFICER'
      : hasApproverRole(userRoles)
      ? 'APPROVER'
      : userRoles.includes('BUDGET_PLANNING_ANALYST')
      ? 'BUDGET_PLANNING_ANALYST'
      : isReviewer
      ? 'BUDGET_REVIEWER'
      : 'BUDGET PREPARER';
    console.log('👤 Editor role resolution (submitEdit):', {
      userRoles,
      workflowRoles,
      isOverallApprover,
      isBudgetOfficer,
      isBudgetAnalyst,
      isReviewerUserRole,
      isReviewerWorkflowRole,
      resolvedEditorRole: editorRole
    });
    // Map editor role for BudgetOfficerEdit.editedBy.role enum
    const editDocRole = editorRole;
    
    // Check if there's an existing draft - ONLY allow submitting own drafts
    let budgetOfficerEdit = await BudgetOfficerEdit.findOne({
      proposalId,
      status: 'Draft',
      'editedBy.userId': userId  // Only find drafts owned by current user
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
    // This ensures that when Budget Officer loads the proposal, they see the Budget Reviewer's changes
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
    let newWorkflowLevel = proposal.workflowLevel || 'BUDGET REVIEWER';
    let historyAction = 'EDIT';
    let historyComment = comments || `${editorRole} submitted edits`;
    let currentStep = proposal.currentStep;
    let currentAssigneeRole = proposal.currentAssigneeRole;
    let pendingRoles = Array.isArray(proposal.pendingWithRoles) ? [...proposal.pendingWithRoles] : [];

    if (editorRole === 'BUDGET PREPARER') {
      // BUDGET PREPARER submits to BUDGET REVIEWER
      newStatus = 'Forwarded to Reviewer';
      newWorkflowLevel = 'BUDGET REVIEWER';
      historyAction = 'PREPARER_SUBMIT_TO_BUDGET_REVIEWER';
      historyComment = comments || 'Budget Preparer submitted edits to Budget Reviewer';
      currentStep = 'BUDGET_REVIEWER_REVIEW';
      currentAssigneeRole = 'BUDGET_REVIEWER';
      pendingRoles = ['BUDGET_REVIEWER'];
      proposal.submittedByRole = 'BUDGET PREPARER';
      proposal.submittedToDivisionAt = now;
      proposal.submittedToDivisionBy = { userId, userName };
    } else if (editorRole === 'BUDGET_REVIEWER' || editorRole === 'REVIEWER') {
      // BUDGET REVIEWER submits to BUDGET APPROVER (strict 6-step flow)
      newStatus = 'Forwarded to Approver';
      newWorkflowLevel = 'BUDGET APPROVER';
      historyAction = 'REVIEWER_SUBMIT_TO_APPROVER';
      historyComment = comments || 'Budget Reviewer submitted edits to Budget Approver';
      currentStep = 'APPROVER_REVIEW';
      currentAssigneeRole = 'BUDGET_APPROVER';
      pendingRoles = ['BUDGET_APPROVER'];
      proposal.submittedByRole = 'REVIEWER';
      proposal.forwardedToApproverAt = now;
      proposal.forwardedToApproverBy = { userId, userName };
    } else if (editorRole === 'BUDGET_PLANNING_ANALYST') {
      // New BUDGET_PLANNING_ANALYST role submits to BUDGET_OFFICER
      newStatus = 'Forwarded to Budget Officer';
      newWorkflowLevel = 'OFFICER';
      historyAction = 'ANALYST_SUBMIT_TO_OFFICER';
      historyComment = comments || 'Budget Planning Analyst submitted for Officer review';
      currentStep = 'OFFICER_REVIEW';
      currentAssigneeRole = 'BUDGET_OFFICER';
      pendingRoles = ['BUDGET_OFFICER'];
      proposal.submittedByRole = 'BUDGET_PLANNING_ANALYST';
      proposal.forwardedToOfficerAt = now;
      proposal.forwardedToOfficerBy = { userId, userName };
    } else if (editorRole === 'APPROVER') {
      // APPROVER forwards to BUDGET_PLANNING_ANALYST (next step in workflow)
      newStatus = 'Forwarded to Budget Planning Analyst';
      newWorkflowLevel = 'BUDGET_PLANNING_ANALYST';
      historyAction = 'APPROVER_SUBMIT_TO_ANALYST';
      historyComment = comments || 'Approver submitted edits to Budget Planning Analyst';
      currentStep = 'BUDGET_PLANNING_ANALYST_REVIEW';
      currentAssigneeRole = 'BUDGET_PLANNING_ANALYST';
      pendingRoles = ['BUDGET_PLANNING_ANALYST'];
      proposal.submittedByRole = 'APPROVER';
      proposal.forwardedToAnalystAt = now;
      proposal.forwardedToAnalystBy = { userId, userName };
    } else if (editorRole === 'BUDGET_OFFICER') {
      // Officer submits to Manager
      newStatus = 'Forwarded to Overall Budget Approver';
      newWorkflowLevel = 'MANAGER';
      historyAction = 'OFFICER_SUBMIT_TO_MANAGER';
      historyComment = comments || 'Budget Officer submitted edits to Overall Budget Approver';
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
    
    // Recalculate proposal totals after changes
    try {
      const totalsResult = await recalculateAndSaveProposalTotals({ proposalId: proposal._id });
      // Reload proposal to get updated totals
      const updatedProposal = await Proposal.findById(proposal._id);
      if (updatedProposal) {
        proposal.totalIncome = updatedProposal.totalIncome;
        proposal.totalExpenses = updatedProposal.totalExpenses;
        proposal.projectedSubsidy = updatedProposal.projectedSubsidy;
        proposal.proposedBudget = updatedProposal.proposedBudget;
      }
      console.log('✅ Proposal totals recalculated:', {
        proposalId: proposal._id.toString(),
        totalIncome: totalsResult.totals.income,
        totalExpenses: totalsResult.totals.expenses,
        projectedSubsidy: totalsResult.totals.subsidies,
        proposedBudget: totalsResult.totals.proposedBudget
      });
    } catch (calcError) {
      console.warn('⚠️ Warning: Failed to recalculate proposal totals:', calcError.message);
      // Continue even if recalculation fails - the workflow shouldn't fail
    }
    
    console.log('➡️ Workflow routed:', {
      proposalId: proposal._id.toString(),
      newStatus,
      newWorkflowLevel,
      currentStep,
      currentAssigneeRole,
      pendingRoles
    });
    
    let logSummary = 'Submitted edits for approval';
    if (editorRole === 'BUDGET PREPARER') {
      logSummary = 'Submitted edits to Budget Reviewer';
    } else if (editorRole === 'BUDGET_PLANNING_ANALYST') {
      logSummary = 'Submitted analysis to Budget Officer';
    } else if (editorRole === 'APPROVER') {
      logSummary = 'Submitted edits to Budget Planning Analyst';
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

      if (editorRole === 'BUDGET_PLANNING_ANALYST') {
        notificationTitle = 'Proposal Submitted for BUDGET_OFFICER Review';
        notificationMessage = `BUDGET_PLANNING_ANALYST has submitted the proposal "${proposal.title}" for your review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
        displayTargetRole = 'BUDGET_OFFICER';
        displayRoleForResponse = 'BUDGET_OFFICER';
      } else if (editorRole === 'APPROVER') {
        if (currentAssigneeRole === 'BUDGET_MANAGER') {
          notificationTitle = 'Proposal Submitted for OVERALL_BUDGET_APPROVER Review (Bypassed Officer)';
          notificationMessage = `APPROVER has submitted the proposal "${proposal.title}" directly to you for final review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
          displayTargetRole = 'OVERALL_BUDGET_APPROVER';
          displayRoleForResponse = 'OVERALL_BUDGET_APPROVER';
        } else {
          // Approver forwarding to Budget Planning Analyst
          notificationTitle = 'Proposal Submitted for BUDGET_PLANNING_ANALYST Review';
          notificationMessage = `APPROVER has submitted the proposal "${proposal.title}" for your review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
          displayTargetRole = 'BUDGET_PLANNING_ANALYST';
          displayRoleForResponse = 'BUDGET_PLANNING_ANALYST';
        }
      } else if (editorRole === 'APPROVER') {
        notificationTitle = 'Proposal Approved and Forwarded';
        notificationMessage = `APPROVER has approved and forwarded the proposal "${proposal.title}" for your review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
        displayTargetRole = 'BUDGET_PLANNING_ANALYST';
        displayRoleForResponse = 'BUDGET_PLANNING_ANALYST';
      } else if (editorRole === 'BUDGET_OFFICER') {
        notificationTitle = 'Proposal Submitted for OVERALL_BUDGET_APPROVER Review';
        notificationMessage = `BUDGET_OFFICER has submitted the proposal "${proposal.title}" for your final review and approval. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
      }

      // Safeguard: ensure message is never empty or just an ID
      if (!notificationMessage || notificationMessage.trim() === '' || /^[a-f0-9]{24}$/.test(notificationMessage.trim())) {
        notificationMessage = `Proposal "${proposal.title}" submitted for review. Fiscal Year: ${proposal.fiscalYear} - ${proposal.budgetType}`;
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
          relatedLink: `/allproposal?tab=all-proposals&proposalId=${proposalId}`,
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
  // Attach a unique key for deduplication per editor role + proposal + target role
  notificationsToSend[notificationsToSend.length - 1].metadata.uniqueKey = `${editorRole}_${proposalId}_${displayTargetRole}`;
      }
    } else {
      // BUDGET_MANAGER finalized - mark forwardedTo as empty (no further routing)
      budgetOfficerEdit.forwardedTo_UserId = [];
      budgetOfficerEdit.forwardedTo_Role = 'FINALIZED';
    }

    // Send all notifications
    if (notificationsToSend.length > 0) {
      try {
        await createNotifications(notificationsToSend, { initiatorUserId: userId });
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
 * Get version history of initial budget proposal (original + revisions) for BRD (Budget Officer / Budget Manager).
 * Returns snapshot as "original" and list of BudgetOfficerEdit (Submitted/Approved) as "revisions".
 */
exports.getVersionHistory = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userRoles = (req.user?.Roles || []).map(String);

    const isBRD =
      userRoles.some(r => /BUDGET_OFFICER|BUDGET OFFICER/i.test(r)) ||
      userRoles.some(r => /BUDGET_MANAGER|OVERALL_BUDGET_APPROVER|BUDGET MANAGER/i.test(r)) ||
      userRoles.some(r => /SUPER_ADMIN|SUPER ADMIN/i.test(r));

    if (!isBRD) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Version history is available only to Budget Officer and Budget Manager (BRD level).'
      });
    }

    // Accept either legacy Proposal._id or NewProposalWorkflow._id (workflowRef)
    let proposal = await Proposal.findById(proposalId).lean();
    if (!proposal) {
      proposal = await Proposal.findOne({
        $or: [{ workflowRef: proposalId }, { proposalId: proposalId }]
      }).lean();
    }
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }
    const legacyProposalId = proposal._id;

    const [snapshot, revisions] = await Promise.all([
      ProposalBudgetSnapshot.findOne({ proposalId: legacyProposalId }).lean(),
      BudgetOfficerEdit.find({
        proposalId: legacyProposalId,
        status: { $in: ['Submitted', 'Approved'] }
      })
        .sort({ submittedAt: 1 })
        .lean()
    ]);

    const revisionList = (revisions || []).map(edit => {
      let changeSummary = null;
      try {
        const doc = new BudgetOfficerEdit(edit);
        if (doc.getChangeSummary) changeSummary = doc.getChangeSummary();
      } catch (_) {}
      return {
        _id: edit._id,
        submittedAt: edit.submittedAt,
        approvedAt: edit.approvedAt,
        status: edit.status,
        editedBy: edit.editedBy,
        comments: edit.comments,
        changeSummary,
        editedData: {
          income: edit.editedIncome,
          personnelServices: edit.editedPersonnelServices,
          mooe: edit.editedMOOE,
          capitalOutlay: edit.editedCapitalOutlay
        }
      };
    });

    res.json({
      success: true,
      data: {
        proposal: { _id: proposal._id, title: proposal.title, status: proposal.status, fiscalYear: proposal.fiscalYear, processBy: proposal.processBy },
        original: snapshot ? {
          capturedAt: snapshot.capturedAt,
          proposalStatusAtCapture: snapshot.proposalStatusAtCapture,
          snapshot: snapshot.snapshot,
          totals: snapshot.totals
        } : null,
        revisions: revisionList
      }
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch version history',
      error: error.message
    });
  }
};

/**
 * Get comparison data for Preparer
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
          // Apply compensation settings for any missing fields
          const { getActiveSettingsWithCompensation } = require("../utils/settingsUtils");
          const activeSettings = await getActiveSettingsWithCompensation();
          
          const personnelData = { ...item };
          if (activeSettings) {
            // Apply compensation settings for missing fields
            if (personnelData.PERA === undefined || personnelData.PERA === null) {
              personnelData.PERA = (activeSettings.PERA || 0) * 12;
            }
            if (personnelData.uniformALLOWANCE === undefined || personnelData.uniformALLOWANCE === null) {
              personnelData.uniformALLOWANCE = (activeSettings.uniformAllowance || 0) * 12;
            }
            if (personnelData.productivityIncentive === undefined || personnelData.productivityIncentive === null) {
              personnelData.productivityIncentive = (activeSettings.productivityIncentive || 0) * 12;
            }
            if (personnelData.cashGift === undefined || personnelData.cashGift === null) {
              personnelData.cashGift = (activeSettings.cashGift || 0) * 12;
            }
            if (personnelData.pagibigPremium === undefined || personnelData.pagibigPremium === null) {
              personnelData.pagibigPremium = (activeSettings.pagibigPremium || 0) * 12;
            }
            if (personnelData.medical === undefined || personnelData.medical === null) {
              personnelData.medical = (activeSettings.medicalAllowance || 0) * 12;
            }
            if (personnelData.employeeCompensation === undefined || personnelData.employeeCompensation === null) {
              personnelData.employeeCompensation = (activeSettings.employeeCompensation || 0) * 12;
            }
            if (personnelData.gsisPremium === undefined || personnelData.gsisPremium === null) {
              personnelData.gsisPremium = (personnelData.annualSalary || 0) * (activeSettings.gsisPremium || 0);
            }
          }
          
          const newPS = new PersonnelServices({
            ...personnelData,
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
      
      // Notify Preparer
      await createNotification({
        userId: edit.processBy,
        type: 'PROPOSAL_APPROVED',
        title: 'Proposal Edits Approved',
        message: `Your proposal (${edit.fiscalYear} - ${edit.budgetType}) has been approved by the Budget Officer.`,
        relatedId: edit.proposalId,
        relatedType: 'Proposal',
        metadata: {
          proposalId: edit.proposalId,
          uniqueKey: `APPROVE_${edit.proposalId}`,
          performedBy: userName,
          performedByRole: roles && roles.length ? roles[0] : undefined
        }
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