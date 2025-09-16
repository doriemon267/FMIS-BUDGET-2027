const Router = require('express').Router;
const { submissionWorkflowTransitions } = require('../middleware/submissionWorkflowControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { requirePermission } = require('../middleware/hierarchicalAssignmentMiddleware');
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
// Step 2→3: Department verifies division submissions (Division Submitted → Department Verified)
router.post(
  '/department/verify-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentConsolidator'),
  submissionWorkflowTransitions.departmentVerifySubmission
);

// Step 3→4: Department submits to Region (Department Verified → Department Submitted)
router.post(
  '/department/submit-to-region',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentConsolidator'),
  submissionWorkflowTransitions.departmentSubmitToRegion
);
// Department creates own submissions directly to region (for department-level proposals)
router.post(
  '/department/submit-own-to-region',
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
            status: 'Department Submitted',
            submittedToRegionAt: new Date(),
            submittedToRegionBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'DEPARTMENT_TO_REGION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully submitted department proposals to Region for review', 
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
// Step 4→5: Region approves submissions (Department Submitted → Region Approved)
router.post(
  '/region/approve-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('regionFinalVerifier'),
  requirePermission('canApproveProposals', 'Permission denied: Can Approve Proposals is required'),
  submissionWorkflowTransitions.regionApproveSubmission
);

// Step 5→6: Region finalizes submissions (Region Approved → Finalized)
router.post(
  '/region/finalize-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('regionFinalVerifier'),
  requirePermission('canApproveProposals', 'Permission denied: Can Approve Proposals is required'),
  submissionWorkflowTransitions.regionFinalizeSubmission
);
// Region creates own submissions and finalizes directly (for region-level proposals)
router.post(
  '/region/submit-own',
  submissionWorkflowControl('update'),
  requireWorkflowRole('regionFinalVerifier'),
  async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: 'REGION',
          status: { $in: ['Draft', 'Not Submitted'] }
        },
        { 
          $set: { 
            status: 'Finalized',
            finalizedAt: new Date(),
            finalizedBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'REGION_FINALIZATION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully finalized region proposals', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      console.error('region submit own error:', e);
      return res.status(500).json({ 
        message: 'Region submission failed', 
        error: e.message 
      });
    }
  }
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
      // Get submissions from divisions in this department that need verification or further action
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'DIVISION',
        status: { $in: ['Division Submitted', 'Department Verified'] },
        lastWorkflowTransition: { $in: ['DIVISION_TO_DEPARTMENT', 'DEPARTMENT_VERIFICATION'] }
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
      // Get submissions from departments in this region that are pending approval or finalization
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['DIVISION', 'DEPARTMENT'] },
        status: { $in: ['Department Submitted', 'Region Approved'] },
        lastWorkflowTransition: { $in: ['DEPARTMENT_TO_REGION', 'REGION_APPROVAL'] }
      }).sort({ submittedToRegionAt: -1, approvedByRegionAt: -1 });
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

// Additional routes for the new 6-step workflow

// Get submissions pending verification at department level
router.get(
  '/department/pending-verification',
  submissionWorkflowControl('read'),
  requireWorkflowRole('departmentConsolidator'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const pendingVerification = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'DIVISION',
        status: 'Division Submitted',
        lastWorkflowTransition: 'DIVISION_TO_DEPARTMENT'
      }).sort({ submittedToDepartmentAt: -1 });

      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingVerification.length,
        submissions: pendingVerification
      });
    } catch (error) {
      console.error('Error fetching pending verification:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending verification',
        error: error.message
      });
    }
  }
);

// Get verified submissions ready to submit to region
router.get(
  '/department/ready-to-submit',
  submissionWorkflowControl('read'),
  requireWorkflowRole('departmentConsolidator'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const readyToSubmit = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'DIVISION',
        status: 'Department Verified',
        lastWorkflowTransition: 'DEPARTMENT_VERIFICATION'
      }).sort({ verifiedByDepartmentAt: -1 });

      res.status(200).json({
        success: true,
        entity,
        readyCount: readyToSubmit.length,
        submissions: readyToSubmit
      });
    } catch (error) {
      console.error('Error fetching ready to submit:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching ready to submit',
        error: error.message
      });
    }
  }
);

// Get submissions ready for approval at region level
router.get(
  '/region/pending-approval',
  submissionWorkflowControl('read'),
  requireWorkflowRole('regionFinalVerifier'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const pendingApproval = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['DIVISION', 'DEPARTMENT'] },
        status: 'Department Submitted',
        lastWorkflowTransition: 'DEPARTMENT_TO_REGION'
      }).sort({ submittedToRegionAt: -1 });

      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingApproval.length,
        submissions: pendingApproval
      });
    } catch (error) {
      console.error('Error fetching pending approval:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending approval',
        error: error.message
      });
    }
  }
);

// Get approved submissions ready for finalization
router.get(
  '/region/ready-to-finalize',
  submissionWorkflowControl('read'),
  requireWorkflowRole('regionFinalVerifier'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const readyToFinalize = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['DIVISION', 'DEPARTMENT', 'REGION'] },
        status: 'Region Approved',
        lastWorkflowTransition: 'REGION_APPROVAL'
      }).sort({ approvedByRegionAt: -1 });

      res.status(200).json({
        success: true,
        entity,
        readyCount: readyToFinalize.length,
        submissions: readyToFinalize
      });
    } catch (error) {
      console.error('Error fetching ready to finalize:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching ready to finalize',
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
