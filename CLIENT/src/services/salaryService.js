import api from '../config/api';

/**
 * Service for Salary Management operations
 */

// ==================== CPSC Template Management ====================

/**
 * Get all CPSC templates
 * @returns {Promise} API response with templates
 */
export const getCPSCTemplates = async () => {
  const response = await api.get('/cpsc-templates');
  return response.data;
};

/**
 * Get CPSC template by ID
 * @param {string} id - Template ID
 * @returns {Promise} API response with template
 */
export const getCPSCTemplateById = async (id) => {
  const response = await api.get(`/cpsc-templates/${id}`);
  return response.data;
};

/**
 * Create new CPSC template
 * @param {Object} templateData - Template data
 * @returns {Promise} API response with created template
 */
export const createCPSCTemplate = async (templateData) => {
  const response = await api.post('/cpsc-templates', templateData);
  return response.data;
};

/**
 * Update CPSC template
 * @param {string} id - Template ID
 * @param {Object} templateData - Updated template data
 * @returns {Promise} API response with updated template
 */
export const updateCPSCTemplate = async (id, templateData) => {
  const response = await api.put(`/cpsc-templates/${id}`, templateData);
  return response.data;
};

/**
 * Delete CPSC template
 * @param {string} id - Template ID
 * @returns {Promise} API response
 */
export const deleteCPSCTemplate = async (id) => {
  const response = await api.delete(`/cpsc-templates/${id}`);
  return response.data;
};

// ==================== Template-based Salary Operations ====================

/**
 * Get salary grades by CPSC template
 * @param {string} templateId - Template ID
 * @returns {Promise} API response with salary grades
 */
export const getSalaryGradesByTemplate = async (templateId) => {
  const response = await api.get(`/salary-grades/template/${templateId}`);
  return response.data;
};

/**
 * Get salary grades by fiscal year and budget type
 * @param {number} fiscalYear - Fiscal year
 * @param {string} budgetType - Budget type (Initial, NEP, GAA)
 * @returns {Promise} API response with salary grades
 */
export const getSalaryGradesByFiscalYearAndBudgetType = async (fiscalYear, budgetType) => {
  const response = await api.get(`/salary-grades/fiscal-year/${fiscalYear}/budget-type/${budgetType}`);
  return response.data;
};

/**
 * Get active salary grades for fiscal year and budget type
 * @param {number} fiscalYear - Fiscal year
 * @param {string} budgetType - Budget type
 * @returns {Promise} API response with active salary grades
 */
export const getActiveSalaryGrades = async (fiscalYear, budgetType) => {
  const response = await api.get(`/salary-grades/active/${fiscalYear}/${budgetType}`);
  return response.data;
};

/**
 * Create salary grade with template association
 * @param {Object} salaryGradeData - Salary grade data
 * @returns {Promise} API response with created salary grade
 */
export const createSalaryGradeWithTemplate = async (salaryGradeData) => {
  const response = await api.post('/salary-grades/with-template', salaryGradeData);
  return response.data;
};

/**
 * Update salary grade
 * @param {string} id - Salary grade ID
 * @param {Object} salaryGradeData - Updated salary grade data
 * @returns {Promise} API response with updated salary grade
 */
export const updateSalaryGrade = async (id, salaryGradeData) => {
  const response = await api.put(`/salary-grades/${id}`, salaryGradeData);
  return response.data;
};

/**
 * Delete salary grade
 * @param {string} id - Salary grade ID
 * @returns {Promise} API response
 */
export const deleteSalaryGrade = async (id) => {
  const response = await api.delete(`/salary-grades/${id}`);
  return response.data;
};

// ==================== Legacy Salary Operations ====================

/**
 * Get all salary grades (legacy)
 * @param {string} search - Search query
 * @returns {Promise} API response with salary grades
 */
export const getSalaryGrades = async (search = '') => {
  const response = await api.get('/salary-grades', {
    params: { salary_grade: search }
  });
  return response.data;
};

/**
 * Get job grades by salary grade
 * @param {string} salaryGrade - Salary grade
 * @returns {Promise} API response with job grade
 */
export const getJobGrades = async (salaryGrade) => {
  const response = await api.get(`/job-grades/${salaryGrade}`);
  return response.data;
};

/**
 * Get steps by job grade
 * @param {string} jobGrade - Job grade
 * @returns {Promise} API response with steps
 */
export const getSteps = async (jobGrade) => {
  const response = await api.get(`/steps/${jobGrade}`);
  return response.data;
};

/**
 * Get rate by job grade and step
 * @param {string} jobGrade - Job grade
 * @param {string} step - Step
 * @returns {Promise} API response with rate
 */
export const getRate = async (jobGrade, step) => {
  const response = await api.get(`/rate/${jobGrade}/${step}`);
  return response.data;
};

/**
 * Get rate by job grade and step (casual)
 * @param {string} jobGrade - Job grade
 * @param {string} step - Step
 * @returns {Promise} API response with rate
 */
export const getRateByJobGradeAndStep = async (jobGrade, step) => {
  const response = await api.get(`/rate-by-job-grade-and-step/${jobGrade}/${step}`);
  return response.data;
};