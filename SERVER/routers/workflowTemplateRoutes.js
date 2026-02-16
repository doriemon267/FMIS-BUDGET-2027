/**
 * Workflow Template Routes
 * 
 * API endpoints for managing workflow templates
 */

const express = require('express');
const router = express.Router();
const check_token_dev = require('../middleware/check_token_dev');
const check_token_prod = require('../middleware/check_token_prod');
const IS_PRODUCTION = require('../utils/IS_PRODUCTION');
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Apply authentication to all routes
router.use(tokenMiddleware);

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
router.post('/', createTemplate);

/**
 * PUT /api/workflow-templates/:id
 * Update template
 */
router.put('/:id', updateTemplate);

/**
 * DELETE /api/workflow-templates/:id
 * Delete template (soft delete)
 */
router.delete('/:id', deleteTemplate);

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
