const express = require("express");
const router = express.Router();
const discountSettingsController = require("../controllers/discountSettingsController");

// Get discount settings
router.get("/", discountSettingsController.getDiscountSettings);

// Update discount settings
router.put("/", discountSettingsController.updateDiscountSettings);

module.exports = router;
