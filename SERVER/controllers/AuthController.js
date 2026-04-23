const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.isValidPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // --- 1. PAYLOAD ADJUSTMENT ---
    // Dinagdagan natin ng fields na kailangan ng authMiddleware para sa formatting
    const payload = {
      userId: user.userId,
      id: user.userId, // fallback
      Username: [user.userId, user.email], // para sa pickEmail helper
      FirstName: user.firstName || user.name.split(' ')[0], // siguraduhing may FirstName
      LastName: user.lastName || user.name.split(' ').slice(1).join(' '), 
      email: user.email,
      roles: user.roles || []
    };

    // Siguraduhin na ang secret ay tugma sa middleware (JWT_CLIENT_SECRET_PROD o JWT_SECRET_KEY)
    const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    // --- 2. COOKIE NAME & OPTIONS ---
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    };
    if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;

    // Binago ang name into 'jwt' para tugma sa authMiddleware
    res.cookie('jwt', token, cookieOptions);

    res.json({ 
      ok: true, 
      user: { id: user.userId, name: user.name, email: user.email, roles: user.roles },
      token // optional: para sa mobile/cross-origin apps
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getUser = (req, res) => {
  // Dahil dumaan na ito sa authMiddleware, ang user data ay nasa req.user na!
  // Hindi mo na kailangang mag-jwt.verify ulit dito.
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({ 
    user: req.user, 
    token: req.authToken // Galing din sa middleware
  });
};

const logout = (req, res) => {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  };
  if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
  
  // I-clear ang 'jwt' cookie
  res.clearCookie('jwt', cookieOptions);
  res.json({ ok: true });
};

module.exports = { login, getUser, logout };
