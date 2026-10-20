const express = require('express');
const salaryRouter = express.Router();
const isAuth = require('../middleware/is_auth');

const salaryController = require('../controllers/salaryController');
// Apply authentication to all salary routes
salaryRouter.use(isAuth);
salaryRouter.get('/salary-grades', salaryController.getSalaryGrades);
salaryRouter.get('/job-grades/:salary_grade', salaryController.getJobGrades);
salaryRouter.get('/steps/:job_grade', salaryController.getSteps);
salaryRouter.get('/rate/:job_grade/:step', salaryController.getRate);
salaryRouter.get('/rate-by-job-grade-and-step/:job_grade/:step', salaryController.getRateByJobGradeAndStep);
module.exports = salaryRouter;

