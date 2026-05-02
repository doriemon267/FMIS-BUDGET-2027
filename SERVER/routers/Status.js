const { getStatus, getStatusById } = require('../controllers/StatusController');
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const statusRouter = Router();
// Apply authentication middleware to all routes in this router
statusRouter.use(isAuth);
statusRouter.get('/status', getStatus);
statusRouter.get('/byidstatus/:id', getStatusById);
module.exports = statusRouter;
