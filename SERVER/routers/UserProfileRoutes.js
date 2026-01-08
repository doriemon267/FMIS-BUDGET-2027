const { getCurrentUserProfile } = require('../controllers/UserProfileController');
const Router = require('express').Router;
const checkToken = require('../middleware/check_token');
const userProfileRouter = Router();
// Get current user's complete profile including region assignments
userProfileRouter.get('/user-profile', checkToken, getCurrentUserProfile);
module.exports = userProfileRouter;
