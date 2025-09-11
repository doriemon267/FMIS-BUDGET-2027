const TitleMapping = require("../models/titleMapping");
const ChartOfAccounts = require("../models/chartOfAccounts");
// Get all title mappings
exports.getAllTitleMappings = async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "", sublineItem = "" } = req.query;
    // Build search query
    let searchQuery = { isActive: true };
    if (search) {
      searchQuery.$or = [
        { accountingTitle: { $regex: search, $options: "i" } },
        { uacsCode: { $regex: search, $options: "i" } },
        { sublineItem: { $regex: search, $options: "i" } },
        { accountClass: { $regex: search, $options: "i" } },
        { lineItem: { $regex: search, $options: "i" } }
      ];
    }
    if (sublineItem) {
      searchQuery.sublineItem = sublineItem;
    }
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // Fetch data with pagination
    const titleMappings = await TitleMapping.find(searchQuery)
      .sort({ sublineItem: 1, accountingTitle: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    // Get total count for pagination
    const totalCount = await TitleMapping.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    res.status(200).json({
      titleMappings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error fetching title mappings:", error);
    res.status(500).json({ error: "Failed to fetch title mappings" });
  }
};
// Get capital outlay title mappings only
exports.getCapitalOutlayTitleMappings = async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "" } = req.query;
    // Build search query for capital outlay items
    let searchQuery = {
      isActive: true,
      $or: [
        { lineItem: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } },
        { sublineItem: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } },
        { accountingTitle: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } }
      ]
    };
    if (search) {
      searchQuery.$and = [
        { $or: searchQuery.$or }, // Keep the capital outlay filter
        {
          $or: [
            { accountingTitle: { $regex: search, $options: "i" } },
            { uacsCode: { $regex: search, $options: "i" } },
            { sublineItem: { $regex: search, $options: "i" } },
            { accountClass: { $regex: search, $options: "i" } }
          ]
        }
      ];
      delete searchQuery.$or; // Remove the original $or to avoid conflict
    }
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // Fetch data with pagination
    const titleMappings = await TitleMapping.find(searchQuery)
      .sort({ sublineItem: 1, accountingTitle: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    // Get total count for pagination
    const totalCount = await TitleMapping.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    res.status(200).json({
      titleMappings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error fetching capital outlay title mappings:", error);
    res.status(500).json({ error: "Failed to fetch capital outlay title mappings" });
  }
};
// Get a single title mapping by ID
exports.getTitleMappingById = async (req, res) => {
  try {
    const { id } = req.params;
    const titleMapping = await TitleMapping.findById(id);
    if (!titleMapping) {
      return res.status(404).json({ error: "Title mapping not found" });
    }
    res.status(200).json({ titleMapping });
  } catch (error) {
    console.error("Error fetching title mapping:", error);
    res.status(500).json({ error: "Failed to fetch title mapping" });
  }
};
// Create a new title mapping
exports.createTitleMapping = async (req, res) => {
  try {
    const {
      sublineItem,
      accountingTitle,
      uacsCode,
      accountClass,
      lineItem,
      normalBalance = "Debit",
      chartOfAccountsRef
    } = req.body;
    // Validate required fields
    if (!sublineItem || !accountingTitle || !uacsCode || !accountClass || !lineItem) {
      return res.status(400).json({ 
        error: "Subline item, accounting title, UACS code, account class, and line item are required" 
      });
    }
    // Check if UACS code already exists
    const existingMapping = await TitleMapping.findOne({ uacsCode, isActive: true });
    if (existingMapping) {
      return res.status(400).json({ 
        error: "UACS code already exists in title mappings" 
      });
    }
    // Create new title mapping
    const newTitleMapping = new TitleMapping({
      sublineItem,
      accountingTitle,
      uacsCode,
      accountClass,
      lineItem,
      normalBalance,
      chartOfAccountsRef
    });
    await newTitleMapping.save();
    res.status(201).json({
      message: "Title mapping created successfully",
      titleMapping: newTitleMapping
    });
  } catch (error) {
    console.error("Error creating title mapping:", error);
    res.status(500).json({ error: "Failed to create title mapping" });
  }
};
// Update a title mapping
exports.updateTitleMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sublineItem,
      accountingTitle,
      uacsCode,
      accountClass,
      lineItem,
      normalBalance
    } = req.body;
    // Validate required fields
    if (!sublineItem || !accountingTitle || !uacsCode || !accountClass || !lineItem) {
      return res.status(400).json({ 
        error: "Subline item, accounting title, UACS code, account class, and line item are required" 
      });
    }
    // Check if the title mapping exists
    const existingMapping = await TitleMapping.findById(id);
    if (!existingMapping) {
      return res.status(404).json({ error: "Title mapping not found" });
    }
    // Check if UACS code already exists (excluding current record)
    const duplicateMapping = await TitleMapping.findOne({ 
      uacsCode, 
      _id: { $ne: id },
      isActive: true 
    });
    if (duplicateMapping) {
      return res.status(400).json({ 
        error: "UACS code already exists in title mappings" 
      });
    }
    // Update the title mapping
    const updatedTitleMapping = await TitleMapping.findByIdAndUpdate(
      id,
      {
        sublineItem,
        accountingTitle,
        uacsCode,
        accountClass,
        lineItem,
        normalBalance
      },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      message: "Title mapping updated successfully",
      titleMapping: updatedTitleMapping
    });
  } catch (error) {
    console.error("Error updating title mapping:", error);
    res.status(500).json({ error: "Failed to update title mapping" });
  }
};
// Delete a title mapping (soft delete)
exports.deleteTitleMapping = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if the title mapping exists
    const existingMapping = await TitleMapping.findById(id);
    if (!existingMapping) {
      return res.status(404).json({ error: "Title mapping not found" });
    }
    // Soft delete by setting isActive to false
    await TitleMapping.findByIdAndUpdate(id, { isActive: false });
    res.status(200).json({
      message: "Title mapping deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting title mapping:", error);
    res.status(500).json({ error: "Failed to delete title mapping" });
  }
};
// Get available chart of accounts for mapping
exports.getAvailableChartOfAccounts = async (req, res) => {
  try {
    // Get all chart of accounts
    const chartOfAccounts = await ChartOfAccounts.find({})
      .select("accountingTitle uacsCode accountClass lineItem normalBalance")
      .sort({ accountingTitle: 1 });
    res.status(200).json({
      chartOfAccounts,
      message: "Available chart of accounts retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching available chart of accounts:", error);
    res.status(500).json({ error: "Failed to fetch available chart of accounts" });
  }
};
// Sync title mappings from chart of accounts
exports.syncFromChartOfAccounts = async (req, res) => {
  try {
    const { sublineItem } = req.body;
    if (!sublineItem) {
      return res.status(400).json({ error: "Subline item is required" });
    }
    // Get chart of accounts entries that match capital outlay criteria
    const chartEntries = await ChartOfAccounts.find({
      $or: [
        { lineItem: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } },
        { accountingTitle: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } }
      ]
    });
    let syncedCount = 0;
    const errors = [];
    for (const entry of chartEntries) {
      try {
        // Check if mapping already exists
        const existingMapping = await TitleMapping.findOne({ 
          uacsCode: entry.uacsCode,
          isActive: true 
        });
        if (!existingMapping) {
          // Create new title mapping
          const newMapping = new TitleMapping({
            sublineItem: sublineItem,
            accountingTitle: entry.accountingTitle,
            uacsCode: entry.uacsCode,
            accountClass: entry.accountClass,
            lineItem: entry.lineItem,
            normalBalance: entry.normalBalance,
            chartOfAccountsRef: entry._id
          });
          await newMapping.save();
          syncedCount++;
        }
      } catch (error) {
        errors.push(`Failed to sync ${entry.accountingTitle}: ${error.message}`);
      }
    }
    res.status(200).json({
      message: `Successfully synced ${syncedCount} title mappings`,
      syncedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error syncing from chart of accounts:", error);
    res.status(500).json({ error: "Failed to sync from chart of accounts" });
  }
};