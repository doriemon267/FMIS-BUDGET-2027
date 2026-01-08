const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/check_token');
const retireeController = require("../controllers/retireeController");
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Apply authentication middleware to all routes in this router
router.use(checkToken);
// Get eligible for retirement
router.get("/retiree/eligible", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), retireeController.getEligibleForRetirement)
// Get all retirees with pagination
router.get("/retiree", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), retireeController.getAllRetirees);
// Get retiree statistics (must be before :id route)
router.get("/retiree/stats", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), retireeController.getRetireeStats);
// Get summary of retirees by type
router.get("/retiree/summary", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), retireeController.getRetireesSummary);
// Get a single retiree by ID
router.get("/retiree/:id", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), retireeController.getRetireeById);
// Create a new retiree record
router.post("/retiree", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), retireeController.createRetiree);
// Update a retiree record
router.put("/retiree/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), retireeController.updateRetiree);
// Delete a retiree record
router.delete("/retiree/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), retireeController.deleteRetiree);
module.exports = router;