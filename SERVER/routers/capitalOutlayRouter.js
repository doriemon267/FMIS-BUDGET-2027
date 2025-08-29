const {
  getAllCapitalOutlays,
  addCapitalOutlay,
  editCapitalOutlay,
  deleteCapitalOutlay,
  getCapitalOutlayList,
  getSublineItems,
  getAccountingTitles,
  deleteAllCapitalOutlays,
} = require("../controllers/capitalOutlayController");

// Import chart of accounts model for seeding
const ChartOfAccounts = require("../models/chartOfAccounts");

const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkDueDateWithRoleBypass = require("../middleware/checkDueDateWithRoleBypass");
const checkToken = require("../middleware/checkToken");
const CapitalOutlay = require("../models/CapitalOutlay"); // New model import

const capitalOutlayRouter = Router();

// Apply authentication to all capital outlay routes
capitalOutlayRouter.use(checkToken);

capitalOutlayRouter.get("/capital-outlays", getAllCapitalOutlays);
capitalOutlayRouter.post("/capital-outlays", checkDueDate, addCapitalOutlay);
capitalOutlayRouter.put("/capital-outlays/:id", checkDueDate, editCapitalOutlay);
capitalOutlayRouter.delete("/capital-outlays/:id", checkDueDateWithRoleBypass, deleteCapitalOutlay);

capitalOutlayRouter.get("/capital-outlay-list", getCapitalOutlayList);
capitalOutlayRouter.get("/subline-items", getSublineItems);
capitalOutlayRouter.get("/accounting-titles", getAccountingTitles);
capitalOutlayRouter.delete("/deleteAllCapitalOutlays", deleteAllCapitalOutlays);

// Check due date status
capitalOutlayRouter.get("/due-date-status", async (req, res) => {
  try {
    const Settings = require("../models/Settings");
    const activeSettings = await Settings.findOne({ isActive: true });
    
    if (!activeSettings) {
      return res.status(200).json({ 
        isPastDue: true, 
        message: "No active fiscal year found." 
      });
    }

    const now = new Date();
    const dueDate = new Date(activeSettings.dueDate);
    const isPastDue = now > dueDate;
    
    // Check if user has admin privileges
    const userRoles = req.user?.Roles || [];
    const isAdmin = userRoles.some(role => 
      role.toUpperCase().includes('ADMIN') || 
      role.toUpperCase().includes('SUPER') ||
      role.toUpperCase().includes('BUDGET ADMIN')
    );

    res.status(200).json({
      isPastDue,
      dueDate: dueDate.toISOString(),
      dueDateFormatted: dueDate.toLocaleDateString("en-PH"),
      canBypassDueDate: isAdmin,
      fiscalYear: activeSettings.fiscalYear,
      budgetType: activeSettings.budgetType
    });
  } catch (error) {
    console.error("Error checking due date status:", error);
    res.status(500).json({ error: "Failed to check due date status" });
  }
});

// Route to manually seed Capital Outlay chart of accounts
capitalOutlayRouter.post("/seed-chart-of-accounts", async (req, res) => {
  try {
    console.log("Manual seeding of Capital Outlay chart of accounts requested");

    // Check if Capital Outlay entries already exist
    const existingEntries = await ChartOfAccounts.find({
      uacsCode: { $regex: /^5-01/ }
    });

    if (existingEntries.length > 0) {
      return res.status(200).json({
        message: "Capital Outlay chart of accounts entries already exist",
        count: existingEntries.length
      });
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

    const result = await ChartOfAccounts.insertMany(capitalOutlayEntries);

    res.status(201).json({
      message: "Capital Outlay chart of accounts seeded successfully",
      count: result.length
    });
  } catch (error) {
    console.error("Error seeding Capital Outlay chart of accounts:", error);
    res.status(500).json({ error: "Failed to seed chart of accounts" });
  }
});
// Get Capital Outlay by parameters
capitalOutlayRouter.get("/capital-outlay/getByParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    
    console.log("Fetching Capital Outlay with params:", { fiscalYear, budgetType, processBy, region, status });
    
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    
    const capitalOutlay = await CapitalOutlay.find(query).lean();
    
    console.log(`Found ${capitalOutlay.length} Capital Outlay records`);
    res.status(200).json(capitalOutlay);
  } catch (error) {
    console.error("Error fetching Capital Outlay by params:", error);
    res.status(500).json({ message: "Failed to fetch Capital Outlay data" });
  }
});
module.exports = capitalOutlayRouter;
