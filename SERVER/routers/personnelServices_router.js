// Import controller functions individually to avoid issues
const { 
  bulkAddPersonnelServices,
  updatePersonnelService,
  bulkUpdatePersonnelService,
  getAllPersonnelServices,
  getAllPerServices,
  getGrandTotalPermanent,
  getGrandTotalCasual,
  deleteAllPersonnelss,
  getGrandTotal,
  getPersonnelHiredBeforeJune1988,
  bulkSetPersonnelSubsidy,
  bulkSetPersonnelChargedToIncome,
  debugCheckChargedToIncome,
  listChargedToIncome,
  resetChargedToIncome
} = require("../controllers/personnelServiceController");
// Import the model directly to ensure it's available
const PersonnelService = require('../models/PersonnelServices');
const checkDueDate = require("../middleware/checkDueDate");
const isAuth = require('../middleware/is_auth');
const { getPermanentIncomeAllocation, savePermanentIncomeAllocation, previewPermanentIncomeAllocation } = require('../controllers/permanentIncomeAllocationController');

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const Router = require("express").Router;
const personnelServicesRouter = Router();
// Apply authentication to all personnel services routes
personnelServicesRouter.use(isAuth);
// Apply submission workflow control middleware for read operations
personnelServicesRouter.use('/personnelServices', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/personnel-services', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/getpersonnels', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/grandtotalPermanent', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }));
personnelServicesRouter.use('/grandtotalCasual', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }));
personnelServicesRouter.get('/personnelServices/permanent-income-allocation/:proposalId', getPermanentIncomeAllocation);
personnelServicesRouter.post('/personnelServices/permanent-income-allocation/:proposalId/preview', previewPermanentIncomeAllocation);
personnelServicesRouter.put(
  '/personnelServices/permanent-income-allocation/:proposalId',
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  savePermanentIncomeAllocation
);
// 🔒 Protect with due date check and submission workflow control
personnelServicesRouter.post(
  "/personnelServices/bulk-add", 
  checkDueDate,
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), 
  bulkAddPersonnelServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.put(
  "/personnelServices/:id", 
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), 
  updatePersonnelService || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Unprotected GET routes
personnelServicesRouter.get(
  "/personnelServices", 
  getAllPersonnelServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/personnel-services", 
  getAllPersonnelServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/getpersonnels", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getAllPerServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalPermanent", 
  getGrandTotalPermanent || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalCasual", 
  getGrandTotalCasual || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.post(
  "/deleteAllPersonnels", 
  deleteAllPersonnelss || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalAll", 
  getGrandTotal || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Get personnel by parameters
personnelServicesRouter.get("/getpersonnels/byParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    // Ensure we have a model to work with
    if (!PersonnelService) {
      console.error("PersonnelServices model is not available");
      return res.status(500).json({ message: "Internal server error: Model not available" });
    }
    const personnel = await PersonnelService.find(query).lean();
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
});
// Bulk update personnel entries - path relative to /api mount
personnelServicesRouter.put("/personnel/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), bulkUpdatePersonnelService);

// NOTE: /personnel/getByParams is handled by personnelParamsRoutes (supports proposalId for workflow)
// personnelServicesRouter.get(
//   "/getpersonnels/hiredBeforeJune1988", 
//   getPersonnelHiredBeforeJune1988 || 
//     ((req, res) => res.status(500).json({ message: "Function not available" }))
// );
personnelServicesRouter.get(
  "/getpersonnels/hiredBeforeJune1988", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getPersonnelHiredBeforeJune1988 || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Add the new route for syncing meal allowances
personnelServicesRouter.post(
  "/personnelServices/sync-meal-allowances", 
  exports.syncAllMealAllowances || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);

// Add route for bulk subsidy updates
personnelServicesRouter.put(
  "/personnelServices/subsidy/bulk",
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  bulkSetPersonnelSubsidy || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);

// Add route for bulk charged to income updates
personnelServicesRouter.put(
  "/personnelServices/charged-to-income/bulk",
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  bulkSetPersonnelChargedToIncome || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);

// DEBUG: Add route to check if chargedToIncomeEligible records exist
personnelServicesRouter.get(
  "/debug/charged-to-income",
  debugCheckChargedToIncome || 
    ((req, res) => res.status(500).json({ message: "Debug function not available" }))
);

// List records marked as charged-to-income (optional: fiscalYear, region)
personnelServicesRouter.get(
  "/personnelServices/charged-to-income/list",
  listChargedToIncome || ((req, res) => res.status(500).json({ message: "Not available" }))
);

// Reset all charged-to-income in scope (body: { fiscalYear, region? })
personnelServicesRouter.post(
  "/personnelServices/charged-to-income/reset",
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  resetChargedToIncome || ((req, res) => res.status(500).json({ message: "Not available" }))
);

module.exports = personnelServicesRouter;
