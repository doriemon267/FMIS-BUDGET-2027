/**
 * Workflow Template Routes
 * 
 * API endpoints for managing workflow templates
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { logUserActivity } = require('../middleware/userLogs');

// Apply authentication to all routes
router.use(authMiddleware);

const {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createProposalFromTemplate,
  shareTemplate,
} = require('../controllers/workflowTemplateController');

/**
 * GET /api/workflow-templates
 * Get all templates (with filtering)
 */
router.get('/', getAllTemplates);

/**
 * GET /api/workflow-templates/:id
 * Get single template by ID
 */
router.get('/:id', getTemplate);

/**
 * POST /api/workflow-templates
 * Create new template
 */
router.post('/', logUserActivity({ action: 'CREATE', resource: 'WorkflowTemplate' }), createTemplate);

/**
 * PUT /api/workflow-templates/:id
 * Update template
 */
router.put('/:id', logUserActivity({ action: 'UPDATE', resource: 'WorkflowTemplate', getResourceId: (req) => req.params.id }), updateTemplate);

/**
 * DELETE /api/workflow-templates/:id
 * Delete template (soft delete)
 */
router.delete('/:id', logUserActivity({ action: 'DELETE', resource: 'WorkflowTemplate', getResourceId: (req) => req.params.id }), deleteTemplate);

/**
 * POST /api/workflow-templates/:id/create-proposal
 * Create proposal from template
 */
router.post('/:id/create-proposal', createProposalFromTemplate);

/**
 * PUT /api/workflow-templates/:id/share
 * Share template with users
 */
router.put('/:id/share', shareTemplate);

module.exports = router;
