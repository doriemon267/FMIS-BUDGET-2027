const ChartOfAccounts = require("../models/chartOfAccounts");

// Get all chart of accounts
exports.getAllChartOfAccounts = async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "" } = req.query;
    
    // Build search query
    const searchQuery = search
      ? {
          $or: [
            { accountingTitle: { $regex: search, $options: "i" } },
            { uacsCode: { $regex: search, $options: "i" } },
            { sublineItem: { $regex: search, $options: "i" } },
            { accountClass: { $regex: search, $options: "i" } },
            { lineItem: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch data with pagination
    const chartOfAccounts = await ChartOfAccounts.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await ChartOfAccounts.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      chartOfAccounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    res.status(500).json({ error: "Failed to fetch chart of accounts" });
  }
};

// Get a single chart of account by ID
exports.getChartOfAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const chartOfAccount = await ChartOfAccounts.findById(id);
    
    if (!chartOfAccount) {
      return res.status(404).json({ error: "Chart of account not found" });
    }

    res.status(200).json({ chartOfAccount });
  } catch (error) {
    console.error("Error fetching chart of account:", error);
    res.status(500).json({ error: "Failed to fetch chart of account" });
  }
};

// Create a new chart of account
exports.createChartOfAccount = async (req, res) => {
  try {
    const {
      accountClass,
      lineItem,
      sublineItem,
      accountingTitle,
      uacsCode,
      normalBalance = "Debit"
    } = req.body;

    // Validate required fields
    if (!accountingTitle || !uacsCode) {
      return res.status(400).json({ 
        error: "Accounting title and UACS code are required" 
      });
    }

    // Check if UACS code already exists
    const existingAccount = await ChartOfAccounts.findOne({ uacsCode });
    if (existingAccount) {
      return res.status(400).json({ 
        error: "UACS code already exists" 
      });
    }

    // Create new chart of account
    const newChartOfAccount = new ChartOfAccounts({
      accountClass,
      lineItem,
      sublineItem,
      accountingTitle,
      uacsCode,
      normalBalance
    });

    await newChartOfAccount.save();

    res.status(201).json({
      message: "Chart of account created successfully",
      chartOfAccount: newChartOfAccount
    });
  } catch (error) {
    console.error("Error creating chart of account:", error);
    res.status(500).json({ error: "Failed to create chart of account" });
  }
};

// Update a chart of account
exports.updateChartOfAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      accountClass,
      lineItem,
      sublineItem,
      accountingTitle,
      uacsCode,
      normalBalance
    } = req.body;

    // Validate required fields
    if (!accountingTitle || !uacsCode) {
      return res.status(400).json({ 
        error: "Accounting title and UACS code are required" 
      });
    }

    // Check if the chart of account exists
    const existingAccount = await ChartOfAccounts.findById(id);
    if (!existingAccount) {
      return res.status(404).json({ error: "Chart of account not found" });
    }

    // Check if UACS code already exists (excluding current record)
    const duplicateAccount = await ChartOfAccounts.findOne({ 
      uacsCode, 
      _id: { $ne: id } 
    });
    if (duplicateAccount) {
      return res.status(400).json({ 
        error: "UACS code already exists" 
      });
    }

    // Update the chart of account
    const updatedChartOfAccount = await ChartOfAccounts.findByIdAndUpdate(
      id,
      {
        accountClass,
        lineItem,
        sublineItem,
        accountingTitle,
        uacsCode,
        normalBalance
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Chart of account updated successfully",
      chartOfAccount: updatedChartOfAccount
    });
  } catch (error) {
    console.error("Error updating chart of account:", error);
    res.status(500).json({ error: "Failed to update chart of account" });
  }
};

// Delete a chart of account
exports.deleteChartOfAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the chart of account exists
    const existingAccount = await ChartOfAccounts.findById(id);
    if (!existingAccount) {
      return res.status(404).json({ error: "Chart of account not found" });
    }

    // Delete the chart of account
    await ChartOfAccounts.findByIdAndDelete(id);

    res.status(200).json({
      message: "Chart of account deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting chart of account:", error);
    res.status(500).json({ error: "Failed to delete chart of account" });
  }
};

// Get accounting titles based on subline item (existing functionality)
exports.getAccountingTitles = async (req, res) => {
  try {
    const { sublineItem } = req.query;
    console.log("Fetching accounting titles for subline item:", sublineItem);

    // First try to get from database
    let accountingTitles = await ChartOfAccounts.find({ sublineItem }).select("accountingTitle uacsCode");

    // If no results from database, use default mappings
    if (accountingTitles.length === 0) {
      // Default Capital Outlay Chart of Accounts
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

        // Machinery and Equipment Outlay
        "Machinery and Equipment Outlay": [
          { accountingTitle: "Office Equipment", uacsCode: "5-01-03-010" },
          { accountingTitle: "Information and Communications Technology Equipment", uacsCode: "5-01-03-020" },
          { accountingTitle: "Technical and Scientific Equipment", uacsCode: "5-01-03-030" },
          { accountingTitle: "Machinery", uacsCode: "5-01-03-040" },
          { accountingTitle: "Other Machinery and Equipment", uacsCode: "5-01-03-990" }
        ],

        // Transportation Equipment Outlay
        "Transportation Equipment Outlay": [
          { accountingTitle: "Motor Vehicles", uacsCode: "5-01-04-010" },
          { accountingTitle: "Trains", uacsCode: "5-01-04-020" },
          { accountingTitle: "Aircraft and Aircrafts Ground Equipment", uacsCode: "5-01-04-030" },
          { accountingTitle: "Watercrafts", uacsCode: "5-01-04-040" },
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

    console.log("Fetched accounting titles:", accountingTitles);
    res.status(200).json({ accountingTitles });
  } catch (error) {
    console.error("Error fetching accounting titles:", error);
    res.status(500).json({ error: "Failed to retrieve accounting titles." });
  }
};

// Get subline items (existing functionality)
exports.getSublineItems = async (req, res) => {
  try {
    // Get unique subline items from database
    const fetchedSublineItems = await ChartOfAccounts.distinct("sublineItem");
    
    console.log("Fetched subline items from chart of accounts:", fetchedSublineItems);
    res.status(200).json({ sublineItems: fetchedSublineItems });
  } catch (error) {
    console.error("Error fetching subline items:", error);
    res.status(500).json({ error: "Failed to retrieve subline items." });
  }
};
