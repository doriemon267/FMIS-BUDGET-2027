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
const PersonnelServicesModel = require("../models/PersonnelServices");
const checkDueDate = require("../middleware/checkDueDate");
const checkToken = require('../middleware/checkToken');
const Router = require("express").Router;
const personnelServicesRouter = Router();
// Apply authentication to all personnel services routes
personnelServicesRouter.use(checkToken);
// 🔒 Protect with due date check
personnelServicesRouter.post(
  "/personnelServices/bulk-add", 
  checkDueDate, 
  bulkAddPersonnelServices || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
personnelServicesRouter.put(
  "/personnelServices/:id", 
  checkDueDate, 
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
// Keep the original route for backward compatibility
personnelServicesRouter.get("/api/personnel/getByParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    :", { fiscalYear, budgetType, processBy, region, status });
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
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
// personnelServicesRouter.get(
//   "/getpersonnels/hiredBeforeJune1988", 
//   getPersonnelHiredBeforeJune1988 || 
//     ((req, res) => res.status(500).json({ message: "Function not available" }))
// );
// Add the new route for syncing meal allowances
personnelServicesRouter.post(
  "/personnelServices/sync-meal-allowances", 
  exports.syncAllMealAllowances || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
module.exports = personnelServicesRouter;