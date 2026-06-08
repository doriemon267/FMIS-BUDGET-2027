const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
const organizationStructureController = require('../controllers/OrganizationStructureController');

// Apply authentication middleware
router.use(isAuth);

// Get all mappings
router.get('/', organizationStructureController.getMappings);

// Get a specific mapping by region and department query params
router.get('/specific', organizationStructureController.getMappingByRegionAndDepartment);

// Create or update a mapping
router.post('/', requireDynamicPermission('/setup/organization'), organizationStructureController.saveMapping);

// Delete a mapping
router.delete('/:id', requireDynamicPermission('/setup/organization'), organizationStructureController.deleteMapping);

module.exports = router;

