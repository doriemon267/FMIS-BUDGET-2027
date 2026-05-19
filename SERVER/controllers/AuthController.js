const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.isValidPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Eto ang payload na kailangang-kailangan ng middleware mo:
    const payload = {
      userId: user.userId,
      email: user.email,
      FirstName: user.firstName || "",
      LastName: user.lastName || "",
      MiddleName: user.middleName || "",
      Suffix: user.suffix || "",
      roles: user.roles || []
    };

    const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
    const token = jwt.sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 60 * 60 * 1000,
      path: '/',
    };
    if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;

    res.cookie('jwt', token, cookieOptions);

    res.json({ ok: true, user: { id: user.userId, name: user.name, roles: user.roles } });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUser = (req, res) => {
  // Gagamit ng req.user na galing sa UNIFIED AUTH MIDDLEWARE
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  res.json({ 
    ok: true, 
    user: req.user, // Dito lalabas yung 'particular' name (Full Name) na binuo ng middleware
    token: req.authToken 
  });
};

exports.logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production' || 
                 (process.env.PRODUCTION_MODE && String(process.env.PRODUCTION_MODE).trim().length > 0);
                 
  const options = { 
    path: '/', 
    httpOnly: true, 
    secure: isProd, 
    sameSite: isProd ? 'None' : 'Lax' 
  };
  
  if (process.env.COOKIE_DOMAIN) options.domain = process.env.COOKIE_DOMAIN;

  // I-clear lahat ng posibleng cookies na hinahanap ng unified middleware mo
  res.clearCookie('jwt', options);
  res.clearCookie('jwtToken', options);
  res.clearCookie('authToken', options);
  
  res.json({ ok: true, message: "Logged out successfully" });
};
