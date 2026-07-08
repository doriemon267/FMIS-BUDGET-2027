const xlsx = require('xlsx');
const path = require('path');

/**
 * Generate filtered sample data based on user's hierarchical access level
 * @param {string} region - Active region name
 * @param {string} scope - User's access scope
 * @param {Array} accessibleDepartments - List of accessible departments
 * @param {Array} accessibleDivisions - List of accessible divisions
 * @param {Array} accessibleSections - List of accessible sections
 * @returns {Array} Filtered sample data rows
 */
const generateFilteredSampleData = (region, scope, accessibleDepartments, accessibleDivisions, accessibleSections) => {
  const sampleData = [];

  // Filter out null values and get actual names
  const deptNames = accessibleDepartments
    .filter(d => d && (d.departmentName || d.name || d))
    .map(d => d.departmentName || d.name || d);

  const divNames = accessibleDivisions
    .filter(d => d && (d.divisionName || d.name || d))
    .map(d => d.divisionName || d.name || d);

  const sectNames = accessibleSections
    .filter(s => s && (s.sectionName || s.name || s))
    .map(s => s.sectionName || s.name || s);

  // Generate sample data based on access level
  switch (scope.toUpperCase()) {
    case 'FULL':
    case 'REGION':
      sampleData.push(
        {
          'EmployeeFullName*': 'Maria Santos',
          'DateOfBirth': '03/20/1985',
          'Region*': region || 'REGION_NAME',
          'Department*': 'IT Department',
          'Division': 'Software Development',
          'PositionTitle*': 'Software Developer',
          'StatusOfAppointment*': 'Contractual',
          'DateOfAppointment*': '06/01/2023',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 15,
          'JG': 'JG-15',
          'Step': 3,
          'Rate': ''
        },
        {
          'EmployeeFullName*': 'Pedro Reyes',
          'DateOfBirth': '11/10/1978',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Finance Department',
          'Division': 'Budget Division',
          'PositionTitle*': 'Budget Preparer',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '04/15/2020',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 12,
          'JG': 'JG-12',
          'Step': 5,
          'Rate': '',
          'noOfDependent': 0
        }
      );
      break;

    case 'DEPARTMENT':
      deptNames.forEach((deptName, index) => {
        sampleData.push({
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '03/20/1985',
          'Region*': region || 'REGION_NAME',
          'Department*': deptName,
          'Division': `${deptName} Division`,
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '06/01/2023',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 10 + index,
          'JG': `JG-${10 + index}`,
          'Step': 1,
          'Rate': ''
        });
      });
      break;

    case 'DIVISION':
      divNames.forEach((divName, index) => {
        sampleData.push({
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '03/20/1985',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Department Name',
          'Division': divName,
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '06/01/2023',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 10 + index,
          'JG': `JG-${10 + index}`,
          'Step': 1,
          'Rate': ''
        });
      });
      break;

    case 'SECTION':
      sectNames.forEach((sectName, index) => {
        sampleData.push({
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '03/20/1985',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Department Name',
          'Division': 'Division Name',
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '06/01/2023',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 10 + index,
          'JG': `JG-${10 + index}`,
          'Step': 1,
          'Rate': ''
        });
      });
      break;

    default:
      sampleData.push(
        {
          'EmployeeFullName*': 'Maria Santos',
          'DateOfBirth': '03/20/1985',
          'Region*': region || 'REGION_NAME',
          'Department*': 'IT Department',
          'Division': 'Software Development',
          'PositionTitle*': 'Software Developer',
          'StatusOfAppointment*': 'Contractual',
          'DateOfAppointment*': '06/01/2023',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 15,
          'JG': 'JG-15',
          'Step': 3,
          'Rate': ''
        },
        {
          'EmployeeFullName*': 'Juan dela Cruz',
          'DateOfBirth': '05/10/1990',
          'Region*': region || 'REGION_NAME',
          'Department*': 'HR Department',
          'Division': 'Recruitment',
          'PositionTitle*': 'Consultant',
          'StatusOfAppointment*': 'COS',
          'DateOfAppointment*': '01/15/2024',
          'Status*': 'Active',
          'Item_No': '',
          'PG': '',
          'SG': 10,
          'JG': '',
          'Step': 1,
          'Rate': '',
          'noOfDependent': 0
        }
      );
  }

  if (sampleData.length === 0) {
    sampleData.push({
      'EmployeeFullName*': 'Sample Employee',
      'DateOfBirth': '03/20/1985',
      'Region*': region || 'REGION_NAME',
      'Department*': 'Department Name',
      'Division': 'Division Name',
      'PositionTitle*': 'Staff',
      'StatusOfAppointment*': 'Permanent',
      'DateOfAppointment*': '06/01/2023',
      'Status*': 'Active',
      'Item_No': '',
      'PG': '',
      'SG': 10,
      'JG': 'JG-10',
      'Step': 1,
      'Rate': '',
      'noOfDependent': 0
    });
  }

  return sampleData;
};

