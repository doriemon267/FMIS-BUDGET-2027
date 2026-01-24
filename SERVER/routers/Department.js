const { getAllDepartment, getDepartmentById } = require('../controllers/DepartmentController');
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');


const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const departmentRouter = Router();
// Apply authentication middleware to all routes in this router
departmentRouter.use(tokenMiddleware);
departmentRouter.get('/departments', getAllDepartment);
departmentRouter.get('/departments/:id', getDepartmentById);
module.exports = departmentRouter;