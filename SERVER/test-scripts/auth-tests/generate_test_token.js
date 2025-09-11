const jwt = require('jsonwebtoken');
// Load environment variables
require('dotenv').config();
const payload = {
  userId: "909549",  // Your actual correct user ID
  name: "Reymund Edra",  
  email: "mund.m.edra@gmail.com",
  roles: ["SUPER ADMIN"],
  accessToken: "mock-access-token"
};
const secret = process.env.JWT_SECRET_KEY;
const token = jwt.sign(payload, secret, { expiresIn: '1h' });