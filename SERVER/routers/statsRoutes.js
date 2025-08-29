const express = require("express");
const checkToken = require('../middleware/checkToken');
const { getOverviewStats } = require("../controllers/statsController");

const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Get dashboard overview statistics
router.get("/overview", getOverviewStats);

module.exports = router;