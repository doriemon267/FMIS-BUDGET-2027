const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");


const discountSettingsController = require("../controllers/discountSettingsController");
// Get discount settings

router.use(authMiddleware);
router.get("/", discountSettingsController.getDiscountSettings);
// Update discount settings
router.put("/", discountSettingsController.updateDiscountSettings);
module.exports = router;
