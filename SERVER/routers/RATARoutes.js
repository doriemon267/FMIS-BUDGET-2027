const {
  getAllRATAs,
  getRATAById,
  createRATA,
  updateRATA,
  deleteRATA,
  getLinkedFiscalYears,
  linkRATAToFiscalYears,
  unlinkRATAFromFiscalYear,
  clearAllRATALinks,
} = require("../controllers/rataController");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const rataRouter = Router();
// Apply authentication to all RATA routes
rataRouter.use(authMiddleware);
// Get all RATAs
rataRouter.get("/ratas", getAllRATAs);
// Get a RATA by ID
rataRouter.get("/ratas/:id", getRATAById);
// Add a new RATA
rataRouter.post("/ratas", createRATA);
// Edit an existing RATA
rataRouter.put("/ratas/:id", updateRATA);
// Delete a RATA
rataRouter.delete("/ratas/:id", deleteRATA);

// ✅ NEW: Linking endpoints
// Get linked fiscal years for a RATA
rataRouter.get("/ratas/:id/linked-fiscal-years", getLinkedFiscalYears);
// Link RATA to fiscal years
rataRouter.put("/ratas/:rataId/link-fiscal-years", linkRATAToFiscalYears);
// Unlink RATA from a specific fiscal year
rataRouter.put("/ratas/:rataId/unlink-fiscal-year/:settingsId", unlinkRATAFromFiscalYear);
// Clear all links
rataRouter.put("/ratas/:rataId/clear-links", clearAllRATALinks);

module.exports = rataRouter;