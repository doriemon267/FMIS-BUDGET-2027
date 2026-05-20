const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const bulkUploadManagementController = require('../controllers/bulkUploadManagementController');

// All routes require authentication
router.use(isAuth);

// Get upload status for Super Admin management page
router.get('/status', bulkUploadManagementController.getUploadStatus);

module.exports = router;
