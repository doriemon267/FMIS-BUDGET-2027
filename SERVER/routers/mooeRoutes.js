const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Import your controller (adjust the path as needed).
const mooeController = require('../controllers/mooeController');
const MooeProposal = require('../models/mooeProposals');
// Apply authentication to all MOOE routes
router.use(tokenMiddleware);
// Define routes to match the front-end requests with SUBMISSION WORKFLOW CONTROL
router.get('/mooe-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEData);
router.get('/mooe-entries', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEEntries);
router.get('/mooe-status', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEStatus);
router.post('/mooe-save', submissionWorkflowControl('create', { strictMode: false }), mooeController.bulkSaveMOOE);
router.post('/mooe-data', submissionWorkflowControl('create', { strictMode: false }), mooeController.bulkSaveMOOE); // <-- Added for frontend compatibility
router.get('/mooe-list', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMooeList);
// Add /mooe route for SubsidyBalanceMonitor compatibility
router.get('/mooe', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEData);
router.delete('/mooe-delete', mooeController.deleteAllMooeProposals);
// Optional: If your ProposalCustomPage is calling GET /MOOEProposal,
// you can map that route to the appropriate controller function.
router.get('/MOOEProposal', hierarchicalAccessControl('read'), mooeController.getMOOEData);
// Get MOOE by parameters - FIXED to use proper submission workflow filtering
router.get("/mooe/getByParams", submissionWorkflowControl('read'), mooeController.getMOOEByParams);
// Bulk update MOOE entries
router.put("/mooe/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), mooeController.bulkUpdateMOOE);
// Admin endpoint to fix database indexes
router.post('/mooe-fix-index', mooeController.fixDatabaseIndex);
module.exports = router;
