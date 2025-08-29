const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const retireeController = require("../controllers/retireeController");
const checkDueDate = require("../middleware/checkDueDate");

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Get eligible for retirement
router.get("/retiree/eligible", retireeController.getEligibleForRetirement)

// Get all retirees with pagination
router.get("/retiree", retireeController.getAllRetirees);

// Get retiree statistics (must be before :id route)
router.get("/retiree/stats", retireeController.getRetireeStats);

// Get summary of retirees by type
router.get("/retiree/summary", retireeController.getRetireesSummary);

// Get a single retiree by ID
router.get("/retiree/:id", retireeController.getRetireeById);

// Create a new retiree record
router.post("/retiree", checkDueDate, retireeController.createRetiree);

// Update a retiree record
router.put("/retiree/:id", checkDueDate, retireeController.updateRetiree);

// Delete a retiree record
router.delete("/retiree/:id", checkDueDate, retireeController.deleteRetiree);

module.exports = router;