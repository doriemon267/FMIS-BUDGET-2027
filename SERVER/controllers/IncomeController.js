const mongoose = require("mongoose");
const Income = require("../models/Income");
const Settings = require("../models/Settings");

// Create new income entry
exports.createIncome = async (req, res) => {
  try {
    console.log("Creating income entry with data:", req.body);
    
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
      processBy,
      processDate,
    } = req.body;
    
    // Validate required fields
    if (!particulars || !incomecategory || amount === undefined || amount === null) {
      console.log("Missing required fields:", { particulars, incomecategory, amount });
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
      processBy,
      processDate: processDate || new Date(),
      status: "Not Submitted"
    });
    
    console.log("Saving new income entry:", newIncome);
    await newIncome.save();
    console.log("Income entry saved successfully with ID:", newIncome._id);
    
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
      processBy,
      processDate,
      status
    } = req.body;
    
    // Get active settings for fiscalYear and budgetType
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ message: "No active fiscal year settings found" });
    }
    
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
        fiscalYear: activeSettings.fiscalYear,
        budgetType: activeSettings.budgetType,
        region,
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

// Get all income entries
exports.getAllIncome = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    
    // console.log("Fetching income entries with params:", { fiscalYear, budgetType, region });

    // Build query object
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;

    // Add region filter if provided
    if (region) {
      query.region = region;
      // console.log(`Filtering income entries by region: ${region}`);
    }

    const incomeEntries = await Income.find(query)
      .populate('incomecategory')
      .sort({ createdAt: -1 });

    // console.log(`Found ${incomeEntries.length} income entries matching the criteria`);
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

// Create income entry
exports.createIncome = async (req, res) => {
  try {
    const income = new Income(req.body);
    await income.save();
    return res.status(201).json(income);
  } catch (error) {
    console.error("Error creating income:", error);
    return res.status(500).json({
      message: "Failed to create income entry",
      error: error.message
    });
  }
};

// Update income entry
exports.updateIncome = async (req, res) => {
  try {
    const income = await Income.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!income) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    return res.status(200).json(income);
  } catch (error) {
    console.error("Error updating income:", error);
    return res.status(500).json({
      message: "Failed to update income entry",
      error: error.message
    });
  }
};

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



