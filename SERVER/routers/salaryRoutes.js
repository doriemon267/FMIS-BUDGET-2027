const express = require('express');
const salaryRouter = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const salaryController = require('../controllers/salaryController');

// Apply authentication to all salary routes
salaryRouter.use(tokenMiddleware);

// ==================== Existing Salary Routes ====================
salaryRouter.get('/salary-grades/table', salaryController.getSalaryTableList);
salaryRouter.get('/salary-grades', salaryController.getSalaryGrades);
salaryRouter.get('/job-grades/:salary_grade', salaryController.getJobGrades);
salaryRouter.get('/steps/:job_grade', salaryController.getSteps);
salaryRouter.get('/rate/:job_grade/:step', salaryController.getRate);
salaryRouter.get('/rate-by-job-grade-and-step/:job_grade/:step', salaryController.getRateByJobGradeAndStep);

// ==================== CPSC Template Management Routes ====================
salaryRouter.get('/cpsc-templates', salaryController.getCPSCTemplates);
salaryRouter.get('/cpsc-templates/:id', salaryController.getCPSCTemplateById);
salaryRouter.post('/cpsc-templates', salaryController.createCPSCTemplate);
salaryRouter.put('/cpsc-templates/:id', salaryController.updateCPSCTemplate);
salaryRouter.delete('/cpsc-templates/:id', salaryController.deleteCPSCTemplate);

// ==================== Template-based Salary Operations ====================
salaryRouter.get('/salary-grades/template/:templateId', salaryController.getSalaryGradesByTemplate);
salaryRouter.get('/salary-grades/fiscal-year/:fiscalYear/budget-type/:budgetType', salaryController.getSalaryGradesByFiscalYearAndBudgetType);
salaryRouter.get('/salary-grades/active/:fiscalYear/:budgetType', salaryController.getActiveSalaryGrades);
salaryRouter.post('/salary-grades/with-template', salaryController.createSalaryGradeWithTemplate);
salaryRouter.put('/salary-grades/:id', salaryController.updateSalaryGrade);
salaryRouter.delete('/salary-grades/:id', salaryController.deleteSalaryGrade);

module.exports = salaryRouter;
