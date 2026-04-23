const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * LOGIN CONTROLLER
 * Ginagamit kung kailangan ng direktang login sa Budget System.
 * Naka-sync ang payload format sa Shared Middleware.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Hanapin ang user sa database
    const user = await User.findOne({ email });

    if (!user || !(await user.isValidPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    /**
     * 1. JWT PAYLOAD
     * Sinisiguro natin na kompleto ang fields para sa formatting ng Particular Name
     * at para mabasa ng kahit anong system (Budget/Cash/Accounting).
     */
    const payload = {
      userId: user.userId,
      id: user.userId, // fallback para sa ibang middleware logic
      Username: [user.userId, user.email], // support para sa email picker helper
      FirstName: user.firstName || user.name?.split(' ')[0] || "", 
      LastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || "",
      MiddleName: user.middleName || "",
      Suffix: user.suffix || "",
      email: user.email,
      roles: user.roles || []
    };

    /**
     * 2. SECRET KEY & SIGNING
     * Gumagamit ng shared secret para sa Single Sign-On (SSO) feel.
     */
    const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    /**
     * 3. COOKIE SETTINGS
     * Naka-set sa 'jwt' para standard sa lahat ng satellite systems.
     */
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    };

    if (process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    // Isend ang cookie sa browser
    res.cookie('jwt', token, cookieOptions);

    // Response sa frontend
    res.json({
      ok: true,
      user: { 
        id: user.userId, 
        name: user.name, 
        email: user.email, 
        roles: user.roles 
      },
      token // optional: para sa non-browser clients (like mobile/insomnia)
    });

  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET USER CONTROLLER
 * Kumukuha ng data mula sa req.user (na in-attach ng sharedAuthMiddleware).
 */
const getUser = (req, res) => {
  // Kung nakarating dito, ibig sabihin verified na ng middleware ang token
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated or session expired' });
  }

  res.json({
    ok: true,
    user: req.user, // Kompleto na ito (may particular name, Roles, etc.)
    token: req.jwtToken || req.authToken // Galing din sa middleware
  });
};

/**
 * LOGOUT CONTROLLER
 * Nililinis ang lahat ng posibleng auth cookies.
 */
const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
  };

  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  // I-clear ang lahat ng common cookie names para sigurado
  res.clearCookie('jwt', cookieOptions);
  res.clearCookie('jwtToken', cookieOptions);
  res.clearCookie('authToken', cookieOptions);

  res.json({ ok: true, message: "Logged out successfully" });
};

module.exports = { login, getUser, logout };
