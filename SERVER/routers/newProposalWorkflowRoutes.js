const express = require('express');
const router = express.Router();
const newProposalWorkflowController = require('../controllers/newProposalWorkflowController');
const consolidationController = require('../controllers/consolidationController');
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
const multer = require('multer');
const path = require('path');

// Apply authentication middleware to all routes
router.use(isAuth);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/');
    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow only PDF and Excel files
    const allowedMimes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../uploads/', filename);
  res.download(filepath, (err) => {
    if (err) {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  });
});

// Routes for proposal management
router.post('/proposals', requireDynamicPermission('/proposal'), newProposalWorkflowController.createProposal);
router.get('/proposals', newProposalWorkflowController.getProposals);
router.get('/proposals/my-proposals', newProposalWorkflowController.getMyProposals);
router.get('/proposals/pending-review', newProposalWorkflowController.getPendingReview);

// ── Merge route: MUST be BEFORE generic /:id routes to avoid param clash ──────
router.post('/proposals/merge', requireDynamicPermission('/proposal'), newProposalWorkflowController.mergeProposals);

// Specific routes with parameters must come BEFORE generic /:id routes
router.get('/proposals/:id/audit-trail', newProposalWorkflowController.getAuditTrail);
router.post('/proposals/:id/action', requireDynamicPermission('/proposal'), async (req, res, next) => {
  // Lock enforcement: block workflow actions if proposal is currently locked by a different user
  try {
    const ProposalLockingService = require('../services/proposalLockingService');
    const lockStatus = await ProposalLockingService.getLockStatus(req.params.id);
    // Determine calling user's ID from auth token (req.user set by isAuth)
    const requestingUserId = String(
      req.user?.particularID || req.user?.Username || req.user?.Id || req.user?.id || ''
    );
    if (
      lockStatus &&
      !lockStatus.error &&
      lockStatus.isLocked &&
      lockStatus.lockedBy?.userId &&
      String(lockStatus.lockedBy.userId) !== requestingUserId
    ) {
      return res.status(409).json({
        success: false,
        error: `Proposal is currently being edited by ${lockStatus.lockedBy.userName || 'another user'}. Please wait for them to finish before submitting.`,
        lockedBy: lockStatus.lockedBy,
        lockedAt: lockStatus.lockedAt
      });
    }
  } catch (_) {
    // Lock check error — allow action to proceed (non-blocking)
  }
  next();
}, newProposalWorkflowController.performAction);

// NEW: Get proposal totals by workflow ref (for BudgetarySupportTable)
router.get('/proposals/:workflowRefId/totals', newProposalWorkflowController.getProposalTotalsByWorkflowRef);

// Attachment routes - BEFORE generic /:id routes
router.post('/proposals/:id/attachments', requireDynamicPermission('/proposal'), upload.single('file'), newProposalWorkflowController.uploadAttachment);
router.delete('/proposals/:id/attachments/:attachmentId', requireDynamicPermission('/proposal'), newProposalWorkflowController.deleteAttachment);
router.get('/proposals/:id/attachments', newProposalWorkflowController.getAttachments);

// Get analysts eligible for a specific proposal (region-based routing)
router.get('/proposals/:id/analysts-for-proposal', newProposalWorkflowController.getAnalystsForProposal);

// Generic routes AFTER specific ones
router.get('/proposals/:id', newProposalWorkflowController.getProposalById);
router.put('/proposals/:id', requireDynamicPermission('/proposal'), newProposalWorkflowController.updateProposal);
router.delete('/proposals/:id', requireDynamicPermission('/proposal'), newProposalWorkflowController.deleteProposal);

// BRD Consolidation Routes
router.get('/consolidation/folders', consolidationController.getFolders);
router.get('/consolidation/folders/:path/proposals', consolidationController.getProposalsInFolder);
router.get('/consolidation/regions', consolidationController.getRegionStructure);
router.get('/consolidation/central-office', consolidationController.getCentralOfficeStructure);
router.get('/consolidation/summary', consolidationController.getSummary);
router.get('/consolidation/:consolidationId', consolidationController.getConsolidationRecord);
router.put('/consolidation/:consolidationId/org-info', requireDynamicPermission('/proposal'), consolidationController.updateOrganizationalInfo);

module.exports = router;
