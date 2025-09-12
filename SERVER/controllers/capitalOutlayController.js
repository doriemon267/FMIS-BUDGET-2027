const mongoose = require("mongoose");
const CapitalOutlay = require("../models/CapitalOutlay");
const ChartOfAccounts = require('../models/chartOfAccounts');
const Category = require("../models/Category");
const Settings = require("../models/Settings");
// Function to seed Capital Outlay Chart of Accounts
const seedCapitalOutlayChartOfAccounts = async () => {
  try {
    // Check if Capital Outlay entries already exist
    const existingEntries = await ChartOfAccounts.find({
      uacsCode: { $regex: /^5-01/ }
    });
    if (existingEntries.length > 0) {
      // return;
    }
    const capitalOutlayEntries = [
      // Infrastructure Outlay
      { sublineItem: "Infrastructure Outlay", accountingTitle: "Infrastructure Outlay - Roads and Bridges", uacsCode: "5-01-01-010" },
      { sublineItem: "Infrastructure Outlay", accountingTitle: "Infrastructure Outlay - Flood Control Systems", uacsCode: "5-01-01-020" },
      { sublineItem: "Infrastructure Outlay", accountingTitle: "Infrastructure Outlay - Water Supply Systems", uacsCode: "5-01-01-030" },
      { sublineItem: "Infrastructure Outlay", accountingTitle: "Infrastructure Outlay - Irrigation Systems", uacsCode: "5-01-01-040" },
      { sublineItem: "Infrastructure Outlay", accountingTitle: "Infrastructure Outlay - Other Infrastructure", uacsCode: "5-01-01-990" },
      // Building and Other Structures
      { sublineItem: "Building and Other Structures", accountingTitle: "Buildings", uacsCode: "5-01-02-010" },
      { sublineItem: "Building and Other Structures", accountingTitle: "School Buildings", uacsCode: "5-01-02-020" },
      { sublineItem: "Building and Other Structures", accountingTitle: "Hospitals and Health Centers", uacsCode: "5-01-02-030" },
      { sublineItem: "Building and Other Structures", accountingTitle: "Markets", uacsCode: "5-01-02-040" },
      { sublineItem: "Building and Other Structures", accountingTitle: "Slaughterhouses", uacsCode: "5-01-02-050" },
      { sublineItem: "Building and Other Structures", accountingTitle: "Hostels and Dormitories", uacsCode: "5-01-02-060" },
      { sublineItem: "Building and Other Structures", accountingTitle: "Other Structures", uacsCode: "5-01-02-990" },
      // Machinery and Equipment Outlay
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Office Equipment", uacsCode: "5-01-03-010" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Information and Communications Technology Equipment", uacsCode: "5-01-03-020" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Agricultural and Forestry Equipment", uacsCode: "5-01-03-030" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Military, Police and Security Equipment", uacsCode: "5-01-03-040" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Medical Equipment", uacsCode: "5-01-03-050" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Printing Equipment", uacsCode: "5-01-03-060" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Sports Equipment", uacsCode: "5-01-03-070" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Technical and Scientific Equipment", uacsCode: "5-01-03-080" },
      { sublineItem: "Machinery and Equipment Outlay", accountingTitle: "Other Machinery and Equipment", uacsCode: "5-01-03-990" },
      // Transportation Equipment Outlay
      { sublineItem: "Transportation Equipment Outlay", accountingTitle: "Motor Vehicles", uacsCode: "5-01-04-010" },
      { sublineItem: "Transportation Equipment Outlay", accountingTitle: "Aircraft", uacsCode: "5-01-04-020" },
      { sublineItem: "Transportation Equipment Outlay", accountingTitle: "Watercrafts", uacsCode: "5-01-04-030" },
      { sublineItem: "Transportation Equipment Outlay", accountingTitle: "Other Transportation Equipment", uacsCode: "5-01-04-990" },
      // Furniture, Fixtures and Books Outlay
      { sublineItem: "Furniture, Fixtures and Books Outlay", accountingTitle: "Furniture and Fixtures", uacsCode: "5-01-05-010" },
      { sublineItem: "Furniture, Fixtures and Books Outlay", accountingTitle: "Books", uacsCode: "5-01-05-020" }
    ];
    await ChartOfAccounts.insertMany(capitalOutlayEntries);
  } catch (error) {
    console.error("Error seeding Capital Outlay chart of accounts:", error);
  }
};
// Call the seeding function when the module is loaded (commented out to avoid repeated seeding)
// seedCapitalOutlayChartOfAccounts();
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
    // Apply sophisticated hierarchical filtering based on user access scope
    const accessScope = req.hierarchicalAccess?.scope;
    const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
    // Add region filter based on access scope
    if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
      query.region = accessibleRegionName;
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
      // Region-level users should ONLY see:
      // 1. Records that don't have department field (already consolidated to region level)  
      // 2. Department records that are properly submitted/approved ONLY
      // BUT NOT current working drafts of departments
      const baseQuery = { ...query }; // Preserve existing query constraints
      query = {
        $and: [
          baseQuery, // Keep fiscal year, category, search constraints
          { region: accessibleRegionName }, // Must be in their region
          {
            $or: [
              // Option 1: Consolidated records (no department info)
              { department: { $exists: false } },
              { department: null },
              { department: "" },
              // Option 2: Department records that are submitted/approved ONLY
              { 
                $and: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
                ]
              }
            ]
          }
        ]
      };
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
    // ─── VALIDATION: lahat ng fields ay required ───
    if (
      cost == null ||
      !category ||
      !sublineItem ||
      !accountingTitle ||
      !uacsCode ||
      !region // Ensure region is required
    ) {
      return res
        .status(400)
        .json({
          error:
            "Missing fields: cost, category, sublineItem, accountingTitle, uacsCode, and region are all required.",
        });
    }
    // Fetch active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res
        .status(400)
        .json({ error: "Active settings not found" });
    }
    // Duplicate check before saving
    const duplicate = await CapitalOutlay.findOne({
      uacsCode,
      region,
      fiscalYear: activeSettings.fiscalYear,
      sublineItem
    });
    if (duplicate) {
      return res.status(400).json({ error: "Duplicate entry: This Capital Outlay already exists for this region, year, and subline item." });
    }
    // Pull organizational ownership from hierarchical consolidation (if present)
    const ownerRegion = req.body.region || req.hierarchicalAccess?.originalData?.region || req.hierarchicalFilters?.region || region;
    const ownerDepartment = req.body.department || req.hierarchicalAccess?.originalData?.department || null;
    const ownerDivision = req.body.division || req.hierarchicalAccess?.originalData?.division || null;
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
      processDate,
      fiscalYear,
      budgetType: activeSettings.budgetType,
      sublineItem,
      accountingTitle,
      uacsCode,
    });
    await newOutlay.save();
    return res
      .status(201)
      .json({ message: "Capital outlay added successfully" });
  } catch (error) {
    console.error("Error adding capital outlay:", error);
    return res
      .status(500)
      .json({ error: "Internal server error" });
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
    // Update capital outlay
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
        region: req.body.region || existingOutlay.region,
        department: req.body.department ?? existingOutlay.department,
        division: req.body.division ?? existingOutlay.division,
        processDate,
        fiscalYear,
        budgetType, // Include budgetType
        status,
        sublineItem,
        accountingTitle,
        uacsCode,
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
    // // Fetch the category document dynamically
    const categoryDoc = await Category.findOne({ categoryName: category });
    if (!categoryDoc) {
      return res.status(404).json({ error: "Category not found." });
    }
    // Get sublineItems from the category document
    const sublineItemList = categoryDoc.sublineItems || [];
    // If category has subline items, return them directly
    // This ensures Capital Outlay categories work even if chart of accounts is not populated
    if (sublineItemList.length > 0) {
      // return res.status(200).json({ sublineItems: sublineItemList });
    }
    // Fallback: Fetch matching sublineItems from ChartOfAccounts
    const fetchedSublineItems = await ChartOfAccounts.find({
      sublineItem: { $in: sublineItemList },
    }).distinct("sublineItem");
    // res.status(200).json({ sublineItems: fetchedSublineItems });
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
    let accountingTitles = await ChartOfAccounts.find({ sublineItem }).select("accountingTitle uacsCode");
    // If no entries found in database, provide default Capital Outlay chart of accounts
    if (accountingTitles.length === 0) {
      // // Default Capital Outlay Chart of Accounts
      const defaultCapitalOutlayChartOfAccounts = {
        // Infrastructure Outlay
        "Infrastructure Outlay": [
          { accountingTitle: "Infrastructure Outlay - Roads and Bridges", uacsCode: "5-01-01-010" },
          { accountingTitle: "Infrastructure Outlay - Flood Control Systems", uacsCode: "5-01-01-020" },
          { accountingTitle: "Infrastructure Outlay - Water Supply Systems", uacsCode: "5-01-01-030" },
          { accountingTitle: "Infrastructure Outlay - Irrigation Systems", uacsCode: "5-01-01-040" },
          { accountingTitle: "Infrastructure Outlay - Other Infrastructure", uacsCode: "5-01-01-990" }
        ],
        // Building and Other Structures
        "Building and Other Structures": [
          { accountingTitle: "Buildings", uacsCode: "5-01-02-010" },
          { accountingTitle: "School Buildings", uacsCode: "5-01-02-020" },
          { accountingTitle: "Hospitals and Health Centers", uacsCode: "5-01-02-030" },
          { accountingTitle: "Markets", uacsCode: "5-01-02-040" },
          { accountingTitle: "Slaughterhouses", uacsCode: "5-01-02-050" },
          { accountingTitle: "Hostels and Dormitories", uacsCode: "5-01-02-060" },
          { accountingTitle: "Other Structures", uacsCode: "5-01-02-990" }
        ],
        // Buildings and Other Structures (alternative naming)
        "Buildings and Other Structures": [
          { accountingTitle: "Buildings", uacsCode: "5-01-02-010" },
          { accountingTitle: "School Buildings", uacsCode: "5-01-02-020" },
          { accountingTitle: "Hospitals and Health Centers", uacsCode: "5-01-02-030" },
          { accountingTitle: "Markets", uacsCode: "5-01-02-040" },
          { accountingTitle: "Slaughterhouses", uacsCode: "5-01-02-050" },
          { accountingTitle: "Hostels and Dormitories", uacsCode: "5-01-02-060" },
          { accountingTitle: "Other Structures", uacsCode: "5-01-02-990" }
        ],
        // Repairs and Maintenance
        "Repairs and Maintenance": [
          { accountingTitle: "Repairs and Maintenance - Buildings and Other Structures", uacsCode: "5-02-13-010" },
          { accountingTitle: "Repairs and Maintenance - Machinery and Equipment", uacsCode: "5-02-13-020" },
          { accountingTitle: "Repairs and Maintenance - Transportation Equipment", uacsCode: "5-02-13-030" },
          { accountingTitle: "Repairs and Maintenance - Other Property, Plant and Equipment", uacsCode: "5-02-13-990" }
        ],
        // Machinery and Equipment Outlay
        "Machinery and Equipment Outlay": [
          { accountingTitle: "Office Equipment", uacsCode: "5-01-03-010" },
          { accountingTitle: "Information and Communications Technology Equipment", uacsCode: "5-01-03-020" },
          { accountingTitle: "Agricultural and Forestry Equipment", uacsCode: "5-01-03-030" },
          { accountingTitle: "Military, Police and Security Equipment", uacsCode: "5-01-03-040" },
          { accountingTitle: "Medical Equipment", uacsCode: "5-01-03-050" },
          { accountingTitle: "Printing Equipment", uacsCode: "5-01-03-060" },
          { accountingTitle: "Sports Equipment", uacsCode: "5-01-03-070" },
          { accountingTitle: "Technical and Scientific Equipment", uacsCode: "5-01-03-080" },
          { accountingTitle: "Other Machinery and Equipment", uacsCode: "5-01-03-990" }
        ],
        // Machinery and Equipment (alternative naming)
        "Machinery and Equipment": [
          { accountingTitle: "Office Equipment", uacsCode: "5-01-03-010" },
          { accountingTitle: "Information and Communications Technology Equipment", uacsCode: "5-01-03-020" },
          { accountingTitle: "Agricultural and Forestry Equipment", uacsCode: "5-01-03-030" },
          { accountingTitle: "Military, Police and Security Equipment", uacsCode: "5-01-03-040" },
          { accountingTitle: "Medical Equipment", uacsCode: "5-01-03-050" },
          { accountingTitle: "Printing Equipment", uacsCode: "5-01-03-060" },
          { accountingTitle: "Sports Equipment", uacsCode: "5-01-03-070" },
          { accountingTitle: "Technical and Scientific Equipment", uacsCode: "5-01-03-080" },
          { accountingTitle: "Other Machinery and Equipment", uacsCode: "5-01-03-990" }
        ],
        // Transportation Equipment Outlay
        "Transportation Equipment Outlay": [
          { accountingTitle: "Motor Vehicles", uacsCode: "5-01-04-010" },
          { accountingTitle: "Aircraft", uacsCode: "5-01-04-020" },
          { accountingTitle: "Watercrafts", uacsCode: "5-01-04-030" },
          { accountingTitle: "Other Transportation Equipment", uacsCode: "5-01-04-990" }
        ],
        // Furniture, Fixtures and Books Outlay
        "Furniture, Fixtures and Books Outlay": [
          { accountingTitle: "Furniture and Fixtures", uacsCode: "5-01-05-010" },
          { accountingTitle: "Books", uacsCode: "5-01-05-020" }
        ],
        // Furniture Fixture and Books (alternative naming)
        "Furniture Fixture and Books": [
          { accountingTitle: "Furniture and Fixtures", uacsCode: "5-01-05-010" },
          { accountingTitle: "Books", uacsCode: "5-01-05-020" }
        ],
        // Land
        "Land": [
          { accountingTitle: "Land", uacsCode: "5-01-06-010" },
          { accountingTitle: "Land Rights", uacsCode: "5-01-06-020" }
        ],
        // Land Improvements
        "Land Improvements": [
          { accountingTitle: "Land Improvements", uacsCode: "5-01-07-010" },
          { accountingTitle: "Site Development", uacsCode: "5-01-07-020" },
          { accountingTitle: "Landscaping", uacsCode: "5-01-07-030" }
        ]
      };
      // Get the matching entries for the subline item
      accountingTitles = defaultCapitalOutlayChartOfAccounts[sublineItem] || [];
    }
    // // Debugging
    res.status(200).json({ accountingTitles });
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
