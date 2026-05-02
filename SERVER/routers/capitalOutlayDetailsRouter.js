const express = require("express");
const router = express.Router();
const {
  getCapitalOutlayDetails,
  saveCapitalOutlayDetails,
  deleteCapitalOutlayDetail,
  getCapitalOutlayDetailsSummary,
} = require("../controllers/capitalOutlayDetailsController");
const isAuth = require("../middleware/is_auth");

const checkDueDate = require("../middleware/checkDueDate");
const checkDueDateWithRoleBypass = require("../middleware/checkDueDateWithRoleBypass");
// Apply authentication to all routes
router.use(isAuth);
// Get details for a specific capital outlay
router.get("/capital-outlay/:capitalOutlayId/details", getCapitalOutlayDetails);
// Save/Update details for a capital outlay
router.post("/capital-outlay/:capitalOutlayId/details", checkDueDateWithRoleBypass, saveCapitalOutlayDetails);
// Delete a specific detail item
router.delete("/capital-outlay-detail/:detailId", checkDueDateWithRoleBypass, deleteCapitalOutlayDetail);
// Get summary of all capital outlay details (for reporting)
router.get("/capital-outlay-details/summary", getCapitalOutlayDetailsSummary);
module.exports = router;
