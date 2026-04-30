const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { getAllPersonnel, addPersonnel } = require('../controllers/personnelController');
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
router.get('/personnels', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllPersonnel);
router.post('/addpersonnel', submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), addPersonnel);
module.exports = router;