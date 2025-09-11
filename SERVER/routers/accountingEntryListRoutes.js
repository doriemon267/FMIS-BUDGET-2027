const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const { getAccountingEntries, getMooeProposals } = require("../controllers/AccountingEntryList_controller");
// Apply authentication middleware to all routes in this router
router.use(checkToken);
router.get("/accounting-entries", getAccountingEntries);
router.get("/mooe-proposals", getMooeProposals);
module.exports = router;