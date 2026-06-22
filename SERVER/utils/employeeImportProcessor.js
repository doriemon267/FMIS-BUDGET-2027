const mongoose = require('mongoose');
// Ensure CPCS models are registered when this module is used (e.g. bulk upload)
require('../models/CPCSSalarySettings');
require('../models/CPCSSalaryTable');
require('../models/FourthTrancheCosTable');

/**
 * Compute salary rate. COS: Fourth-Tranche PDF table. PERMANENT/CASUAL: CPCSSalaryTable (when useCPCSForEmployeeAdd).
 */
const computeSalaryRateFromCPCS = async (sg, jg, step, statusOfAppointment, employeeStatus, settings) => {
  try {
    const stepNum = parseInt(step, 10);
    if (!stepNum || stepNum < 1 || stepNum > 8) return null;

    const appointment = (statusOfAppointment || '').toString().toUpperCase();
    const CPCSSalaryTable = mongoose.model('CPCSSalaryTable');

    // COS: always use Fourth-Tranche PDF table (cos-salary-table) — Salary Grade + Step
    if (appointment === 'COS' && sg && stepNum) {
      const FourthTrancheCosTable = mongoose.model('FourthTrancheCosTable');
      const row = await FourthTrancheCosTable.findOne({ salaryGrade: parseInt(sg, 10) }).lean();
      if (row && row[`step${stepNum}`] != null) return row[`step${stepNum}`];
    }

    // PERMANENT/CASUAL: use CPCSSalaryTable when useCPCSForEmployeeAdd is true
    const cpcs1Types = (settings && settings.cpcs1AppointmentTypes) || ['CASUAL'];
    const cpcs2Types = (settings && settings.cpcs2AppointmentTypes) || ['PERMANENT'];
    const useCPCS2 = cpcs2Types.includes(appointment);
    const useCPCS1 = cpcs1Types.includes(appointment);

    // CPCS 2 (Salary Grade + Step): find by salaryGrade in CPCSSalaryTable
    if (useCPCS2 && sg && stepNum) {
      const row = await CPCSSalaryTable.findOne({ salaryGrade: parseInt(sg, 10) }).lean();
      if (row && row[`step${stepNum}`] != null) return row[`step${stepNum}`];
    }

    // CPCS 1 (Job Grade + Step): find by cpcs1JobGrade in CPCSSalaryTable
    if (useCPCS1 && jg && stepNum) {
      const cleanJG = parseInt(String(jg).replace(/^JG-?/i, ''), 10);
      if (!isNaN(cleanJG)) {
        const row = await CPCSSalaryTable.findOne({ cpcs1JobGrade: cleanJG }).lean();
        if (row && row[`step${stepNum}`] != null) return row[`step${stepNum}`];
      }
    }

    return null;
  } catch (error) {
    console.error('Error computing salary rate from CPCS:', error);
    return null;
  }
};

/**
 * Get PG (Pay Grade) from CPCSSalaryTable when useCPCSForEmployeeAdd is on.
 * CPCS 2 (SG+Step): returns cpcs2PayGrade. CPCS 1 (JG+Step): returns cpcs2PayGrade from same row.
 */
