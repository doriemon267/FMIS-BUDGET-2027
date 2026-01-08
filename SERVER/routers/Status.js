const { getStatus, getStatusById } = require('../controllers/StatusController');
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const statusRouter = Router();
// Apply authentication middleware to all routes in this router
statusRouter.use(checkToken);
statusRouter.get('/status', getStatus);
statusRouter.get('/byidstatus/:id', getStatusById);
module.exports = statusRouter;