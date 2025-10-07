const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const {
  loadHierarchicalAssignment,
  requirePermission
} = require('../middleware/hierarchicalAssignmentMiddleware');

const {
  getProposalForEdit,
  saveDraftEdit,
  submitEdit,
  getEditById,
  getEditsByProposal,
  getComparisonData,
  approveEdit,
  deleteDraftEdit
} = require('../controllers/budgetOfficerEditController');

// Apply authentication to all routes
router.use(checkToken);
router.use(loadHierarchicalAssignment);

/**
 * Custom middleware to check if user is a Budget Officer
 * Budget Officers are users with DEPARTMENT, OFFICE, REGION, or FULL assignment level
 * OR users with specific workflow roles
 */
const requireBudgetOfficerAccess = (req, res, next) => {
  const assignment = req.userHierarchicalAssignment;
  const workflowRoles = assignment?.workflowRoles || [];
  
  // Check assignment level
  const validLevels = ['DEPARTMENT', 'OFFICE', 'REGION', 'FULL'];
  const hasValidLevel = validLevels.includes(assignment?.assignmentLevel);
  
  // Check workflow roles
  const validRoles = ['departmentConsolidator', 'officeConsolidator', 'regionFinalVerifier'];
  const hasValidRole = validRoles.some(role => workflowRoles.includes(role));
  
  // Check if user has EditAllProposals permission
  const hasPermission = req.hierarchicalFlags?.canEditAllProposals === true;
  
  if (hasValidLevel || hasValidRole || hasPermission) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied: Budget Officer access required (DEPARTMENT, OFFICE, REGION, or FULL level)',
    code: 'INSUFFICIENT_PERMISSIONS',
    required: 'Budget Officer access'
  });
};

// Get proposal data for editing (Budget Officer only)
router.get('/proposal-for-edit', 
  requireBudgetOfficerAccess,
  getProposalForEdit
);

// Save draft edit (Budget Officer only)
router.post('/draft',
  requireBudgetOfficerAccess,
  saveDraftEdit
);

// Submit edit for approval (Budget Officer only)
router.post('/submit',
  requireBudgetOfficerAccess,
  submitEdit
);

// Get edit by ID
router.get('/:id',
  getEditById
);

// Get edits for a specific proposal
router.get('/proposal/:proposalId',
  getEditsByProposal
);

// Get comparison data (for Budget Analyst to see changes)
router.get('/comparison/:proposalId',
  getComparisonData
);

// Approve edit (Budget Manager or higher)
router.post('/:id/approve',
  requirePermission('canApproveProposals'),
  approveEdit
);

// Delete draft edit
router.delete('/:id',
  requireBudgetOfficerAccess,
  deleteDraftEdit
);

module.exports = router;