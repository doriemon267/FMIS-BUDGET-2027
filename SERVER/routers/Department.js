const { getAllDepartment, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/DepartmentController');
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");



const departmentRouter = Router();
// Apply authentication middleware to all routes in this router
departmentRouter.use(authMiddleware);
departmentRouter.get('/departments', getAllDepartment);
departmentRouter.get('/departments/:id', getDepartmentById);
departmentRouter.post('/departments', createDepartment);
departmentRouter.put('/departments/:id', updateDepartment);
departmentRouter.delete('/departments/:id', deleteDepartment);
module.exports = departmentRouter;