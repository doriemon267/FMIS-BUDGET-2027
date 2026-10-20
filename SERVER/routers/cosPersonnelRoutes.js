const {
  bulkAddCOSPersonnel,
  getAllCOSPersonnel,
  updateCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS,
  getCOSByParams,
  getCOSPremiumSettings,
  updateCOSPremiumSettings
} = require("../controllers/cosPersonnelController");
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const isAuth = require('../middleware/is_auth');
const { 
  loadHierarchicalAssignment, 
  applyHierarchicalFilters 
} = require('../middleware/hierarchicalAssignmentMiddleware');

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const cosPersonnelRouter = Router();
// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(isAuth);
// Load hierarchical assignment for all routes
cosPersonnelRouter.use(loadHierarchicalAssignment);

cosPersonnelRouter.get("/cosPersonnels", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, getAllCOSPersonnel);
cosPersonnelRouter.get("/api/cos/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, getCOSByParams);
cosPersonnelRouter.get("/cos-personnel/premium-settings", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, getCOSPremiumSettings);
cosPersonnelRouter.put("/cos-personnel/premium-settings/:proposalId", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, updateCOSPremiumSettings);
cosPersonnelRouter.post("/cos-personnel/bulk-add", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, bulkAddCOSPersonnel);
cosPersonnelRouter.put("/cos-personnel/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, updateCOSPersonnel);
cosPersonnelRouter.delete("/cos-personnel/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, deleteCOSPersonnel);
cosPersonnelRouter.get("/grandtotalCOS", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), applyHierarchicalFilters, getGrandTotalCOS);
module.exports = cosPersonnelRouter;
