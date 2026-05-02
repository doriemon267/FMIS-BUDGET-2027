const express = require("express");
const router = express.Router();
const isAuth = require('../middleware/is_auth');

const discountSettingsController = require("../controllers/discountSettingsController");
// Get discount settings

router.use(isAuth);
router.get("/", discountSettingsController.getDiscountSettings);
// Update discount settings
router.put("/", discountSettingsController.updateDiscountSettings);
module.exports = router;

