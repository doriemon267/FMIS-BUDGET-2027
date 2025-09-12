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
const enforceOrgAccess = require('../middleware/enforceOrgAccess');
const Router = require("express").Router;
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const personnelServicesRouter = Router();
// Apply authentication only to mutating routes; keep GETs open for status/lookup
personnelServicesRouter.use((req, res, next) => {
  if (req.method === "GET") return next();
  return checkToken(req, res, next);
});
// 🔒 Protect with due date check
personnelServicesRouter.post(
  "/personnelServices/bulk-add", 
  enforceOrgAccess,
  checkDueDate,
  hierarchicalAccessControl('create', { strictMode: false, enableConsolidation: true }),
  bulkAddPersonnelServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.put(
  "/personnelServices/:id", 
  enforceOrgAccess,
  checkDueDate,
  hierarchicalAccessControl('update', { strictMode: false, enableConsolidation: true }),
  updatePersonnelService || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Protected GET routes with hierarchical read filtering
personnelServicesRouter.get(
  "/personnelServices",
  checkToken,
  hierarchicalAccessControl('read'),
  getAllPersonnelServices ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/getpersonnels",
  checkToken,
  hierarchicalAccessControl('read'),
  getAllPerServices ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalPermanent",
  checkToken,
  hierarchicalAccessControl('read'),
  getGrandTotalPermanent ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalCasual",
  checkToken,
  hierarchicalAccessControl('read'),
  getGrandTotalCasual ||
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.post(
  "/deleteAllPersonnels", 
  enforceOrgAccess,
  deleteAllPersonnelss || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.get(
  "/grandtotalAll", 
  getGrandTotal || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Get personnel by parameters (protected + hierarchical filters)
personnelServicesRouter.get("/getpersonnels/byParams", checkToken, hierarchicalAccessControl('read'), async (req, res) => {
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
// Keep the original route for backward compatibility (protected + hierarchical filters)
personnelServicesRouter.get("/api/personnel/getByParams", checkToken, hierarchicalAccessControl('read'), async (req, res) => {
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
  getPersonnelHiredBeforeJune1988 || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
// Add the new route for syncing meal allowances
personnelServicesRouter.post(
  "/personnelServices/sync-meal-allowances", 
  exports.syncAllMealAllowances || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
module.exports = personnelServicesRouter;
