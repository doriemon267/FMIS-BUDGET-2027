const { getStatus, getStatusById } = require('../controllers/StatusController');
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const statusRouter = Router();
// Apply authentication middleware to all routes in this router
statusRouter.use(authMiddleware);
statusRouter.get('/status', getStatus);
statusRouter.get('/byidstatus/:id', getStatusById);
module.exports = statusRouter;