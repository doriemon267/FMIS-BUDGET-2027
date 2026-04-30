const express = require("express");
const router = express.Router();
// const checkToken = require('../middleware/check_token');
const { getAccountingEntries, getMooeProposals } = require("../controllers/AccountingEntryList_controller");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
router.get("/accounting-entries", getAccountingEntries);
router.get("/mooe-proposals", getMooeProposals);
module.exports = router;
