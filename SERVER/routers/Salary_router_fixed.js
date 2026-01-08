const express = require('express');
const salaryRouter = express.Router();
// 🔒 SECURITY: Import authentication middleware - CRITICAL FOR SALARY DATA!
const checkToken = require('../middleware/check_token');
const salaryController = require('../controllers/salaryController');
// 🔒 ALL SALARY DATA ACCESS REQUIRES AUTHENTICATION
salaryRouter.get('/salary-grades', checkToken, salaryController.getSalaryGrades);
salaryRouter.get('/job-grades/:salary_grade', checkToken, salaryController.getJobGrades);
salaryRouter.get('/steps/:job_grade', checkToken, salaryController.getSteps);
salaryRouter.get('/rate/:job_grade/:step', checkToken, salaryController.getRate);
salaryRouter.get('/rate-by-job-grade-and-step/:job_grade/:step', checkToken, salaryController.getRateByJobGradeAndStep);
module.exports = salaryRouter;
