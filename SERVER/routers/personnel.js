const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { getAllPersonnel, addPersonnel } = require('../controllers/personnelController');
// Apply authentication middleware to all routes in this router
router.use(checkToken);
router.get('/personnels', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllPersonnel);
router.post('/addpersonnel', submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), addPersonnel);
module.exports = router;