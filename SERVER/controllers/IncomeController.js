const mongoose = require("mongoose");
const Income = require("../models/Income");
const Settings = require("../models/Settings");
// Create new income entry
exports.createIncome = async (req, res) => {
  try {
    const {
      particulars,
      cost,
      incomecategory,
      subcategory,
      category,
      amount,
      fiscalYear,
      budgetType,
      region,
      department,
      division,
      processBy,
      processDate,
    } = req.body;
    // Validate required fields
    if (!particulars || !incomecategory || amount === undefined || amount === null) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        details: "particulars, incomecategory, and amount are required" 
      });
    }
    // Get submission workflow data from middleware
    const workflowData = req.submissionWorkflowData || {};
    
    // Create new income entry with workflow data
    const newIncome = new Income({
      particulars,
      cost: cost || amount,
      incomecategory,
      subcategory,
      category,
      amount: Number(amount),
      fiscalYear: fiscalYear || new Date().getFullYear().toString(),
      budgetType: budgetType || "REGULAR",
      region: workflowData.region || region,
      department: workflowData.department || department,
      division: workflowData.division || division,
      originalLevel: workflowData.originalLevel || 'DEPARTMENT', // Default for income
      processBy: processBy || req.user?.userName || req.user?.id,
      processDate: processDate || new Date(),
      status: workflowData.status || "Draft" // Use new workflow status
    });
    await newIncome.save();
    res.status(201).json(newIncome);
  } catch (error) {
    console.error("Error creating income entry:", error);
    res.status(500).json({ message: "Failed to create income entry", error: error.message });
  }
};
// Update income entry
exports.updateIncome = async (req, res) => {
  try {
    const {
      particulars,
      cost,
      incomecategory,
      subcategory,
      category,
      amount,
      region,
      department,
      division,
      processBy,
      processDate,
      status
    } = req.body;
    // Find active settings; if none, keep current record's FY/BT
    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    
    // Get submission workflow data from middleware
    const workflowData = req.submissionWorkflowData || {};
    
    // Find and update the income entry
    const updatedIncome = await Income.findByIdAndUpdate(
      req.params.id,
      {
        particulars,
        cost: cost || amount,
        incomecategory,
        subcategory,
        category,
        amount,
        ...(setFY ? { fiscalYear: setFY } : {}),
        ...(setBT ? { budgetType: setBT } : {}),
        region: workflowData.region || region,
        department: workflowData.department || department,
        division: workflowData.division || division,
        processBy: processBy || req.user?.userName || req.user?.id,
        processDate: processDate || new Date(),
        status: status || workflowData.status || "Not Submitted"
      },
      { new: true }
    );
    if (!updatedIncome) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    res.status(200).json(updatedIncome);
  } catch (error) {
    console.error("Error updating income entry:", error);
    res.status(500).json({ message: "Failed to update income entry", error: error.message });
  }
};
// Delete income entry
exports.deleteIncome = async (req, res) => {
  try {
    const deletedIncome = await Income.findByIdAndDelete(req.params.id);
    if (!deletedIncome) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    res.status(200).json({ message: "Income entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting income entry:", error);
    res.status(500).json({ message: "Failed to delete income entry", error: error.message });
  }
};
// Calculate and save Net ISF
exports.calculateNetISF = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.body;
    if (!fiscalYear) {
      return res.status(400).json({ message: "Fiscal year is required" });
    }
    // Get active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ message: "No active settings found" });
    }
    // Calculate Net ISF based on income entries
    const incomeEntries = await Income.find({ 
      fiscalYear, 
      budgetType: budgetType || "Regular" 
    });
    let totalAmount = 0;
    incomeEntries.forEach(entry => {
      totalAmount += entry.amount;
    });
    // Apply any necessary calculations or formulas
    const netISF = totalAmount * (activeSettings.isfPercentage || 0.85);
    res.status(200).json({ 
      fiscalYear,
      budgetType: budgetType || "Regular",
      totalIncome: totalAmount,
      netISF,
      calculatedAt: new Date()
    });
  } catch (error) {
    console.error("Error calculating Net ISF:", error);
    res.status(500).json({ message: "Failed to calculate Net ISF", error: error.message });
  }
};
// Get all income entries (department/division aware)
exports.getAllIncome = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    // // Build query object
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Add region filter if provided
    if (region) {
      query.region = region;
    }
    // Use submission workflow data for filtering
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    
    // Apply region filter if not specified but user has workflow data
    if (!query.region && workflowData.region) {
      query.region = workflowData.region;
    }
    
    // Apply workflow-based filtering based on user level
    if (userLevel === 'DIVISION') {
      // Division users: only their division within their department and region
      if (workflowData.department) query.department = workflowData.department;
      if (workflowData.division) query.division = workflowData.division;
    } else if (userLevel === 'DEPARTMENT') {
      // Department users: can see their department data + SUBMITTED division data ONLY
      if (workflowData.department) {
        const baseQuery = {
          department: workflowData.department
        };
        
        // Apply region if available
        if (query.region) baseQuery.region = query.region;
        if (query.fiscalYear) baseQuery.fiscalYear = query.fiscalYear;
        if (query.budgetType) baseQuery.budgetType = query.budgetType;
        
        query = {
          $and: [
            baseQuery,
            {
              $or: [
                // 1. Department-level data (no division or by department user)
                {
                  $and: [
                    { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                  ]
                },
                // 2. Division data that has been SUBMITTED only (using new workflow statuses)
                {
                  $and: [
                    { division: { $exists: true, $ne: null, $ne: "" } },
                    { status: { $in: ["Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"] } }
                  ]
                }
              ]
            }
          ]
        };
      }
    } else if (userLevel === 'REGION') {
      // Region users: see Department Submitted and above statuses
      query.status = { 
        $in: ["Department Submitted", "Region Approved", "Finalized"] 
      };
    }
    const incomeEntries = await Income.find(query)
      .populate('incomecategory')
      .sort({ createdAt: -1 });
    
    res.status(200).json(incomeEntries);
  } catch (error) {
    console.error("Error fetching income entries:", error);
    res.status(500).json({ message: "Failed to fetch income entries", error: error.message });
  }
};
// Get income by ID
exports.getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    // Validate that id is a valid MongoDB ObjectId
    if (!id || !require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid ID format", 
        details: `'${id}' is not a valid MongoDB ObjectId`
      });
    }
    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    return res.status(200).json(income);
  } catch (error) {
    console.error("Error fetching income by ID:", error);
    return res.status(500).json({
      message: "Failed to fetch income entry",
      error: error.message
    });
  }
};
// Create income entry (simple variant) - removed; unified above handler handles creation with org fields
// Update income entry (simple variant) - removed; unified above handler handles updates with org fields
// Delete income entry
exports.deleteIncome = async (req, res) => {
  try {
    const income = await Income.findByIdAndDelete(req.params.id);
    if (!income) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    return res.status(200).json({ message: "Income entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting income:", error);
    return res.status(500).json({
      message: "Failed to delete income entry",
      error: error.message
    });
  }
};