const getPGFromCPCS = async (sg, jg, statusOfAppointment, settings) => {
  try {
    const CPCSSalaryTable = mongoose.model('CPCSSalaryTable');
    const appointment = (statusOfAppointment || '').toString().toUpperCase();
    const cpcs1Types = (settings && settings.cpcs1AppointmentTypes) || ['CASUAL'];
    const cpcs2Types = (settings && settings.cpcs2AppointmentTypes) || ['PERMANENT'];

    if (cpcs2Types.includes(appointment) && sg) {
      const row = await CPCSSalaryTable.findOne({ salaryGrade: parseInt(sg, 10) }).lean();
      if (row && row.cpcs2PayGrade != null) return row.cpcs2PayGrade;
    }
    if (cpcs1Types.includes(appointment) && jg) {
      const cleanJG = parseInt(String(jg).replace(/^JG-?/i, ''), 10);
      if (!isNaN(cleanJG)) {
        const row = await CPCSSalaryTable.findOne({ cpcs1JobGrade: cleanJG }).lean();
        if (row && row.cpcs2PayGrade != null) return row.cpcs2PayGrade;
      }
    }
    return null;
  } catch (error) {
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
    const status = statusOfAppointment ? statusOfAppointment.toString().toUpperCase() : '';

    // COS: always try Fourth-Tranche cos-salary-table first (SG + Step)
    if (status === 'COS' && sg && step) {
      const rate = await computeSalaryRateFromCPCS(sg, jg, step, statusOfAppointment, employeeStatus, {});
      if (rate != null) return rate;
    }

    const CPCSSalarySettings = mongoose.model('CPCSSalarySettings');
    const settings = await CPCSSalarySettings.findOne().lean();
    if (settings && settings.useCPCSForEmployeeAdd) {
      const rate = await computeSalaryRateFromCPCS(sg, jg, step, statusOfAppointment, employeeStatus, settings);
      if (rate != null) return rate;
      // When useCPCSForEmployeeAdd is ON, do NOT fall back to SalaryGrade (old table)
      // Return null so caller knows CPCS was expected but no rate found
      return null;
    }
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

    // COS already tried above; if we reach here, no rate found
    if (status === 'COS') return null;

    // Fallback (only when useCPCSForEmployeeAdd is OFF)
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
/** Normalize record keys - map alternate Excel column names to expected field names */
const normalizeRecordKeys = (rec) => {
  const aliases = {
    'EmployeeFullName*': 'EmployeeFullName', 'Employee Full Name': 'EmployeeFullName',
    'Employee Number': 'Employee_No', 'EmployeeID': 'Employee_No', 'Employee Id': 'Employee_No',
    'Region*': 'Region', 'Region Name': 'Region',
    'Department*': 'Department',
    'PositionTitle*': 'PositionTitle', 'Position Title': 'PositionTitle',
    'StatusOfAppointment*': 'StatusOfAppointment', 'Status of Appointment': 'StatusOfAppointment',
    'DateOfAppointment*': 'DateOfAppointment', 'Date of Appointment': 'DateOfAppointment',
    'Status*': 'Status',
    'SG*': 'SG', 'Salary Grade': 'SG', 'salaryGrade': 'SG',
    'Step*': 'Step', 'Steps': 'Step', 'SG Step': 'Step',
    'Rate*': 'Rate', 'rate': 'Rate',
    'Item_No': 'Item_No', 'Item No': 'Item_No', 'ItemNumber': 'Item_No', 'itemNumber': 'Item_No',
    'PG*': 'PG', 'pg': 'PG',
    'DateOfBirth': 'DateOfBirth', 'Date of Birth': 'DateOfBirth',
    'Division': 'Division',
  };
  const out = {};
  for (const [k, v] of Object.entries(rec || {})) {
    const key = (k || '').toString().trim();
    const mapped = aliases[key] || key.replace(/\*+$/, '').trim();
    if (mapped) out[mapped] = v;
  }
  return out;
};

const validateAndProcessEmployeeRecord = async (record, activeRegion, fiscalYear, processBy, userAccess = {}, activeDepartment = null, activeDivision = null) => {
  const errors = [];
  const warnings = [];

  // Normalize column names from Excel and merge into record
  const normalized = normalizeRecordKeys(record);
  Object.assign(record, normalized);

  // Validate/Assign Department if activeDepartment is provided
  if (activeDepartment && activeDepartment.trim() !== '') {
    const deptStr = record.Department ? String(record.Department).trim() : '';
    if (deptStr && deptStr.toLowerCase() !== activeDepartment.trim().toLowerCase()) {
      errors.push(`Department mismatch: Excel row has Department "${deptStr}" but bulk upload is set to "${activeDepartment.trim()}"`);
    } else {
      record.Department = activeDepartment.trim();
    }
  }

  // Validate/Assign Division if activeDivision is provided
  if (activeDivision && activeDivision.trim() !== '') {
    const divStr = record.Division ? String(record.Division).trim() : '';
    if (divStr && divStr.toLowerCase() !== activeDivision.trim().toLowerCase()) {
      errors.push(`Division mismatch: Excel row has Division "${divStr}" but bulk upload is set to "${activeDivision.trim()}"`);
    } else {
      record.Division = activeDivision.trim();
    }
  }

  // SG and Step: accept numbers or strings (Excel may return either)
  const sgVal = record.SG;
  let stepVal = record.Step;
  // Normalize step: Excel may return 1.0, "1.0", "1 ", etc.
  if (stepVal != null && stepVal !== '') {
    const stepNum = parseInt(String(stepVal).trim(), 10);
    if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= 8) {
      record.Step = stepNum; // normalize for downstream
    }
  }
  const hasSg = sgVal != null && sgVal !== '';
  const hasStep = stepVal != null && stepVal !== '' && parseInt(String(stepVal).trim(), 10) >= 1 && parseInt(String(stepVal).trim(), 10) <= 8;

  // Required fields - Rate not in base (auto-computed from SG+Step when provided)
  const baseRequiredFields = [
    'EmployeeFullName',
    'Region',
    'Department',
    'PositionTitle',
    'StatusOfAppointment',
    'Status'
  ];

  const isCOS = record.StatusOfAppointment && record.StatusOfAppointment.toString().toUpperCase() === 'COS';
  const isVacant = record.EmployeeFullName && 
                 ['VACANT', 'TO-BE-FILLED'].includes(record.EmployeeFullName.toString().toUpperCase().trim());

  const vacantRequiredFields = [
    'EmployeeFullName',
    'Region',
    'Department',
    'PositionTitle',
    'StatusOfAppointment'
  ];

  const requiredFields = isVacant ? vacantRequiredFields : baseRequiredFields;

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

  // Validate Status (skip for VACANT positions as they don't have status)
  if (!isVacant && record.Status && !['Active', 'Inactive'].includes(record.Status)) {
    errors.push('Status must be either "Active" or "Inactive"');
  }

  // Process EmployeeFullName - handle cases where Excel parsed it as a date/number, then convert to uppercase
  if (record.EmployeeFullName) {
    if (typeof record.EmployeeFullName === 'number') {
      errors.push('EmployeeFullName appears to be formatted as a date in Excel. Please format the column as "Text"');
    } else if (record.EmployeeFullName instanceof Date) {
      record.EmployeeFullName = record.EmployeeFullName.toISOString().split('T')[0];
    } else {
      record.EmployeeFullName = String(record.EmployeeFullName).trim().toUpperCase();
    }
  }

  // Normalize other strings
  if (record.PositionTitle) record.PositionTitle = String(record.PositionTitle).trim();
  if (record.Department) record.Department = String(record.Department).trim();
  if (record.Division) record.Division = String(record.Division).trim();
  if (record.Section) record.Section = String(record.Section).trim();

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

  // Auto-compute or validate Rate (both COS from cos-salary-table and Permanent/Casual)
  let computedRate = null;
  if (hasSg && hasStep) {
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
      const cpcsSettings = await mongoose.model('CPCSSalarySettings').findOne().lean();
      const cpcsHint = cpcsSettings?.useCPCSForEmployeeAdd
        ? ' CPCS II is enabled—ensure Employee Salary Table has data for this SG+Step.'
        : '';
      if (!record.Rate) {
        errors.push(`Could not compute salary rate for SG:${record.SG}, JG:${record.JG}, Step:${record.Step}.${cpcsHint} Please provide Rate manually if needed.`);
      } else {
        warnings.push(`Could not compute salary rate for SG:${record.SG}, JG:${record.JG}, Step:${record.Step}. Using provided rate: ${record.Rate}${cpcsHint}`);
      }
    }
  } else if (!record.Rate && record.Rate !== 0) {
    errors.push('Provide SG and Step for auto-computation (cos-salary-table for COS, employee-salary-table for Permanent/Casual), or enter Rate manually.');
  }

  // Auto-populate PG from CPCSSalaryTable when useCPCSForEmployeeAdd and PG not provided
  if (!record.PG && record.PG !== 0) {
    const CPCSSalarySettings = mongoose.model('CPCSSalarySettings');
    const settings = await CPCSSalarySettings.findOne().lean();
    if (settings && settings.useCPCSForEmployeeAdd) {
      const pgVal = await getPGFromCPCS(record.SG, record.JG, record.StatusOfAppointment, settings);
      if (pgVal != null) record.PG = pgVal;
    }
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

  // Map Item_No to ItemNumber / itemNumber for backend (employee_master and EmployeeList)
  if (record.Item_No != null && record.Item_No !== '') {
    record.ItemNumber = record.Item_No;
    record.itemNumber = record.Item_No;
  }
  delete record.Item_No;

  // Map Employee_No to EmployeeID for backend (for VACANT, leave empty to auto-generate V00001 in upload route)
  if (record.Employee_No != null && String(record.Employee_No).trim() !== '') {
    record.EmployeeID = String(record.Employee_No).trim();
  }

  // Set default values
  record.Region = record.Region || activeRegion;
  record.fiscalYear = fiscalYear;
  record.processBy = processBy || "ADMIN";
  record.employeeStatus = record.Status || 'Active';

  // Auto-compute entitledToMedicalMeal:
  //   - If the Excel row has an explicit ENTITLED_MEDICAL_MEAL column (true/false/"YES"/"NO"), use it.
  //   - Otherwise, auto-derive from DateOfAppointment < 1989-01-01.
  const explicitEntitled = record.ENTITLED_MEDICAL_MEAL ?? record.entitledToMedicalMeal;
  if (explicitEntitled !== undefined && explicitEntitled !== null && explicitEntitled !== '') {
    const val = String(explicitEntitled).trim().toUpperCase();
    record.entitledToMedicalMeal = (val === 'TRUE' || val === 'YES' || val === '1');
  } else if (record.DateOfAppointment instanceof Date && !isNaN(record.DateOfAppointment)) {
    record.entitledToMedicalMeal = record.DateOfAppointment < new Date('1989-01-01');
  } else {
    record.entitledToMedicalMeal = false;
  }
  delete record.ENTITLED_MEDICAL_MEAL; // remove alias column if present

  // Normalize noOfDependent (0–4)
  if (record.noOfDependent != null && record.noOfDependent !== '') {
    const depVal = Math.min(4, Math.max(0, parseInt(String(record.noOfDependent).trim(), 10) || 0));
    record.noOfDependent = depVal;
  } else {
    record.noOfDependent = 0;
  }

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