const mongoose = require('mongoose');

/**
 * Auto-compute salary rate based on SG, JG, and Step
 * @param {number} sg - Salary Grade
 * @param {string} jg - Job Grade
 * @param {number} step - Step
 * @returns {Promise<number|null>} Computed rate or null if not found
 */
const computeSalaryRate = async (sg, jg, step) => {
  try {
    // First try to get rate by SG and step (most common scenario)
    if (sg && step) {
      const SalaryGrade = mongoose.model('SalaryGrade');
      const salaryGrade = await SalaryGrade.findOne({ salary_grade: sg });

      if (salaryGrade && salaryGrade.rates && salaryGrade.rates.get(step)) {
        return salaryGrade.rates.get(step);
      }
    }

    // Fallback: try to get rate by JG and step
    if (jg && step) {
      const SalaryGrade = mongoose.model('SalaryGrade');
      const rateData = await SalaryGrade.findOne({ job_grade: jg });

      if (rateData && rateData.rates && rateData.rates.get(step)) {
        return rateData.rates.get(step);
      }
    }

    return null;
  } catch (error) {
    console.error('Error computing salary rate:', error);
    return null;
  }
};

/**
 * Validate and prepare employee record for import
 * @param {Object} record - Raw employee record from Excel
 * @param {string} activeRegion - Active region name
 * @param {string} fiscalYear - Active fiscal year
 * @param {string} processBy - User who is processing
 * @param {Object} userAccess - User's hierarchical access information
 * @param {string} userAccess.scope - User's access scope (FULL, REGION, DEPARTMENT, DIVISION, SECTION)
 * @param {Array} userAccess.accessibleDepartments - List of accessible departments
 * @param {Array} userAccess.accessibleDivisions - List of accessible divisions
 * @param {Array} userAccess.accessibleSections - List of accessible sections
 * @returns {Promise<Object>} Validated and processed record
 */
const validateAndProcessEmployeeRecord = async (record, activeRegion, fiscalYear, processBy, userAccess = {}) => {
  const errors = [];
  const warnings = [];

  // Required fields validation
  const requiredFields = [
    'EmployeeID',
    'EmployeeFullName',
    'Region',
    'Department',
    'PositionTitle',
    'StatusOfAppointment',
    'DateOfAppointment',
    'Status',
    'SG',
    'JG',
    'Step'
  ];

  for (const field of requiredFields) {
    if (!record[field] && record[field] !== 0) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate EmployeeID format
  if (record.EmployeeID && !/^[A-Za-z0-9-]+$/.test(record.EmployeeID.toString())) {
    errors.push('EmployeeID can only contain letters, numbers, and hyphens');
  }

  // Validate region matches active region
  if (record.Region && record.Region.toString().toLowerCase() !== activeRegion.toLowerCase()) {
    errors.push(`Region mismatch: ${record.Region} does not match active region ${activeRegion}`);
  }

  // Validate hierarchical access permissions
  const { scope = 'REGION', accessibleDepartments = [], accessibleDivisions = [], accessibleSections = [] } = userAccess;

  if (scope === 'DEPARTMENT' && accessibleDepartments.length > 0) {
    const deptNames = accessibleDepartments
      .filter(d => d && (d.departmentName || d))
      .map(d => d.departmentName || d);
    if (record.Department && !deptNames.includes(record.Department)) {
      errors.push(`Access denied: Department "${record.Department}" is not in your accessible departments: ${deptNames.join(', ')}`);
    }
  }

  if (scope === 'DIVISION' && accessibleDivisions.length > 0) {
    const divNames = accessibleDivisions
      .filter(d => d && (d.divisionName || d))
      .map(d => d.divisionName || d);
    if (record.Division && !divNames.includes(record.Division)) {
      errors.push(`Access denied: Division "${record.Division}" is not in your accessible divisions: ${divNames.join(', ')}`);
    }
  }

  if (scope === 'SECTION' && accessibleSections.length > 0) {
    const sectNames = accessibleSections
      .filter(s => s && (s.sectionName || s))
      .map(s => s.sectionName || s);
    if (record.Section && !sectNames.includes(record.Section)) {
      errors.push(`Access denied: Section "${record.Section}" is not in your accessible sections: ${sectNames.join(', ')}`);
    }
  }

  // Validate Status
  if (record.Status && !['Active', 'Inactive'].includes(record.Status)) {
    errors.push('Status must be either "Active" or "Inactive"');
  }

  // Process dates
  if (record.DateOfAppointment) {
    if (typeof record.DateOfAppointment === 'number') {
      // Excel serial number to JavaScript Date
      record.DateOfAppointment = new Date(Math.round((record.DateOfAppointment - 25569) * 86400 * 1000));
    } else if (typeof record.DateOfAppointment === 'string') {
      record.DateOfAppointment = new Date(record.DateOfAppointment);
    }
  } else {
    record.DateOfAppointment = new Date();
  }

  if (record.DateOfBirth) {
    if (typeof record.DateOfBirth === 'number') {
      record.DateOfBirth = new Date(Math.round((record.DateOfBirth - 25569) * 86400 * 1000));
    } else if (typeof record.DateOfBirth === 'string') {
      record.DateOfBirth = new Date(record.DateOfBirth);
    }

    // Validate age
    if (record.DateOfBirth instanceof Date && !isNaN(record.DateOfBirth)) {
      const today = new Date();
      const age = today.getFullYear() - record.DateOfBirth.getFullYear();
      if (age < 16) {
        errors.push('Employee must be at least 16 years old');
      }
      if (age > 100) {
        errors.push('Please enter a valid birth date');
      }
    }
  }

  // Auto-compute or validate Rate
  let computedRate = null;
  if (record.SG && record.Step) {
    computedRate = await computeSalaryRate(record.SG, record.JG, record.Step);

    if (computedRate) {
      if (record.Rate) {
        // If rate is provided, validate it matches computed value
        const providedRate = parseFloat(record.Rate);
        const tolerance = 0.01; // Allow small tolerance for rounding differences

        if (Math.abs(providedRate - computedRate) > tolerance) {
          warnings.push(`Provided rate (${providedRate}) differs from computed rate (${computedRate}). Using computed value.`);
        }
        record.Rate = computedRate;
      } else {
        // Auto-compute the rate
        record.Rate = computedRate;
      }
    } else {
      if (!record.Rate) {
        errors.push(`Could not compute salary rate for SG:${record.SG}, JG:${record.JG}, Step:${record.Step}. Please provide Rate manually.`);
      } else {
        warnings.push(`Could not compute salary rate for SG:${record.SG}, JG:${record.JG}, Step:${record.Step}. Using provided rate: ${record.Rate}`);
      }
    }
  } else if (!record.Rate) {
    errors.push('Rate is required. Please provide SG and Step for auto-computation, or provide Rate directly.');
  }

  // Set default values
  record.Region = record.Region || activeRegion;
  record.fiscalYear = fiscalYear;
  record.processBy = processBy || "ADMIN";
  record.employeeStatus = record.Status || 'Active'; // Map Status to employeeStatus field

  return {
    record,
    errors,
    warnings,
    isValid: errors.length === 0
  };
};

module.exports = {
  computeSalaryRate,
  validateAndProcessEmployeeRecord
};