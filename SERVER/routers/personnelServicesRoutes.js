// Import controller functions individually to avoid issues
const { 
  bulkAddPersonnelServices,
  updatePersonnelService,
  getAllPersonnelServices,
  getAllPerServices,
  getGrandTotalPermanent,
  getGrandTotalCasual,
  deleteAllPersonnelss,
  getGrandTotal,
  getPersonnelHiredBeforeJune1988
} = require("../controllers/personnel_service_controller");
// Import the model directly to ensure it's available
const PersonnelServicesModel = require("../models/personnelServices");
const checkDueDate = require("../middleware/checkDueDate");
const checkToken = require('../middleware/checkToken');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const Router = require("express").Router;
const personnelServicesRouter = Router();
// Apply authentication to all personnel services routes
personnelServicesRouter.use(checkToken);
// Apply submission workflow control middleware for read operations
personnelServicesRouter.use('/personnelServices', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/personnel_services', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/personnel-service', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/getpersonnels', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/grandtotalPermanent', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/grandtotalCasual', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/getpersonnels/byParams', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
personnelServicesRouter.use('/api/personnel/getByParams', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
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
  submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true }),
  updatePersonnelService || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Protected GET routes with hierarchical access control
personnelServicesRouter.get(
  "/personnelServices",
  getAllPersonnelServices ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Alternative route with underscore (for compatibility)
personnelServicesRouter.get(
  "/personnel_services",
  getAllPersonnelServices ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Alternative route with dash singular (for compatibility)
personnelServicesRouter.get(
  "/personnel-service",
  getAllPersonnelServices ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/getpersonnels",
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
  checkDueDate,
  submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }),
  deleteAllPersonnelss || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalAll", 
  getGrandTotal || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Get personnel by parameters (protected with hierarchical access control)
personnelServicesRouter.get("/getpersonnels/byParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (status) query.status = status;
    // Apply hierarchical filters
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Region filter only if not already constrained
    if (region && !query.region) query.region = region;
    // Ensure we have a model to work with
    if (!PersonnelServicesModel) {
      console.error("PersonnelServices model is not available");
      return res.status(500).json({ message: "Internal server error: Model not available" });
    }
    const personnel = await PersonnelServicesModel.find(query).lean();
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
});
// Keep the original route for backward compatibility (protected with hierarchical access control)
personnelServicesRouter.get("/api/personnel/getByParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (status) query.status = status;
    // Apply hierarchical filters
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Region filter only if not already constrained
    if (region && !query.region) query.region = region;
    // Ensure we have a model to work with
    if (!PersonnelServicesModel) {
      console.error("PersonnelServices model is not available");
      return res.status(500).json({ message: "Internal server error: Model not available" });
    }
    const personnel = await PersonnelServicesModel.find(query).lean();
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
});
personnelServicesRouter.get(
  "/getpersonnels/hiredBeforeJune1988", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getPersonnelHiredBeforeJune1988 || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Add the new route for syncing meal allowances with submission workflow control
personnelServicesRouter.post(
  "/personnelServices/sync-meal-allowances", 
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  exports.syncAllMealAllowances || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
module.exports = personnelServicesRouter;
