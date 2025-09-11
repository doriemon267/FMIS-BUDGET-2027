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
    // Create new income entry
    const newIncome = new Income({
      particulars,
      cost: cost || amount,
      incomecategory,
      subcategory,
      category,
      amount: Number(amount),
      fiscalYear: fiscalYear || new Date().getFullYear().toString(),
      budgetType: budgetType || "REGULAR",
      region,
      department,
      division,
      processBy,
      processDate: processDate || new Date(),
      status: "Not Submitted"
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
        region,
        department,
        division,
        processBy,
        processDate: processDate || new Date(),
        status: status || "Not Submitted"
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
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Add region filter if provided
    if (region) {
      query.region = region;
    }
    // For Income collection, only region-based hierarchical filtering is applicable.
    // Ignore department/division filters to avoid excluding all documents (fields don't exist in Income model).
    const accessScope = req.hierarchicalAccess?.scope;
    const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
    if (!query.region) {
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        query.region = accessibleRegionName;
      }
    }
    // Add finer filters based on access scope
    if (accessScope === 'DIVISION') {
      // Division users: only their division within their department and region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
      if (deptName) query.department = deptName;
      if (divName) query.division = divName;
    } else if (accessScope === 'DEPARTMENT') {
      // Department users: all divisions within their department in the region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      if (deptName) query.department = deptName;
    } else if (accessScope === 'REGION') {
      // Region-level visibility rule: show only when submitted or region-verified/approved
      query.$or = [
        { 'departmentSubmitted.at': { $exists: true, $ne: null } },
        { status: { $in: ['Submitted', 'Region Verified', 'Approved'] } },
      ];
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