/**
 * Generate instructions about user's access permissions
 * @param {string} scope - User's access scope
 * @param {Array} accessibleDepartments - List of accessible departments
 * @param {Array} accessibleDivisions - List of accessible divisions
 * @param {Array} accessibleSections - List of accessible sections
 * @returns {Array} Instructions about access permissions
 */
const generateAccessPermissionsInstructions = (scope, accessibleDepartments, accessibleDivisions, accessibleSections) => {
  const instructions = [];

  // Filter out null values and get actual names
  const deptNames = accessibleDepartments
    .filter(d => d && (d.departmentName || d.name || d))
    .map(d => d.departmentName || d.name || d);

  const divNames = accessibleDivisions
    .filter(d => d && (d.divisionName || d.name || d))
    .map(d => d.divisionName || d.name || d);

  const sectNames = accessibleSections
    .filter(s => s && (s.sectionName || s.name || s))
    .map(s => s.sectionName || s.name || s);

  switch (scope.toUpperCase()) {
    case 'FULL':
      instructions.push({ 'Instructions': '- You have FULL access to all departments, divisions, and sections' });
      break;

    case 'REGION':
      instructions.push({ 'Instructions': '- You have access to all departments, divisions, and sections in your region' });
      break;

    case 'DEPARTMENT':
      if (deptNames.length > 0) {
        instructions.push({ 'Instructions': '- Accessible Departments:' });
        deptNames.forEach(dept => {
          instructions.push({ 'Instructions': `  • ${dept}` });
        });
      } else {
        instructions.push({ 'Instructions': '- No specific department access configured' });
      }
      break;

    case 'DIVISION':
      if (divNames.length > 0) {
        instructions.push({ 'Instructions': '- Accessible Divisions:' });
        divNames.forEach(div => {
          instructions.push({ 'Instructions': `  • ${div}` });
        });
      } else {
        instructions.push({ 'Instructions': '- No specific division access configured' });
      }
      break;

    case 'SECTION':
      if (sectNames.length > 0) {
        instructions.push({ 'Instructions': '- Accessible Sections:' });
        sectNames.forEach(sect => {
          instructions.push({ 'Instructions': `  • ${sect}` });
        });
      } else {
        instructions.push({ 'Instructions': '- No specific section access configured' });
      }
      break;

    default:
      instructions.push({ 'Instructions': '- Access permissions not specified' });
  }

  return instructions;
};

/**
 * Generate dynamic Excel template for employee import based on form fields
 * @param {Object} options - Template generation options
 * @param {string} options.region - Active region name
 * @param {string} options.fiscalYear - Active fiscal year
 * @param {string} options.scope - User's access scope (FULL, REGION, DEPARTMENT, DIVISION, SECTION)
 * @param {Array} options.accessibleDepartments - List of accessible departments
 * @param {Array} options.accessibleDivisions - List of accessible divisions
 * @param {Array} options.accessibleSections - List of accessible sections
 * @returns {Buffer} Excel file buffer
 */
