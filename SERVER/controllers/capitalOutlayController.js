const mongoose = require("mongoose");
const CapitalOutlay = require("../models/CapitalOutlay");
const ChartOfAccounts = require('../models/chartOfAccounts');
const Category = require("../models/Category");
const Settings = require("../models/Settings");
// All Chart of Accounts entries are read straight from the FMIS main database via MONGODB_MAIN_URL.
// We intentionally avoid local file-based seeding so the data always mirrors the source system.
// Helper function to get the active fiscal year
const getActiveFiscalYear = async () => {
  const activeSettings = await Settings.findOne({ isActive: true });
  if (!activeSettings) {
    throw new Error("Active settings not found");
  }
  return activeSettings.fiscalYear;
};
// Get all capital outlays with search & pagination
exports.getAllCapitalOutlays = async (req, res) => {
  try {
    const { page = 1, search, category, orderBy, order = "asc", region } = req.query;
    let query = {};
    // Add fiscal year to the query
    try {
      query.fiscalYear = await getActiveFiscalYear();
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    } else {
      query.category = { $ne: null };
    }
    // Apply submission workflow filters when available; fallback to hierarchical filters
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    const activeFilters = Object.keys(submissionFilters).length > 0 ? submissionFilters : hierarchicalFilters;
    if (activeFilters && Object.keys(activeFilters).length > 0) {
      if (activeFilters.$and) {
        const baseQuery = { ...query };
        query = { $and: [ baseQuery, ...activeFilters.$and ] };
      } else {
        query = { ...query, ...activeFilters };
      }
    }
    // Add region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }
    const sortQuery = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
    const [capitalOutlays, totalRecords] = await Promise.all([
      CapitalOutlay.find(query)
        .populate({
          path: "category",
          select: "categoryName _id",
          options: { strictPopulate: false },
        })
        .sort(sortQuery)
        .skip((page - 1) * 100) // Adjust the skip value if needed
        .exec(),
      CapitalOutlay.countDocuments(query),
    ]);
    // Format the response to ensure category is properly extracted
    const formattedOutlays = capitalOutlays.map((outlay) => {
      const outlayObj = outlay.toObject();
      // Ensure category is properly formatted
      let categoryData = null;
      if (outlay.category) {
        if (typeof outlay.category === 'object') {
          categoryData = {
            _id: outlay.category._id.toString(),
            categoryName: outlay.category.categoryName,
          };
        } else {
          categoryData = {
            _id: outlay.category.toString(),
            categoryName: outlay.category.toString(),
          };
        }
      }
      return {
        ...outlayObj,
        category: categoryData,
      };
    });
    res.status(200).json({
      capitalOutlays: formattedOutlays,
      totalPages: Math.ceil(totalRecords / 100), // Adjust the totalPages calculation if needed
      currentPage: parseInt(page),
      totalRecords,
    });
  } catch (error) {
    console.error("Error fetching capital outlays:", error);
    res.status(500).json({ error: "Failed to retrieve capital outlays." });
  }
};
// Add a new capital outlay
// Add a new capital outlay
// Add a new capital outlay
exports.addCapitalOutlay = async (req, res) => {
  try {
    console.log("=== ADD CAPITAL OUTLAY ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const {
      particulars,
      cost,
      income, // <-- Add this line
      subsidy, // Added subsidy field
      category,
      processBy,
      region,
      processDate,
      fiscalYear,
      sublineItem,
      accountingTitle,
      uacsCode,
    } = req.body;
    
    console.log("Extracted fields:");
    console.log("- Category:", category);
    console.log("- SublineItem:", sublineItem);
    console.log("- AccountingTitle:", accountingTitle);
    console.log("- UacsCode:", uacsCode);
    console.log("- Region:", region);
    console.log("- Income:", income);
    console.log("- Subsidy:", subsidy);
    console.log("- Cost:", cost);
    
    // ─── VALIDATION: lahat ng fields ay required ───
    if (
      cost == null ||
      !category ||
      !sublineItem ||
      !accountingTitle ||
      !uacsCode ||
      !region // Ensure region is required
    ) {
      console.error("Validation failed: Missing required fields");
      return res
        .status(400)
        .json({
          error:
            "Missing fields: cost, category, sublineItem, accountingTitle, uacsCode, and region are all required.",
        });
    }
    
    // ─── UACS CODE VALIDATION REMOVED ───
    // Previous validation required codes starting with "5-01-" or "5-02-"
    // However, the chart_of_accounts table contains codes starting with "1-"
    // Validation removed to accept all UACS codes from chart_of_accounts
    console.log("UACS code check skipped - accepting all codes from chart_of_accounts:", uacsCode);
    
    // Fetch active settings
    console.log("Fetching active settings...");
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      console.error("Active settings not found");
      return res
        .status(400)
        .json({ error: "Active settings not found" });
    }
    console.log("Active settings found:", activeSettings.fiscalYear, activeSettings.budgetType);
    // Duplicate check before saving
    console.log("Checking for duplicates...");
    const duplicate = await CapitalOutlay.findOne({
      uacsCode,
      region,
      fiscalYear: activeSettings.fiscalYear,
      sublineItem
    });
    if (duplicate) {
      console.error("Duplicate found:", duplicate._id);
      return res.status(400).json({ error: "Duplicate entry: This Capital Outlay already exists for this region, year, and subline item." });
    }
    console.log("No duplicates found");
    
    // Normalize organizational ownership using submission workflow data
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    const ownerRegion = workflowData.region ?? req.body.region ?? region;
    const ownerDepartment = workflowData.department ?? req.body.department ?? null;
    // Clear division for department-origin records to avoid leaking into division scope
    const ownerDivision = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? null);
    
    console.log("Creating new capital outlay...");
    const newOutlay = new CapitalOutlay({
      particulars,
      cost,
      income: income || 0, // <-- Add this line
      subsidy: subsidy || 0, // Added subsidy field with default value
      category,
      processBy,
      region: ownerRegion,
      department: ownerDepartment || undefined,
      division: ownerDivision || undefined,
      processDate: new Date(),
      fiscalYear,
      budgetType: activeSettings.budgetType,
      sublineItem,
      accountingTitle,
      uacsCode,
      // Tagging for submission workflow
      originalLevel: workflowData.originalLevel || (userLevel === 'DIVISION' ? 'DIVISION' : userLevel === 'DEPARTMENT' ? 'DEPARTMENT' : userLevel === 'REGION' ? 'REGION' : null),
      workflowLevel: workflowData.workflowLevel || (userLevel === 'DIVISION' ? 'DIVISION' : userLevel === 'DEPARTMENT' ? 'DEPARTMENT' : userLevel === 'REGION' ? 'REGION' : null),
      status: req.body.status || 'Draft'
    });
    
    console.log("Saving capital outlay to database...");
    await newOutlay.save();
    console.log("Capital outlay saved successfully:", newOutlay._id);
    console.log("=== ADD CAPITAL OUTLAY COMPLETE ===");
    
    return res.status(201).json({
      message: "Capital outlay added successfully",
      capitalOutlay: newOutlay
    });
  } catch (error) {
    console.error("=== ERROR ADDING CAPITAL OUTLAY ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
// Edit an existing capital outlay
exports.editCapitalOutlay = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, particulars, cost, income, subsidy, category, processBy, region, processDate, fiscalYear, status, sublineItem, accountingTitle, uacsCode } = req.body;
    // // // // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("Invalid capital outlay ID:", id);
      return res.status(400).json({ error: "Invalid capital outlay ID." });
    }
    // Validate category ID format if provided
    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      console.error("Invalid category ID:", category);
      return res.status(400).json({ error: "Invalid category ID." });
    }
    // Fetch fiscalYear and budgetType from active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ error: "Active settings not found" });
    }
    const budgetType = activeSettings.budgetType;
    // Check if the capital outlay exists
    const existingOutlay = await CapitalOutlay.findById(id);
    if (!existingOutlay) {
      console.error("Capital outlay not found for ID:", id);
      return res.status(404).json({ error: "Capital outlay not found." });
    }

    // Check if the record has been submitted and prevent editing
    const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
    if (submittedStatuses.includes(existingOutlay.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit capital outlay record that has been submitted or approved"
      });
    }

    // Update capital outlay
    // Use submission workflow data for ownership normalization
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    const updRegion = workflowData.region ?? req.body.region ?? existingOutlay.region;
    const updDepartment = workflowData.department ?? req.body.department ?? existingOutlay.department;
    const updDivision = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? existingOutlay.division);

    const updatedCapitalOutlay = await CapitalOutlay.findByIdAndUpdate(
      id,
      {
        title,
        particulars,
        cost,
        income: income || 0, // <-- Add this line
        subsidy: subsidy || 0, // Added subsidy field with default value
        category,
        processBy,
        // Respect any updated organizational ownership if provided
        region: updRegion,
        department: updDepartment,
        division: updDivision,
        processDate,
        fiscalYear,
        budgetType, // Include budgetType
        status,
        sublineItem,
        accountingTitle,
        uacsCode,
        // Preserve/Apply submission workflow tagging when available
        ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
        ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
      },
      { new: true, runValidators: true }
    ).populate("category"); // Ensure updated category details are returned
    return res.status(200).json({
      message: "Capital outlay updated successfully.",
      capitalOutlay: updatedCapitalOutlay,
    });
  } catch (error) {
    console.error("Error updating capital outlay:", error);
    return res.status(500).json({ error: "Failed to update capital outlay." });
  }
};
// Delete a capital outlay
exports.deleteCapitalOutlay = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("[DELETE] Invalid ObjectId:", id);
      return res.status(400).json({ error: "Invalid capital outlay ID." });
    }
    // Try to find the item first for better error reporting
    const found = await CapitalOutlay.findById(id);
    if (!found) {
      console.error("[DELETE] CapitalOutlay not found for id:", id);
      return res.status(404).json({ error: "Capital outlay not found." });
    }
    // Try to delete
    const deletedCapitalOutlay = await CapitalOutlay.findByIdAndDelete(id);
    if (!deletedCapitalOutlay) {
      console.error("[DELETE] Failed to delete CapitalOutlay for id:", id);
      return res.status(500).json({ error: "Failed to delete capital outlay (not found after lookup)." });
    }
    // res.status(200).json({ message: "Capital outlay deleted successfully." });
  } catch (error) {
    console.error("Error deleting capital outlay:", error);
    res.status(500).json({ error: error.message || "Failed to delete capital outlay." });
  }
};
// Fetch all capital outlay list
exports.getCapitalOutlayList = async (req, res) => {
  try {
    const capitalOutlays = await CapitalOutlay.find();
    res.status(200).json(capitalOutlays);
  } catch (error) {
    console.error("Error fetching capital outlays:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
exports.getSublineItems = async (req, res) => {
  try {
    const { category } = req.query;
    // Fetch the category document dynamically
    const categoryDoc = await Category.findOne({ categoryName: category });
    if (!categoryDoc) {
      return res.status(404).json({ error: "Category not found." });
    }
    // Get sublineItems from the category document
    const sublineItemList = categoryDoc.sublineItems || [];
    // If category has subline items, return them directly
    // This ensures Capital Outlay categories work even if chart of accounts is not populated
    if (sublineItemList.length > 0) {
      return res.status(200).json({ sublineItems: sublineItemList });
    }
    // Fallback: Fetch matching sublineItems from ChartOfAccounts
    const fetchedSublineItems = await ChartOfAccounts.find({
      sublineItem: { $in: sublineItemList },
    }).distinct("sublineItem");
    res.status(200).json({ sublineItems: fetchedSublineItems });
  } catch (error) {
    console.error("Error fetching subline items:", error);
    res.status(500).json({ error: "Failed to retrieve subline items." });
  }
};
// Fetch accounting titles based on subline item
exports.getAccountingTitles = async (req, res) => {
  try {
    const { sublineItem } = req.query;
    // // Debugging
    // First try to get from database
    const accountingTitleDocs = await ChartOfAccounts.find({ sublineItem }).select("accountingTitle uacsCode");
    const accountingTitles = accountingTitleDocs.map((doc) => ({
      accountingTitle: doc.accountingTitle,
      uacsCode: doc.uacsCode,
    }));

    if (accountingTitles.length === 0) {
      const message = `No Chart of Accounts entries found for "${sublineItem}". Please verify the FMIS main database (MONGODB_MAIN_URL) contains the expected Chart of Accounts records.`;

      console.warn(`[CapitalOutlay] ${message}`);

      return res.status(200).json({
        accountingTitles: [],
        message,
      });
    }

    const nonCapitalOutlayCodes = accountingTitles
      .filter(({ uacsCode }) => !(typeof uacsCode === 'string' && /^(5-01|5-02)-/.test(uacsCode.trim())))
      .map(({ uacsCode }) => uacsCode)
      .filter(Boolean);

    const responsePayload = { accountingTitles };

    if (nonCapitalOutlayCodes.length > 0) {
      responsePayload.message = `Returned ${nonCapitalOutlayCodes.length} accounting title(s) whose UACS codes are outside the usual Capital Outlay prefixes (5-01 or 5-02). Review the source data if this is unexpected.`;
      console.warn(
        `[CapitalOutlay] Subline "${sublineItem}" includes non-capital-outlay UACS codes: ${nonCapitalOutlayCodes.join(", ")}`
      );
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching accounting titles:", error);
    res.status(500).json({ error: "Failed to retrieve accounting titles." });
  }
};
// deleteCapitalOutlay all records
exports.deleteAllCapitalOutlays = async (req, res) => {
  try {
    await CapitalOutlay.deleteMany({}); // Delete all records
    res.status(200).json({ message: "All capital outlays deleted successfully." });
  } catch (error) {
    console.error("Error deleting capital outlays:", error);  // Debugging
    res.status(500).json({ error: "Failed to delete capital outlays." });
  }
};
