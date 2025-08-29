const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues
} = require('../controllers/consolidatedPersonnelServicesController');

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Routes for consolidated personnel services reports
router.get('/personnel-services-data', getConsolidatedPersonnelServicesData);
router.get('/available-regions-ps', getAvailableRegions);
router.get('/debug-status-values', getStatusOfAppointmentValues);

module.exports = router;