const mongoose = require('mongoose');
// Ensure CPCS models are registered when this module is used (e.g. bulk upload)
require('../models/CPCSSalarySettings');
require('../models/CPCSSalaryTable');
require('../models/FourthTrancheCosTable');

/**
 * Compute salary rate. COS: Fourth-Tranche PDF table. PERMANENT/CASUAL: CPCS II / SalarySelection.
 */
const computeSalaryRateFromCPCS = async (sg, jg, step, statusOfAppointment, employeeStatus, settings) => {
  try {
    const stepNum = parseInt(step, 10);
    if (!stepNum || stepNum < 1 || stepNum > 8) return null;

    const appointment = (statusOfAppointment || '').toString().toUpperCase();
    const cosUsesTable = settings && (settings.cosUsesCPCSIIRate !== false) && settings.useCPCSForEmployeeAdd;

    // COS: uses Fourth-Tranche PDF table (Jan 1 2019) — Salary Grade + Step
    if (appointment === 'COS' && cosUsesTable && sg && stepNum) {
      const FourthTrancheCosTable = mongoose.model('FourthTrancheCosTable');
      const row = await FourthTrancheCosTable.findOne({ salaryGrade: parseInt(sg, 10) }).lean();
      if (row && row[`step${stepNum}`] != null) return row[`step${stepNum}`];
    }

    return null;
  } catch (error) {
    console.error('Error computing salary rate from CPCS II Rate:', error);
    return null;
  }
};

/**
 * Auto-compute salary rate.
 * COS: SSL4 table (hiwalay). PERMANENT at CASUAL: shared SalarySelection table.
 * @param {number} sg - Salary Grade
 * @param {string} jg - Job Grade
 * @param {number} step - Step
 * @param {string} statusOfAppointment - Employment status (PERMANENT, CASUAL, COS)
 * @param {string} [employeeStatus] - Active | Inactive (for CPCS: inactive may use CPCS 1)
 * @returns {Promise<number|null>} Computed rate or null if not found
 */
