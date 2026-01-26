const { getCurrentUserProfile } = require('../controllers/UserProfileController');
const Router = require('express').Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const userProfileRouter = Router();
// Get current user's complete profile including region assignments
userProfileRouter.get('/user-profile', tokenMiddleware, getCurrentUserProfile);
module.exports = userProfileRouter;
