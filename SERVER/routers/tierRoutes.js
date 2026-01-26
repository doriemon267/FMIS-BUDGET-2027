const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getTierData,
  saveTierData,
  generateTierPDF,
} = require('../controllers/tierController');

router.use(tokenMiddleware);

router.get('/tier/data', getTierData);
router.post('/tier/data', saveTierData);
router.post('/tier/generate-pdf', generateTierPDF);

module.exports = router;