const generateEmployeeTemplate = (options = {}) => {
  const {
    region = '',
    fiscalYear = '',
    scope = 'REGION',
    accessibleDepartments = [],
    accessibleDivisions = [],
    accessibleSections = []
  } = options;

  // Define the template structure based on the add employee form fields
  const templateData = [
    {
      'EmployeeFullName*': 'Juan Dela Cruz',
      'Employee Number': '',
      'DateOfBirth': '01/15/1990',
      'Region*': region || 'REGION_NAME',
      'Department*': 'Department Name',
      'Division': 'Division Name',
      'PositionTitle*': 'Position Title',
      'StatusOfAppointment*': 'Permanent',
      'DateOfAppointment*': '01/15/2024',
      'Status*': 'Active',
      'Item_No': '',
      'PG': '',
      'SG': 10,
      'JG': 'JG-10',
      'Step': 1,
      'Rate': '',
      'noOfDependent': 0,
    },
    {
      'EmployeeFullName*': 'Maria Santos',
      'Employee Number': '',
      'DateOfBirth': '03/20/1985',
      'Region*': region || 'REGION_NAME',
      'Department*': 'IT Department',
      'Division': 'Software Development',
      'PositionTitle*': 'Consultant',
      'StatusOfAppointment*': 'COS',
      'DateOfAppointment*': '06/01/2024',
      'Status*': 'Active',
      'Item_No': '',
      'PG': '',
      'SG': 10,
      'JG': '',
      'Step': 1,
      'Rate': '',
      'noOfDependent': 0,
    },
    {
      'EmployeeFullName*': 'VACANT',
      'Employee Number': '',
      'DateOfBirth': '',
      'Region*': region || 'REGION_NAME',
      'Department*': 'Department Name',
      'Division': 'Division Name',
      'PositionTitle*': 'Position Title',
      'StatusOfAppointment*': 'Permanent',
      'DateOfAppointment*': '',
      'Status*': 'Active',
      'Item_No': '1',
      'PG': '',
      'SG': '',
      'JG': '',
      'Step': '',
      'Rate': '',
      'noOfDependent': '',
    },
    // Add filtered sample data based on access level
    ...generateFilteredSampleData(region, scope, accessibleDepartments, accessibleDivisions, accessibleSections)
  ];

  // Create workbook and worksheet
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(templateData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 20 }, // EmployeeFullName*
    { wch: 14 }, // Employee Number
    { wch: 12 }, // DateOfBirth
    { wch: 15 }, // Region*
    { wch: 18 }, // Department*
    { wch: 15 }, // Division
    { wch: 20 }, // PositionTitle*
    { wch: 18 }, // StatusOfAppointment*
    { wch: 18 }, // DateOfAppointment*
    { wch: 10 }, // Status*
    { wch: 10 }, // Item_No
    { wch: 8 },  // PG
    { wch: 8 },  // SG
    { wch: 10 }, // JG
    { wch: 8 },  // Step
    { wch: 12 }, // Rate
    { wch: 15 }  // noOfDependent
  ];
  ws['!cols'] = colWidths;

  // Add data validation for Status column
  ws['!dataValidation'] = {
    J2: { // Status column (J is the 10th column, 0-indexed as 9, but Excel uses 1-indexed)
      type: 'list',
      formula1: '"Active,Inactive"',
      showDropDown: true
    }
  };

  // Add worksheet to workbook
  xlsx.utils.book_append_sheet(wb, ws, 'Employee_Template');

  // Create instructions sheet
  const instructionsData = [
    { 'Instructions': 'Employee Import Template Instructions' },
    { 'Instructions': '' },
    { 'Instructions': 'REQUIRED FIELDS (marked with *):' },
    { 'Instructions': '- EmployeeFullName*: Full name of the employee (use VACANT or To-Be-Filled for vacant positions)' },
    { 'Instructions': '- Employee Number: Optional. For VACANT leave blank to auto-generate (e.g. V00001)' },
    { 'Instructions': '- Region*: Must match the currently selected region' },
    { 'Instructions': '- Department*: Department name' },
    { 'Instructions': '- PositionTitle*: Job position title' },
    { 'Instructions': '- StatusOfAppointment*: Employment status (Permanent, Contractual, COS, etc.)' },
    { 'Instructions': '- Status*: Active or Inactive' },
    { 'Instructions': '' },
    { 'Instructions': 'OPTIONAL FIELDS:' },
    { 'Instructions': '- DateOfBirth: Employee\'s date of birth (MM/DD/YYYY)' },
    { 'Instructions': '- DateOfAppointment: Date when employee was appointed' },
    { 'Instructions': '- Division: Division name' },
    { 'Instructions': '- Item_No: Item number' },
    { 'Instructions': '- PG: PG (bases from salary tables)' },
    { 'Instructions': '- SG, JG, Step: Optional; bases from /employee-salary-table or /cos-salary-table' },
    { 'Instructions': '- Rate: Auto-computed from SG+Step (leave empty when SG+Step provided)' },
    { 'Instructions': '- noOfDependent: Number of dependents from 0 to 4 (optional)' },
    { 'Instructions': '' },
    { 'Instructions': 'SALARY FIELDS (SG, JG, PG not required):' },
    { 'Instructions': '- Permanent/Casual: Use data from /employee-salary-table' },
    { 'Instructions': '- COS: SG + Step auto-compute Rate from /cos-salary-table (leave Rate empty)' },
    { 'Instructions': '' },
    { 'Instructions': 'DATE FORMATS:' },
    { 'Instructions': '- Use MM/DD/YYYY format for dates (e.g., 01/15/1990)' },
    { 'Instructions': '- Excel date formats will be automatically converted' },
    { 'Instructions': '' },
    { 'Instructions': 'VALIDATION:' },
    { 'Instructions': '- All employees must belong to the active region' },
    { 'Instructions': '- EmployeeID must be unique' },
    { 'Instructions': '- Required fields cannot be empty' },
    { 'Instructions': '- Department/Division/Section must match your access permissions' },
    { 'Instructions': '' },
    { 'Instructions': `Access Level: ${scope || 'REGION'}` },
    { 'Instructions': `Active Region: ${region || 'Please select a region'}` },
    { 'Instructions': `Fiscal Year: ${fiscalYear || 'Please set active fiscal year'}` },
    { 'Instructions': '' },
    { 'Instructions': 'YOUR ACCESS PERMISSIONS:' },
    ...generateAccessPermissionsInstructions(scope, accessibleDepartments, accessibleDivisions, accessibleSections)
  ];

  const instructionsWs = xlsx.utils.json_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 60 }];
  xlsx.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  // Generate buffer
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return buffer;
};

