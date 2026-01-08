const Router = require('express').Router;
const { submissionWorkflowTransitions } = require('../middleware/submissionWorkflowControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { requirePermission } = require('../middleware/hierarchicalAssignmentMiddleware');
const { hasWorkflowRole } = require('../helpers/workflowRoleManager');
const checkToken = require('../middleware/check_token');
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
 * Responsibility Center Level Routes
 */
// Responsibility Center submits to Office
router.post(
  '/responsibility-center/submit-to-office',
  submissionWorkflowControl('update'),
  requireWorkflowRole('responsibilityCenterCreator'),
  submissionWorkflowTransitions.responsibilityCenterSubmitToOffice
);
/**
 * Office Level Routes
 */
// Office returns RC submissions back to Responsibility Center
router.post(
  '/office/return-to-responsibility-center',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeConsolidator'),
  submissionWorkflowTransitions.officeReturnToResponsibilityCenter
);

// Step 3→4: Reviewer approves and forwards to Officer (Division Submitted → Forwarded to Officer)
router.post(
  '/office/verify-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeConsolidator'),
  submissionWorkflowTransitions.officeVerifySubmission
);

// Step 5→6: Officer submits to Manager (Officer Approved → Forwarded to Manager)
router.post(
  '/office/submit-own',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeConsolidator'),
  submissionWorkflowTransitions.officeSubmitOwn
);
// Office creates own submissions directly to finalization (for office-level proposals)
router.post(
  '/office/submit-own-to-finalize',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeSubmission'),
  async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          // Accept records created at Office level; some legacy records may not have originalLevel set
          $or: [
            { originalLevel: 'OFFICE' },
            { originalLevel: { $exists: false } },
            { originalLevel: null },
            { originalLevel: '' }
          ],
          // Handle status case variations
          status: { $in: ['Draft', 'Not Submitted', 'DRAFT', 'NOT SUBMITTED'] }
        },
        { 
          $set: { 
            status: 'Office Submitted',
            submittedToOfficeAt: new Date(),
            submittedToOfficeBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'OFFICE_TO_FINALIZE',
            // Normalize originalLevel going forward
            originalLevel: 'OFFICE',
            // Ensure office-origin records do not carry a responsibility center value
            responsibilityCenter: null
          } 
        }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          success: false,
          message: 'No matching department-owned draft to submit. Ensure items are Draft at Department level.',
          code: 'NO_MATCH_DEPT_SUBMIT_OWN',
        });
      }
      return res.status(200).json({ 
        success: true,
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
 * Officer Level Routes (continued)
 */
// Step 3→4: Officer approves submissions (Forwarded to Officer → Officer Approved)
router.post(
  '/office/approve-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeFinalVerifier'),
  requirePermission('canApproveProposals', 'Permission denied: Can Approve Proposals is required'),
  submissionWorkflowTransitions.officeApproveSubmission
);

// Step 5→6: Manager approves and finalizes submissions (Forwarded to Manager → Finalized)
router.post(
  '/office/finalize-submission',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeFinalVerifier'),
  requirePermission('canApproveProposals', 'Permission denied: Can Approve Proposals is required'),
  submissionWorkflowTransitions.officeFinalizeSubmission
);
// Office creates own submissions and finalizes directly (for office-level proposals)
router.post(
  '/office/submit-own',
  submissionWorkflowControl('update'),
  requireWorkflowRole('officeFinalVerifier'),
  async (req, res) => {
    try {
      const { ids = [], entity = 'personnel', submissionNote } = req.body;
      const userId = req.user?.id || 'system';
      const Model = getModelByEntity(entity);
      const result = await Model.updateMany(
        { 
          _id: { $in: ids },
          originalLevel: 'OFFICE',
          status: { $in: ['Draft', 'Not Submitted'] }
        },
        { 
          $set: { 
            status: 'Finalized',
            finalizedAt: new Date(),
            finalizedBy: userId,
            submissionNote: submissionNote || '',
            lastWorkflowTransition: 'OFFICE_FINALIZATION'
          } 
        }
      );
      return res.status(200).json({ 
        message: 'Successfully finalized office proposals', 
        modified: result.modifiedCount 
      });
    } catch (e) {
      console.error('office submit own error:', e);
      return res.status(500).json({ 
        message: 'Office submission failed', 
        error: e.message 
      });
    }
  }
);
/**
 * Data Retrieval Routes with Submission Workflow Filtering
 */
// Get submissions pending approval at office level
router.get(
  '/office/pending-approvals',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeConsolidator'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      // Get submissions from responsibility centers in this office that need verification or further action
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'RESPONSIBILITY_CENTER',
        status: { $in: ['Responsibility Center Submitted', 'Office Verified'] },
        lastWorkflowTransition: { $in: ['RESPONSIBILITY_CENTER_TO_OFFICE', 'OFFICE_VERIFICATION'] }
      }).sort({ submittedToOfficeAt: -1 });
      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingSubmissions.length,
        submissions: pendingSubmissions
      });
    } catch (error) {
      console.error('Error fetching pending office approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending approvals',
        error: error.message
      });
    }
  }
);
// Get submissions pending approval at office level
router.get(
  '/office/pending-approvals',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeFinalVerifier'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      // Get submissions from responsibility centers and office that are pending approval or finalization
      const pendingSubmissions = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
        status: { $in: ['Forwarded to Manager', 'Officer Approved', 'FORWARDED_TO_MANAGER', 'OFFICER_APPROVED', 'Office Submitted', 'Office Approved'] },
        lastWorkflowTransition: { $in: ['OFFICE_TO_FINALIZE', 'OFFICE_APPROVAL'] }
      }).sort({ submittedToOfficeAt: -1, approvedByOfficeAt: -1 });
      res.status(200).json({
        success: true,
        entity,
        pendingCount: pendingSubmissions.length,
        submissions: pendingSubmissions
      });
    } catch (error) {
      console.error('Error fetching pending office approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending approvals',
        error: error.message
      });
    }
  }
);

