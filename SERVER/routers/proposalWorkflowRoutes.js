const Router = require('express').Router;
const { enforceWorkflowTransition, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const checkToken = require('../middleware/checkToken');
// Controller handlers (to be implemented or wired to existing logic)
const proposalController = require('../controllers/proposalController');
const router = Router();
// Auth for all workflow routes
router.use(checkToken);
// Division approval
router.post(
  '/division/approve',
  hierarchicalAccessControl('update'),
  enforceWorkflowTransition('divisionApprove'),
  proposalController.approveAtDivision || ((req, res) => res.status(501).json({ message: 'approveAtDivision not implemented' }))
);
// Department consolidate
router.post(
  '/department/consolidate',
  hierarchicalAccessControl('update'),
  enforceWorkflowTransition('departmentConsolidate'),
  proposalController.consolidateAtDepartment || ((req, res) => res.status(501).json({ message: 'consolidateAtDepartment not implemented' }))
);
// Department submit to region
router.post(
  '/department/submit-to-region',
  hierarchicalAccessControl('update'),
  enforceWorkflowTransition('departmentSubmit'),
  proposalController.submitToRegion || ((req, res) => res.status(501).json({ message: 'submitToRegion not implemented' }))
);
// Region final verify
router.post(
  '/region/final-verify',
  hierarchicalAccessControl('update'),
  enforceWorkflowTransition('regionFinalVerify'),
  proposalController.finalVerifyAtRegion || ((req, res) => res.status(501).json({ message: 'finalVerifyAtRegion not implemented' }))
);
module.exports = router;