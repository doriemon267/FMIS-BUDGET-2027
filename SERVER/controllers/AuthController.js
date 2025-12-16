const jwt = require('jsonwebtoken');
const User = require('../models/User'); // adjust path as needed
// Login route/controller
const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.isValidPassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Dynamic payload from user record
  const payload = {
    Username: [user.userId, user.email],
    userId: user.userId,
    name: user.name,
    email: user.email,
    roles: user.roles
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

  // Set token as an httpOnly secure cookie so it's not accessible to JS
  // Use SameSite=None for production so cross-site XHR/fetch from the SPA sends cookies.
  // Keep httpOnly to prevent JS access. Optionally set domain with COOKIE_DOMAIN env var.
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 60 * 60 * 1000, // 1 hour
    path: '/',
  };
  if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
  res.cookie('authToken', token, cookieOptions);

  // Return only non-sensitive user info
  res.json({ ok: true, user: { id: user.userId, name: user.name, email: user.email, roles: user.roles } });
};

// Read user info from cookie or Authorization header
const getUser = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
    if (!token && req.cookies && req.cookies.authToken) token = req.cookies.authToken;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
    // Return user info only
    return res.json({ user: { id: payload.userId || payload.sub || null, name: payload.name, email: payload.email, roles: payload.roles } });
  } catch (err) {
    console.error('getUser error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const logout = (req, res) => {
  // Clear auth cookie using same options used when setting it so the client removes it correctly
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  };
  if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie('authToken', cookieOptions);
  res.json({ ok: true });
};
module.exports = { login, getUser, logout };
