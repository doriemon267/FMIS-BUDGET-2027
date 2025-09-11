const express = require('express');
const router = express.Router();
const consolidatedCapitalOutlayController = require('../controllers/consolidatedCapitalOutlayController');
const checkToken = require('../middleware/checkToken');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Test endpoint to verify routing
router.get('/test', (req, res) => {
  res.json({ message: 'Consolidated Capital Outlay routes are working!', timestamp: new Date().toISOString() });
});

// Get consolidated Capital Outlay data for reports
router.get('/capital-outlay-data', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedCapitalOutlayController.getConsolidatedCapitalOutlayData);

module.exports = router;
