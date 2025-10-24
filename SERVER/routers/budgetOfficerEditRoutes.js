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
 * Custom middleware to check if user is a Budget Officer, Budget Coordinator, Budget Analyst, Approver, or Reviewer
 * Budget Officers are users with DEPARTMENT, OFFICE, REGION, or FULL assignment level
 * OR users with specific workflow roles
 * Budget Coordinators have DIVISION level or divisionapprover role
 * Budget Analysts have BUDGET_ANALYST user role
 * Approvers have APPROVER user role or approver workflow roles
 * Reviewers have REVIEWER user role or reviewer workflow roles
 */
const requireBudgetOfficerAccess = (req, res, next) => {
  const assignment = req.userHierarchicalAssignment;
  const workflowRoles = assignment?.workflowRoles || [];
  const userRoles = req.user?.Roles || [];
  
  // Check assignment level (includes Budget Officer levels + Budget Coordinator DIVISION level)
  const validLevels = ['DIVISION', 'DEPARTMENT', 'OFFICE', 'REGION', 'FULL'];
  const hasValidLevel = validLevels.includes(assignment?.assignmentLevel);
  
  // Check workflow roles (includes Budget Officer roles + Budget Coordinator divisionapprover role + APPROVER roles + REVIEWER roles)
  const validRoles = ['divisionapprover', 'officeapprover', 'departmentConsolidator', 'officeConsolidator', 'regionFinalVerifier', 'divisionReviewer', 'officeReviewer'];
  const hasValidRole = validRoles.some(role => workflowRoles.includes(role));
  
  // Check user roles (includes BUDGET_ANALYST, APPROVER, REVIEWER)
  const hasValidUserRole = userRoles.includes('BUDGET_ANALYST') || userRoles.includes('APPROVER') || userRoles.includes('REVIEWER');
  
  // Check if user has EditAllProposals permission
  const hasPermission = req.hierarchicalFlags?.canEditAllProposals === true;
  
  if (hasValidLevel || hasValidRole || hasValidUserRole || hasPermission) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied: Budget Officer, Budget Coordinator, Budget Analyst, Approver, or Reviewer access required',
    code: 'INSUFFICIENT_PERMISSIONS',
    required: 'Budget Officer, Budget Coordinator, Budget Analyst, Approver, or Reviewer access'
  });
};

// Get proposal data for editing (Budget Officer or Budget Coordinator)
router.get('/proposal-for-edit', 
  requireBudgetOfficerAccess,
  getProposalForEdit
);

// Save draft edit (Budget Officer or Budget Coordinator)
router.post('/draft',
  requireBudgetOfficerAccess,
  saveDraftEdit
);

// Submit edit for approval (Budget Officer or Budget Coordinator)
router.post('/submit',
  requireBudgetOfficerAccess,
  submitEdit
);

// ⚠️ IMPORTANT: Specific routes MUST come BEFORE generic /:id route!
// Otherwise Express will match /:id first and fail for /comparison/:proposalId and /proposal/:proposalId

// Get comparison data (for Budget Analyst to see changes)
router.get('/comparison/:proposalId',
  getComparisonData
);

// Get edits for a specific proposal
router.get('/proposal/:proposalId',
  getEditsByProposal
);

// Approve edit (Budget Manager or higher)
router.post('/:id/approve',
  requirePermission('canApproveProposals'),
  approveEdit
);

// Generic routes MUST be LAST
// Get edit by ID
router.get('/:id',
  getEditById
);

// Delete draft edit
router.delete('/:id',
  requireBudgetOfficerAccess,
  deleteDraftEdit
);

module.exports = router;