/**
 * Get the list of required and optional fields for employee import
 * @returns {Object} Field definitions
 */
const getEmployeeFields = () => {
  return {
    required: [
      'EmployeeFullName',
      'Region',
      'Department',
      'PositionTitle',
      'StatusOfAppointment',
      'Status'
    ],
    optional: [
      'Employee Number',
      'DateOfBirth',
      'DateOfAppointment',
      'Division',
      'Item_No',
      'PG',
      'SG',
      'JG',
      'Step',
      'Rate',
      'noOfDependent'
    ],
    computed: [],
    descriptions: {
      EmployeeFullName: 'Full name of the employee (use VACANT for vacant positions)',
      'Employee Number': 'Optional. For VACANT leave blank to auto-generate (e.g. V00001)',
      DateOfBirth: 'Date of birth (optional)',
      Region: 'Region name (must match active region)',
      Department: 'Department name',
      Division: 'Division name (optional)',
      PositionTitle: 'Job position title',
      StatusOfAppointment: 'Employment appointment status',
      DateOfAppointment: 'Date of appointment',
      Status: 'Employee status (Active/Inactive)',
      Item_No: 'Item number (optional)',
      PG: 'PG (optional, from salary tables)',
      SG: 'Salary Grade (optional)',
      JG: 'Job Grade (optional)',
      Step: 'Salary step (optional)',
      Rate: 'Monthly salary rate',
      noOfDependent: 'Number of dependents (0-4) (optional)'
    }
  };
};

module.exports = {
  generateEmployeeTemplate,
  getEmployeeFields
};