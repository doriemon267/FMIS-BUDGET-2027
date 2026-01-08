const express = require('express');
const router = express.Router();
const newProposalWorkflowController = require('../controllers/newProposalWorkflowController');
const consolidationController = require('../controllers/consolidationController');
const checkToken = require('../middleware/check_token');
const multer = require('multer');
const path = require('path');

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

// Apply authentication middleware to all routes
router.use(checkToken);

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
router.post('/proposals', newProposalWorkflowController.createProposal);
router.get('/proposals', newProposalWorkflowController.getProposals);
router.get('/proposals/my-proposals', newProposalWorkflowController.getMyProposals);
router.get('/proposals/pending-review', newProposalWorkflowController.getPendingReview);
// Specific routes with parameters must come BEFORE generic /:id routes
router.get('/proposals/:id/audit-trail', newProposalWorkflowController.getAuditTrail);
router.post('/proposals/:id/action', newProposalWorkflowController.performAction);
// NEW: Get proposal totals by workflow ref (for BudgetarySupportTable)
router.get('/proposals/:workflowRefId/totals', newProposalWorkflowController.getProposalTotalsByWorkflowRef);

// Attachment routes - BEFORE generic /:id routes
router.post('/proposals/:id/attachments', upload.single('file'), newProposalWorkflowController.uploadAttachment);
router.delete('/proposals/:id/attachments/:attachmentId', newProposalWorkflowController.deleteAttachment);
router.get('/proposals/:id/attachments', newProposalWorkflowController.getAttachments);

// Generic routes AFTER specific ones
router.get('/proposals/:id', newProposalWorkflowController.getProposalById);
router.put('/proposals/:id', newProposalWorkflowController.updateProposal);
router.delete('/proposals/:id', newProposalWorkflowController.deleteProposal);

// BRD Consolidation Routes
router.get('/consolidation/folders', consolidationController.getFolders);
router.get('/consolidation/folders/:path/proposals', consolidationController.getProposalsInFolder);
router.get('/consolidation/regions', consolidationController.getRegionStructure);
router.get('/consolidation/central-office', consolidationController.getCentralOfficeStructure);
router.get('/consolidation/summary', consolidationController.getSummary);
router.get('/consolidation/:consolidationId', consolidationController.getConsolidationRecord);
router.put('/consolidation/:consolidationId/org-info', consolidationController.updateOrganizationalInfo);

module.exports = router;