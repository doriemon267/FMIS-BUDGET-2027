const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues
} = require('../controllers/consolidatedPersonnelServicesController');
const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
// Apply authentication middleware to all routes in this router
router.use(checkToken);
// Routes for consolidated personnel services reports
router.get('/personnel-services-data', hierarchicalAccessControl('read', { allowedFields: ['region'] }), getConsolidatedPersonnelServicesData);
router.get('/available-regions-ps', hierarchicalAccessControl('read', { allowedFields: ['region'] }), getAvailableRegions);
router.get('/debug-status-values', hierarchicalAccessControl('read', { allowedFields: ['region'] }), getStatusOfAppointmentValues);
module.exports = router;