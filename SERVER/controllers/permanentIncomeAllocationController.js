const mongoose = require('mongoose');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const PersonnelServices = require('../models/PersonnelServices');
const { applyPermanentIncomeAllocation } = require('../utils/personnelIncomeAllocation');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { listSalaryReferences, loadSalaryReferences } = require('../services/permanentSalaryReferenceService');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const userIdOf = req => String(req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId || '');

async function getWorkflow(req, write = false) {
  const id = req.params.proposalId;
  if (!mongoose.isValidObjectId(id)) throw fail(400, 'A valid proposal is required.');
  const workflow = await NewProposalWorkflow.findById(id);
  if (!workflow) throw fail(404, 'Proposal not found.');
  const userId = userIdOf(req);
  const roles = (req.user?.Roles || req.user?.roles || []).map(role => String(role).toUpperCase().replace(/ /g, '_'));
  const isAdmin = roles.includes('SUPER_ADMIN');
  const isOwner = userId && (String(workflow.createdBy) === userId ||
    (workflow.assignedPreparerUserIds || []).some(id => String(id) === userId));
  if (!isOwner && !isAdmin) throw fail(403, 'Only the proposal preparer can configure its salary Income allocation.');
  if (write) {
    const activeId = req.get?.('X-Workflow-Ref') || req.headers?.['x-workflow-ref'];
    if (String(activeId || '') !== String(workflow._id)) {
      throw fail(403, 'Select this proposal as the active workflow before saving.');
    }
    if (!['DRAFT', 'RETURNED_TO_PREPARER'].includes(workflow.status) || workflow.modelType !== 'Initial') {
      throw fail(403, 'Salary Income allocation can only be changed in an editable Initial proposal.');
    }
    if (workflow.isLocked && String(workflow.lockedBy?.userId || '') !== userId) {
      throw fail(423, 'This proposal is locked by another user.');
    }
  }
  return workflow;
}

const responseFor = workflow => ({
  proposalId: String(workflow._id),
  mode: workflow.permanentIncomeAllocation?.mode ||
    (workflow.permanentIncomeAllocation?.monthlyAmount != null ? 'ALL_PERMANENT' : 'INCREMENT_ONLY'),
  monthlyAmount: workflow.permanentIncomeAllocation?.monthlyAmount ?? null,
  notes: workflow.permanentIncomeAllocation?.notes || '',
  cpcs1Reference: workflow.permanentIncomeAllocation?.referenceTables?.cpcs1?.id || '',
  cpcs2Reference: workflow.permanentIncomeAllocation?.referenceTables?.cpcs2?.id || '',
  cpcs1MatchBy: workflow.permanentIncomeAllocation?.referenceTables?.cpcs1?.matchBy || 'JG',
  cpcs2MatchBy: workflow.permanentIncomeAllocation?.referenceTables?.cpcs2?.matchBy || 'SG',
  stepReference: workflow.permanentIncomeAllocation?.referenceTables?.stepBase?.id || '',
  stepMatchBy: workflow.permanentIncomeAllocation?.referenceTables?.stepBase?.matchBy || 'SG',
});

exports.getPermanentIncomeAllocation = async (req, res) => {
  try {
    const workflow = await getWorkflow(req);
    return res.json({ ...responseFor(workflow), references: await listSalaryReferences() });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const applyAllocation = preview => async (req, res) => {
  try {
    const workflow = await getWorkflow(req, true);
    const { monthlyAmount, notes = '', mode = 'ALL_PERMANENT' } = req.body;
    if (!['STEP_INCREMENT', 'CPCS_DIFFERENCE', 'INCREMENT_ONLY', 'ALL_PERMANENT', 'FULL_SALARY', 'NO_INCOME'].includes(mode)) {
      throw fail(400, 'Select a valid salary Income allocation method.');
    }
    if (mode === 'ALL_PERMANENT' &&
        (typeof monthlyAmount !== 'number' || !Number.isFinite(monthlyAmount) || monthlyAmount < 0)) {
      throw fail(400, 'Enter a valid monthly Income allocation of zero or more.');
    }
    if (typeof notes !== 'string') throw fail(400, 'Notes must be text.');
    const config = {
      mode,
      monthlyAmount: mode === 'ALL_PERMANENT' ? Math.round(monthlyAmount * 100) / 100 : null,
      notes: notes.trim(),
      updatedBy: userIdOf(req),
      updatedAt: new Date(),
    };
    if (['STEP_INCREMENT', 'CPCS_DIFFERENCE'].includes(mode)) config.referenceTables = await loadSalaryReferences(req.body);
    // Include legacy-linked rows, without expanding to another proposal or year.
    const legacy = await Proposal.find({ workflowRef: workflow._id }).select('_id').lean();
    const scope = {
      statusOfAppointment: /^PERMANENT$/i,
      $or: [
        { workflowRef: workflow._id },
        { proposalId: { $in: [workflow._id, ...legacy.map(row => row._id)] }, workflowRef: null },
      ],
    };
    const rows = await PersonnelServices.find(scope).lean();
    const errors = [];
    const allocations = rows.map(row => {
      try { return applyPermanentIncomeAllocation(row, config); }
      catch (error) {
        if (!error.statusCode) throw error;
        errors.push(`${row.employeeFullName || row.employeeNumber || row._id}: ${error.message}`);
        return null;
      }
    });
    if (errors.length) return res.status(400).json({
      message: `${errors.length} personnel have invalid salary data. ${errors.slice(0, 5).join(' ')}`,
      errors,
    });
    const summary = {
      updatedCount: rows.length,
      chargedCount: allocations.filter(row => row.chargedToIncomeEligible).length,
      monthlyIncome: Math.round(allocations.reduce((sum, row) => sum + (row.chargedToIncomeMonthlyAmount || 0), 0) * 100) / 100,
      monthlySalarySubsidy: Math.round(allocations.reduce((sum, row) => sum + (row.salarySubsidyMonthlyAmount ?? row.cpcs1MonthlySalary ?? 0), 0) * 100) / 100,
    };
    if (preview) return res.json({ ...summary, personnel: rows.map((row, index) => ({
      id: row._id, name: row.employeeFullName || row.employeeNumber,
      cpcs1: allocations[index].cpcs1MonthlySalary, cpcs2: allocations[index].cpcs2MonthlySalary,
      salarySubsidy: allocations[index].salarySubsidyMonthlyAmount ?? allocations[index].cpcs1MonthlySalary,
      monthlySalary: allocations[index].monthlySalary ?? row.monthlySalary,
      step: row.step,
      income: allocations[index].chargedToIncomeMonthlyAmount,
    })) });
    // Persist the rule first. Saving again safely reapplies it after a partial failure.
    workflow.permanentIncomeAllocation = config;
    await workflow.save();
    if (rows.length) {
      await PersonnelServices.bulkWrite(rows.map((row, index) => ({
        updateOne: {
          filter: { _id: row._id, ...scope },
          update: { $set: { ...allocations[index], workflowRef: workflow._id } },
        },
      })));
    }
    await recalculateAndSaveProposalTotals({ workflowRef: workflow._id });
    return res.json({
      ...responseFor(workflow),
      ...summary,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};
exports.savePermanentIncomeAllocation = applyAllocation(false);
exports.previewPermanentIncomeAllocation = applyAllocation(true);
