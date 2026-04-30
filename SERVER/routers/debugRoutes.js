const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");


// Dev-only route to inspect authentication / identity for debugging
router.get('/whoami', authMiddleware, (req, res) => {
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
