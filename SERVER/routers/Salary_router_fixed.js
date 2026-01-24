const express = require('express');
const salaryRouter = express.Router();
// 🔒 SECURITY: Import authentication middleware - CRITICAL FOR SALARY DATA!
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const salaryController = require('../controllers/salaryController');
// Apply authentication middleware to all routes in this router
salaryRouter.use(tokenMiddleware);
// 🔒 ALL SALARY DATA ACCESS REQUIRES AUTHENTICATION
salaryRouter.get('/salary-grades', salaryController.getSalaryGrades);
salaryRouter.get('/job-grades/:salary_grade', salaryController.getJobGrades);
salaryRouter.get('/steps/:job_grade', salaryController.getSteps);
salaryRouter.get('/rate/:job_grade/:step', salaryController.getRate);
salaryRouter.get('/rate-by-job-grade-and-step/:job_grade/:step', salaryController.getRateByJobGradeAndStep);
module.exports = salaryRouter;
