const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const {
  getTierData,
  saveTierData,
  generateTierPDF,
} = require('../controllers/tierController');

router.use(checkToken);

router.get('/tier/data', getTierData);
router.post('/tier/data', saveTierData);
router.post('/tier/generate-pdf', generateTierPDF);

module.exports = router;