const computeSalaryRate = async (sg, jg, step, statusOfAppointment, employeeStatus) => {
  try {
    const CPCSSalarySettings = mongoose.model('CPCSSalarySettings');
    const settings = await CPCSSalarySettings.findOne().lean();
    if (settings && settings.useCPCSForEmployeeAdd) {
      const rate = await computeSalaryRateFromCPCS(sg, jg, step, statusOfAppointment, employeeStatus, settings);
      if (rate != null) return rate;
    }

    const status = statusOfAppointment ? statusOfAppointment.toString().toUpperCase() : '';
    const cpcs1Types = (settings && settings.cpcs1AppointmentTypes) || ['CASUAL'];
    const cpcs2Types = (settings && settings.cpcs2AppointmentTypes) || ['PERMANENT'];
    const useCPCS2 = cpcs2Types.includes(status);
    const useCPCS1 = cpcs1Types.includes(status);

    // CPCS 2 (Salary Grade + Step): PERMANENT or CASUAL when assigned to CPCS 2
    if (useCPCS2 && sg && step) {
      const SalaryGrade = mongoose.model('SalaryGrade');
      const salaryGrade = await SalaryGrade.findOne({ salary_grade: sg.toString() });
      if (salaryGrade && salaryGrade.rates && salaryGrade.rates.get(step.toString())) {
        return salaryGrade.rates.get(step.toString());
      }
    }

    // CPCS 1 (Job Grade + Step): CASUAL or PERMANENT when assigned to CPCS 1
    if (useCPCS1 && jg && step) {
      const SalaryGrade = mongoose.model('SalaryGrade');
      const cleanJG = jg.toString().replace(/^JG-?/i, '');
      const rateData = await SalaryGrade.findOne({ job_grade: cleanJG });
      if (rateData && rateData.rates && rateData.rates.get(step.toString())) {
        return rateData.rates.get(step.toString());
      }
    }

    // For COS employees: don't auto-compute (manual entry) when not using CPCS
    if (status === 'COS') {
      return null;
    }

    // Fallback
    if (sg && step) {
      const SalaryGrade = mongoose.model('SalaryGrade');
      const salaryGrade = await SalaryGrade.findOne({ salary_grade: sg.toString() });
      if (salaryGrade && salaryGrade.rates && salaryGrade.rates.get(step.toString())) {
        return salaryGrade.rates.get(step.toString());
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

  // Required fields validation - make SG/JG/Step conditional based on appointment type
  const baseRequiredFields = [
    'EmployeeID',
    'EmployeeFullName',
    'Region',
    'Department',
    'PositionTitle',
    'StatusOfAppointment',
    'DateOfAppointment',
    'Status'
  ];

  // For COS (Contract of Service) employees, SG/JG/Step are not required since rates are not auto-computed
  const salaryGradeFields = ['SG', 'JG', 'Step'];
  const isCOS = record.StatusOfAppointment && record.StatusOfAppointment.toString().toUpperCase() === 'COS';

  // Special handling for VACANT positions
  const isVacant = record.EmployeeFullName && record.EmployeeFullName.toString().toUpperCase() === 'VACANT';

  // For VACANT positions, only basic fields are required
  const vacantRequiredFields = [
    'EmployeeFullName',
    'Region',
    'Department',
    'PositionTitle',
    'StatusOfAppointment'
  ];

  const requiredFields = isVacant ? vacantRequiredFields :
                         (isCOS ? baseRequiredFields : [...baseRequiredFields, ...salaryGradeFields]);

  for (const field of requiredFields) {
    if (!record[field] && record[field] !== 0) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Additional validation for salary grade fields when they are provided (even for COS)
  // Skip salary grade validation for VACANT positions
  if (!isCOS && !isVacant && record.SG && record.JG && record.Step) {
    // Validate SG is a number
    if (isNaN(parseInt(record.SG))) {
      errors.push('SG must be a valid number');
    }

    // Validate Step is a number
    if (isNaN(parseInt(record.Step))) {
      errors.push('Step must be a valid number');
    }

    // Validate JG format - accept multiple formats
    if (record.JG) {
      const jgValue = record.JG.toString().trim();
      // Accept formats: JG-15, JG 15, JG15, or just 15
      if (!/^JG[-\s]?\d+$/.test(jgValue) && !/^\d+$/.test(jgValue)) {
        errors.push('JG must be in format "JG-X", "JG X", "JGX", or just a number (e.g., "JG-15", "JG 15", "JG15", or "15")');
      }
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

  // Validate Status (skip for VACANT positions as they don't have status)
  if (!isVacant && record.Status && !['Active', 'Inactive'].includes(record.Status)) {
    errors.push('Status must be either "Active" or "Inactive"');
  }

  // Process EmployeeFullName - handle cases where Excel parsed it as a date/number
  if (record.EmployeeFullName) {
    if (typeof record.EmployeeFullName === 'number') {
      // If it's a number, it might be an Excel date serial - try to convert back to string
      // But for names, this usually means the cell was formatted as date but contains text
      errors.push('EmployeeFullName appears to be formatted as a date in Excel. Please format the column as "Text"');
    } else if (record.EmployeeFullName instanceof Date) {
      // If it's a Date object, convert to string
      record.EmployeeFullName = record.EmployeeFullName.toISOString().split('T')[0];
    }
  }

  // Process dates
  if (record.DateOfAppointment) {
    if (typeof record.DateOfAppointment === 'number') {
      // Excel serial number to JavaScript Date
      record.DateOfAppointment = new Date(Math.round((record.DateOfAppointment - 25569) * 86400 * 1000));
    } else if (typeof record.DateOfAppointment === 'string') {
      // Handle various date string formats
      const dateStr = record.DateOfAppointment.trim();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        record.DateOfAppointment = new Date(dateStr);
      } else {
        record.DateOfAppointment = new Date(dateStr);
      }
    }

    if (!(record.DateOfAppointment instanceof Date) || isNaN(record.DateOfAppointment)) {
      errors.push('DateOfAppointment must be a valid date');
    }
  } else {
    record.DateOfAppointment = new Date();
  }

  if (record.DateOfBirth) {
    if (typeof record.DateOfBirth === 'number') {
      record.DateOfBirth = new Date(Math.round((record.DateOfBirth - 25569) * 86400 * 1000));
    } else if (typeof record.DateOfBirth === 'string') {
      const dateStr = record.DateOfBirth.trim();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        record.DateOfBirth = new Date(dateStr);
      } else {
        record.DateOfBirth = new Date(dateStr);
      }
    }

    if (!(record.DateOfBirth instanceof Date) || isNaN(record.DateOfBirth)) {
      errors.push('DateOfBirth must be a valid date');
    } else {
      // Validate age (skip for VACANT positions)
      if (!isVacant) {
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
  }

  // Auto-compute or validate Rate
  let computedRate = null;
  if (!isCOS && record.SG && record.Step) {
    computedRate = await computeSalaryRate(
      record.SG,
      record.JG,
      record.Step,
      record.StatusOfAppointment,
      record.Status
    );

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
  } else if (!isCOS && !record.Rate) {
    errors.push('Rate is required for non-COS employees. Please provide SG and Step for auto-computation, or provide Rate directly.');
  }

  // Normalize JG format to standard "JG-X" format
  if (record.JG && typeof record.JG === 'string') {
    const jgValue = record.JG.trim();
    // Convert various formats to "JG-X" format
    if (/^JG[-\s]?(\d+)$/.test(jgValue)) {
      // Already in JG-X or JG X format, normalize to JG-X
      const match = jgValue.match(/^JG[-\s]?(\d+)$/);
      record.JG = `JG-${match[1]}`;
    } else if (/^\d+$/.test(jgValue)) {
      // Just a number, convert to JG-X format
      record.JG = `JG-${jgValue}`;
    }
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
  computeSalaryRateFromCPCS,
  validateAndProcessEmployeeRecord
};