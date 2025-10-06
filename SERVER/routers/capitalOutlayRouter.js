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
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkDueDateWithRoleBypass = require("../middleware/checkDueDateWithRoleBypass");
const checkToken = require("../middleware/checkToken");
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const CapitalOutlay = require("../models/CapitalOutlay"); // New model import
const capitalOutlayRouter = Router();
// Apply authentication to all capital outlay routes
capitalOutlayRouter.use(checkToken);
capitalOutlayRouter.get("/capital-outlays", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllCapitalOutlays);
capitalOutlayRouter.post("/capital-outlays", checkDueDateWithRoleBypass, submissionWorkflowControl('create', { strictMode: false, enforceSubmissionWorkflow: true, enableConsolidation: true }), addCapitalOutlay);
capitalOutlayRouter.put("/capital-outlays/:id", checkDueDateWithRoleBypass, submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true, enableConsolidation: true }), editCapitalOutlay);
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
  res.status(410).json({
    message: "This endpoint is deprecated. Chart of Accounts data now comes directly from the FMIS main database (MONGODB_MAIN_URL). Update the source dataset there if changes are needed.",
  });
});
// Get Capital Outlay by parameters
capitalOutlayRouter.get("/capital-outlay/getByParams", submissionWorkflowControl('read'), async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status, department, division } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    if (department) query.department = department;
    if (division) query.division = division;
    
    const capitalOutlay = await CapitalOutlay.find(query).lean();
    res.status(200).json(capitalOutlay);
  } catch (error) {
    console.error("Error fetching Capital Outlay by params:", error);
    res.status(500).json({ message: "Failed to fetch Capital Outlay data" });
  }
});
module.exports = capitalOutlayRouter;
