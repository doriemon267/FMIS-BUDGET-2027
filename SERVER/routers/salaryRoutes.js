const express = require('express');
const salaryRouter = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');

const salaryController = require('../controllers/salaryController');

// Apply authentication to all salary routes
salaryRouter.use(isAuth);

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
salaryRouter.post('/cpsc-templates', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.createCPSCTemplate);
salaryRouter.put('/cpsc-templates/:id', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.updateCPSCTemplate);
salaryRouter.delete('/cpsc-templates/:id', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.deleteCPSCTemplate);

// ==================== Template-based Salary Operations ====================
salaryRouter.get('/salary-grades/template/:templateId', salaryController.getSalaryGradesByTemplate);
salaryRouter.get('/salary-grades/fiscal-year/:fiscalYear/budget-type/:budgetType', salaryController.getSalaryGradesByFiscalYearAndBudgetType);
salaryRouter.get('/salary-grades/active/:fiscalYear/:budgetType', salaryController.getActiveSalaryGrades);
salaryRouter.post('/salary-grades/with-template', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.createSalaryGradeWithTemplate);
salaryRouter.put('/salary-grades/:id', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.updateSalaryGrade);
salaryRouter.delete('/salary-grades/:id', requireDynamicPermission(['/salary-table', '/cos-salary-table']), salaryController.deleteSalaryGrade);

module.exports = salaryRouter;
