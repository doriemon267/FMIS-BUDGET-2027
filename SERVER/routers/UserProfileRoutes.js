const { getCurrentUserProfile } = require('../controllers/UserProfileController');
const Router = require('express').Router;
const isAuth = require('../middleware/is_auth');

const userProfileRouter = Router();
// Get current user's complete profile including region assignments
userProfileRouter.get('/user-profile', isAuth, getCurrentUserProfile);
module.exports = userProfileRouter;

