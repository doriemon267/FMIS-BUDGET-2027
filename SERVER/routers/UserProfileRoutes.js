const { getCurrentUserProfile } = require('../controllers/UserProfileController');
const Router = require('express').Router;
const authMiddleware = require("../middleware/authMiddleware");

const userProfileRouter = Router();
// Get current user's complete profile including region assignments
userProfileRouter.get('/user-profile', authMiddleware, getCurrentUserProfile);
module.exports = userProfileRouter;
