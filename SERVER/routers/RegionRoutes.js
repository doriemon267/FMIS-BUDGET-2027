const express = require('express');
const router = express.Router();
const regionController = require('../controllers/RegionController');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Get all regions
router.get('/', regionController.getAllRegions);
// Get region information (equivalences and special regions)
router.get('/info/mappings', regionController.getRegionInfo);
// Get a region by ID
router.get('/:id', regionController.getRegionById);
// Create a new region
router.post('/', regionController.createRegion);
// Update a region
router.put('/:id', regionController.updateRegion);
// Delete a region
router.delete('/:id', regionController.deleteRegion);
module.exports = router;