// Additional routes for the new 6-step workflow

// Get submissions pending verification at office level
router.get(
  '/office/pending-verification',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeConsolidator'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const pendingVerification = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'RESPONSIBILITY_CENTER',
        status: 'Responsibility Center Submitted',
        lastWorkflowTransition: 'RESPONSIBILITY_CENTER_TO_OFFICE'
      }).sort({ submittedToOfficeAt: -1 });

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

// Get verified submissions ready to submit to finalization
router.get(
  '/office/ready-to-submit',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeConsolidator'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const readyToSubmit = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: 'RESPONSIBILITY_CENTER',
        status: 'Office Verified',
        lastWorkflowTransition: 'OFFICE_VERIFICATION'
      }).sort({ verifiedByOfficeAt: -1 });

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

// Get submissions ready for approval at office level
router.get(
  '/office/pending-approval',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeFinalVerifier'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const pendingApproval = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
        status: 'Office Submitted',
        lastWorkflowTransition: 'OFFICE_TO_FINALIZE'
      }).sort({ submittedToOfficeAt: -1 });

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
  '/office/ready-to-finalize',
  submissionWorkflowControl('read'),
  requireWorkflowRole('officeFinalVerifier'),
  async (req, res) => {
    try {
      const { entity = 'personnel' } = req.query;
      const Model = getModelByEntity(entity);
      
      const readyToFinalize = await Model.find({
        ...req.submissionWorkflowFilters,
        originalLevel: { $in: ['RESPONSIBILITY_CENTER', 'OFFICE'] },
        status: 'Office Approved',
        lastWorkflowTransition: 'OFFICE_APPROVAL'
      }).sort({ approvedByOfficeAt: -1 });

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
      return require('../models/PersonnelServices');
    case 'mooe':
      return require('../models/mooeProposals');
    case 'capital':
      return require('../models/CapitalOutlay');
    case 'income':
      return require('../models/Income');
    case 'budgetarySupport':
      return require('../models/BudgetarySupport');
    default:
      return require('../models/PersonnelServices');
  }
};
module.exports = router;
