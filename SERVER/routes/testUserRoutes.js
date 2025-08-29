/**
 * 🧪 Test User Routes - For Development/Testing Only
 * 
 * These routes allow you to simulate different users for testing
 * the UserRegionAssignment functionality without needing real JWT tokens
 */

const express = require('express');
const router = express.Router();

// Store current test user (in production, this comes from JWT)
let currentTestUser = {
  id: "909549",
  name: "Test Budget Admin", 
  email: "budgetadmin@example.com",
  Roles: ["BUDGET ADMIN"]
};

/**
 * Get current test user
 */
router.get('/current-user', (req, res) => {
  res.json(currentTestUser);
});

/**
 * Switch to a different test user
 * This simulates logging in as a different user
 */
router.post('/switch-user', (req, res) => {
  const { userId, name, email, roles } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  currentTestUser = {
    id: userId,
    name: name || `Test User ${userId}`,
    email: email || `user${userId}@example.com`,
    Roles: roles || ["USER"]
  };
  
  res.json({ 
    message: `Switched to user ${userId}`, 
    user: currentTestUser 
  });
});

/**
 * Test middleware that injects the current test user
 * Use this in development instead of JWT middleware
 */
const injectTestUser = (req, res, next) => {
  req.user = currentTestUser;
  next();
};

module.exports = { router, injectTestUser, getCurrentTestUser: () => currentTestUser };
