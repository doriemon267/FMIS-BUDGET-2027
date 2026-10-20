const { getAllDepartment, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const departmentRouter = Router();
// Apply authentication middleware to all routes in this router
departmentRouter.use(isAuth);
departmentRouter.get('/departments', getAllDepartment);
departmentRouter.get('/departments/:id', getDepartmentById);
departmentRouter.post('/departments', createDepartment);
departmentRouter.put('/departments/:id', updateDepartment);
departmentRouter.delete('/departments/:id', deleteDepartment);
module.exports = departmentRouter;
