const express = require('express');
const router = express.Router();
const organizationStructureController = require('../controllers/OrganizationStructureController');
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Apply authentication middleware
router.use(tokenMiddleware);

// Get all mappings
router.get('/', organizationStructureController.getMappings);

// Get a specific mapping by region and department query params
router.get('/specific', organizationStructureController.getMappingByRegionAndDepartment);

// Create or update a mapping
router.post('/', organizationStructureController.saveMapping);

// Delete a mapping
router.delete('/:id', organizationStructureController.deleteMapping);

module.exports = router;
