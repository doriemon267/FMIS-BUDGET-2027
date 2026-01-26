const express = require("express");
const router = express.Router();

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


const discountSettingsController = require("../controllers/discountSettingsController");
// Get discount settings

router.use(tokenMiddleware);
router.get("/", discountSettingsController.getDiscountSettings);
// Update discount settings
router.put("/", discountSettingsController.updateDiscountSettings);
module.exports = router;
