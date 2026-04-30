const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


// Dev-only route to inspect authentication / identity for debugging
router.get('/whoami', tokenMiddleware, (req, res) => {
  try {
    const payload = {
      user: req.user || null,
      identity: req.identity || null,
      headers: {
        authorization: req.headers.authorization,
        'x-dev-user-id': req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id']
      }
    };
    res.json({ success: true, payload });
  } catch (err) {
    console.error('[Debug] whoami error', err.stack || err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
