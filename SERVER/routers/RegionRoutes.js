const express = require('express');
const router = express.Router();
const regionController = require('../controllers/RegionController');
const authMiddleware = require("../middleware/authMiddleware");
// Apply authentication middleware to all routes in this router
router.use(authMiddleware);
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