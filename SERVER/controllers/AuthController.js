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
  res.json({ token });
};

module.exports = { login };
