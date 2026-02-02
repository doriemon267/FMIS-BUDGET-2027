const mongoose = require("mongoose");
const PersonnelServices = require("../models/PersonnelServices");
const Settings = require("../models/Settings");
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');

const getPersonnelByParams = async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, processBy, region, status, division } = req.query;
    const query = {};

    // When proposalId is provided (e.g. Proposal Details dialog), filter by workflowRef or legacy proposalId
    if (proposalId) {
      let workflowId = proposalId;
      if (typeof proposalId === 'string' && mongoose.Types.ObjectId.isValid(proposalId)) {
        try {
          workflowId = new mongoose.Types.ObjectId(proposalId);
        } catch (_) {}
      }
      try {
        query.$or = [{ workflowRef: workflowId }];
        const Proposal = require('../models/Proposal');
        const legacy = await Proposal.findOne({ workflowRef: workflowId }).select('_id').lean();
        if (legacy?._id) {
          query.$or.push({ proposalId: legacy._id });
        }
      } catch (_e) {
        query.proposalId = workflowId;
      }
    }

    if (fiscalYear) query.fiscalYear = String(fiscalYear);
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    if (division) query.division = division;

    let personnel = await PersonnelServices.find(query).lean();

    // If proposalId but no results, try workflowRef/proposalId only (in case fiscalYear/budgetType/division format differs)
    if (proposalId && personnel.length === 0 && query.$or) {
      const simpleQuery = { $or: query.$or };
      personnel = await PersonnelServices.find(simpleQuery).lean();
    }

    // Fallback: unlinked personnel (no workflowRef) with same fiscalYear + budgetType + division
    if (proposalId && personnel.length === 0 && (fiscalYear || budgetType)) {
      const conditions = [
        { $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] }
      ];
      if (fiscalYear) {
        conditions.push({ $or: [{ fiscalYear: String(fiscalYear) }, { fiscalYear: Number(fiscalYear) }, { fiscal_year: Number(fiscalYear) }] });
      }
      if (budgetType) {
        conditions.push({ budgetType: new RegExp(`^${String(budgetType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
      if (division) conditions.push({ division: new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

      let fallbackPersonnel = await PersonnelServices.find({ $and: conditions }).lean();
      if (fallbackPersonnel.length === 0 && division) {
        conditions.pop();
        fallbackPersonnel = await PersonnelServices.find({ $and: conditions }).lean();
      }
      if (fallbackPersonnel.length === 0 && budgetType) {
        conditions = conditions.filter((c) => !c.budgetType);
        if (conditions.length > 0) {
          fallbackPersonnel = await PersonnelServices.find({ $and: conditions }).lean();
        }
      }
      if (fallbackPersonnel.length > 0) {
        personnel = fallbackPersonnel;
      }
    }

    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
};

const bulkUpdatePersonnel = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and must not be empty" });
    }

    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    const workflowData = req.submissionWorkflowData || {};

    const updates = [];
    
    for (const item of items) {
      if (!item._id) {
        return res.status(400).json({ message: "Each item must have an _id field" });
      }

      const existingPersonnel = await PersonnelServices.findById(item._id);
      if (!existingPersonnel) {
        return res.status(404).json({ message: `Personnel entry with ID ${item._id} not found` });
      }

      const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
      if (submittedStatuses.includes(existingPersonnel.status)) {
        return res.status(403).json({
          error: "Update not allowed",
          message: `Cannot edit personnel record ${item._id} that has been submitted or approved`
        });
      }

      updates.push(
        PersonnelServices.findByIdAndUpdate(
          item._id,
          {
            Total: item.Total !== undefined ? item.Total : existingPersonnel.Total,
            amount: item.amount !== undefined ? item.amount : existingPersonnel.amount,
            ...(setFY ? { fiscalYear: setFY } : {}),
            ...(setBT ? { budgetType: setBT } : {}),
            region: item.region !== undefined ? item.region : (workflowData.region || existingPersonnel.region),
            department: item.department !== undefined ? item.department : (workflowData.department || existingPersonnel.department),
            division: item.division !== undefined ? item.division : (workflowData.division || existingPersonnel.division),
            processBy: item.processBy !== undefined ? item.processBy : (req.user?.userName || req.user?.id || existingPersonnel.processBy),
            processDate: item.processDate !== undefined ? item.processDate : new Date(),
            status: item.status !== undefined ? item.status : (workflowData.status || existingPersonnel.status),
            ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
            ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
          },
          { new: true }
        )
      );
    }

    const updatedItems = await Promise.all(updates);
    
    try {
      const proposalIds = new Set();
      for (const item of updatedItems) {
        if (item.proposalId) {
          proposalIds.add(item.proposalId);
        }
      }
      
      if (proposalIds.size > 0) {
        for (const proposalId of proposalIds) {
          await recalculateAndSaveProposalTotals({ proposalId });
        }
      }
    } catch (error) {
      console.error("Error recalculating proposal totals:", error);
    }

    res.status(200).json({ 
      message: "Personnel entries updated successfully", 
      updatedCount: updatedItems.length,
      items: updatedItems 
    });
  } catch (error) {
    console.error("Error updating personnel entries:", error);
    res.status(500).json({ message: "Failed to update personnel entries" });
  }
};

module.exports = {
  getPersonnelByParams,
  bulkUpdatePersonnel
};