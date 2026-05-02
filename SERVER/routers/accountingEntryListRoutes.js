const express = require("express");
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const { getAccountingEntries, getMooeProposals } = require("../controllers/AccountingEntryList_controller");


// Apply authentication middleware to all routes in this router
router.use(isAuth);
router.get("/accounting-entries", getAccountingEntries);
router.get("/mooe-proposals", getMooeProposals);
module.exports = router;

