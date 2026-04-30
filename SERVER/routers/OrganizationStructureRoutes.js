const express = require('express');
const router = express.Router();
const organizationStructureController = require('../controllers/OrganizationStructureController');
const authMiddleware = require("../middleware/authMiddleware");

// Apply authentication middleware
router.use(authMiddleware);

// Get all mappings
router.get('/', organizationStructureController.getMappings);

// Get a specific mapping by region and department query params
router.get('/specific', organizationStructureController.getMappingByRegionAndDepartment);

// Create or update a mapping
router.post('/', organizationStructureController.saveMapping);

// Delete a mapping
router.delete('/:id', organizationStructureController.deleteMapping);

module.exports = router;
