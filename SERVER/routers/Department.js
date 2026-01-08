const { getAllDepartment, getDepartmentById } = require('../controllers/DepartmentController');
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const departmentRouter = Router();
// Apply authentication middleware to all routes in this router
departmentRouter.use(checkToken);
departmentRouter.get('/departments', getAllDepartment);
departmentRouter.get('/departments/:id', getDepartmentById);
module.exports = departmentRouter;