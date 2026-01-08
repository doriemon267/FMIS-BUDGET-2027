const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Dev-only token issuer for testing. Enabled only when ALLOW_MOCK_AUTH=true and not in production.
router.post('/token', (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MOCK_AUTH !== 'true') {
    return res.status(403).json({ error: 'Dev token issuance disabled' });
  }
  const { userId, username, roles } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const payload = { userId, username: username || userId, roles: roles || ['SUPER ADMIN'], id: userId };
  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY || 'dev-secret', { expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
