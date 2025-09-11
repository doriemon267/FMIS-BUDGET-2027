const Router = require('express').Router;
const { submissionWorkflowTransitions } = require('../middleware/submissionWorkflowControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { hasWorkflowRole } = require('../helpers/workflowRoleManager');
const checkToken = require('../middleware/checkToken');
const router = Router();
// Auth for all workflow routes
router.use(checkToken);
/**
 * Middleware to check workflow role permissions
 */
const requireWorkflowRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const hasRole = await hasWorkflowRole(userId, requiredRole);
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required workflow role: ${requiredRole}`,
          code: 'WORKFLOW_ROLE_REQUIRED',
          requiredRole
        });
      }
      next();
    } catch (error) {
      console.error('Workflow role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking workflow permissions',
        error: error.message
      });
    }
  };
};
/**
 * Division Level Routes
 */
// Division submits to Department
router.post(
  '/division/submit-to-department',
  submissionWorkflowControl('update'),
  requireWorkflowRole('divisionCreator'),
  submissionWorkflowTransitions.divisionSubmitToDepartment
);
/**
 * Department Level Routes
 */
// Department approves division submissions and submits to Region
router.post(
  '/department/approve-and-submit',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentConsolidator'),
  submissionWorkflowTransitions.departmentSubmitToRegion
);
// Department creates own submissions
router.post(
  '/department/submit-to-region',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentSubmission'),
  async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: 'DEPARTMENT',
          status: { $in: ['Draft', 'Not Submitted'] }
        },
        { 
          $set: { 
            status: 'Submitted',
            submittedToRegionAt: new Date(),
            submittedToRegionBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'DEPARTMENT_TO_REGION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully submitted to Region for review', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      console.error('department submit to region error:', e);
      return res.status(500).json({ 
        message: 'Department submission failed', 
        error: e.message 
      });
    }
  }
);
/**
 * Region Level Routes
 */
// Region provides final approval
router.post(
  '/region/final-approval',
  submissionWorkflowControl('update'),
  requireWorkflowRole('regionFinalVerifier'),
  submissionWorkflowTransitions.regionFinalApproval
);
/**
 * Data Retrieval Routes with Submission Workflow Filtering
 */
// Get submissions pending approval at department level
router.get(
  '/department/pending-approvals',
  submissionWorkflowControl('read'),
  requireWorkflowRole('departmentConsolidator'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      // Get submissions from divisions in this department that are pending approval
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'DIVISION',
        status: 'Submitted',
        lastWorkflowTransition: 'DIVISION_TO_DEPARTMENT'
      }).sort({ submittedToDepartmentAt: -1 });
      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingSubmissions.length,
        submissions: pendingSubmissions
      });
    } catch (error) {
      console.error('Error fetching pending department approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending approvals',
        error: error.message
      });
    }
  }
);
// Get submissions pending approval at region level
router.get(
  '/region/pending-approvals',
  submissionWorkflowControl('read'),
  requireWorkflowRole('regionFinalVerifier'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      // Get submissions from departments in this region that are pending final approval
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['DIVISION', 'DEPARTMENT'] },
        status: 'Submitted',
        lastWorkflowTransition: { $in: ['DIVISION_TO_DEPARTMENT', 'DEPARTMENT_TO_REGION'] }
      }).sort({ submittedToRegionAt: -1, submittedToDepartmentAt: -1 });
      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingSubmissions.length,
        submissions: pendingSubmissions
      });
    } catch (error) {
      console.error('Error fetching pending region approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending approvals',
        error: error.message
      });
    }
  }
);
// Get submission status summary
router.get(
  '/submission-status-summary',
  submissionWorkflowControl('read'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      const statusCounts = await Model.aggregate([
        { $match: req.submissionWorkflowFilters },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      const workflowCounts = await Model.aggregate([
        { $match: req.submissionWorkflowFilters },
        {
          $group: {
            _id: '$lastWorkflowTransition',
            count: { $sum: 1 }
          }
        }
      ]);
      res.status(200).json({
        success: true,
        entity,
        statusCounts,
        workflowCounts,
        userLevel: req.hierarchicalAccessInfo.scope
      });
    } catch (error) {
      console.error('Error fetching submission status summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching status summary',
        error: error.message
      });
    }
  }
);
/**
 * Helper function to get model by entity type
 */
const getModelByEntity = (entity) => {
  switch (entity) {
    case 'personnel':
      return require('../models/personnelServices');
    case 'mooe':
      return require('../models/mooeProposals');
    case 'capital':
      return require('../models/CapitalOutlay');
    case 'income':
      return require('../models/Income');
    case 'budgetarySupport':
      return require('../models/BudgetarySupport');
    default:
      return require('../models/personnelServices');
  }
};
module.exports = router;