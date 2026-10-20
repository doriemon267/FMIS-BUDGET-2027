const express = require('express');
const router = express.Router();
const tierController = require('../controllers/tierController');
const protect = require('../middleware/is_auth');

// @desc    Get tier data for a specific context (fiscal year, region, etc.)
// @route   GET /api/tier
// @access  Private
router.get('/', protect, tierController.getTierData);

// @desc    Save tier data
// @route   POST /api/tier
// @access  Private
router.post('/', protect, tierController.saveTierData);

// @desc    Generate a PDF report of tier data
// @route   GET /api/tier/generate-pdf
// @access  Private
router.get('/generate-pdf', protect, tierController.generateTierPDF);

module.exports = router;
