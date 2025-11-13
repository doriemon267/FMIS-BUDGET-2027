const PersonnelServices = require("../models/PersonnelServices");
const Settings = require("../models/Settings");
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');

const getPersonnelByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    const personnel = await PersonnelServices.find(query).lean();
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