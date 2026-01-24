const { getStatus, getStatusById } = require('../controllers/StatusController');
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const statusRouter = Router();
// Apply authentication middleware to all routes in this router
statusRouter.use(tokenMiddleware);
statusRouter.get('/status', getStatus);
statusRouter.get('/byidstatus/:id', getStatusById);
module.exports = statusRouter;