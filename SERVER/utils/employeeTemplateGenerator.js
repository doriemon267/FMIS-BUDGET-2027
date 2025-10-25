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
      // Show generic samples for full/region access
      sampleData.push(
        {
          'EmployeeID*': 'EMP002',
          'EmployeeFullName*': 'Maria Santos',
          'DateOfBirth': '1985-03-20',
          'Region*': region || 'REGION_NAME',
          'Department*': 'IT Department',
          'Division': 'Software Development',
          'Section': 'Frontend Team',
          'PositionTitle*': 'Software Developer',
          'StatusOfAppointment*': 'Contractual',
          'DateOfAppointment*': '2023-06-01',
          'Status*': 'Active',
          'SG*': 15,
          'JG*': 'JG-15',
          'Step*': 3,
          'Rate': ''
        },
        {
          'EmployeeID*': 'EMP003',
          'EmployeeFullName*': 'Pedro Reyes',
          'DateOfBirth': '1978-11-10',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Finance Department',
          'Division': 'Budget Division',
          'Section': 'Planning Section',
          'PositionTitle*': 'Preparer',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '2020-04-15',
          'Status*': 'Active',
          'SG*': 12,
          'JG*': 'JG-12',
          'Step*': 5,
          'Rate': ''
        }
      );
      break;

    case 'DEPARTMENT':
      // Generate samples using user's actual accessible departments
      deptNames.forEach((deptName, index) => {
        sampleData.push({
          'EmployeeID*': `EMP${String(index + 2).padStart(3, '0')}`,
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '1985-03-20',
          'Region*': region || 'REGION_NAME',
          'Department*': deptName,
          'Division': `${deptName} Division`,
          'Section': `${deptName} Section`,
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '2023-06-01',
          'Status*': 'Active',
          'SG*': 10 + index,
          'JG*': `JG-${10 + index}`,
          'Step*': 1,
          'Rate': ''
        });
      });
      break;

    case 'DIVISION':
      // Generate samples using user's actual accessible divisions
      divNames.forEach((divName, index) => {
        sampleData.push({
          'EmployeeID*': `EMP${String(index + 2).padStart(3, '0')}`,
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '1985-03-20',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Department Name', // Generic since division-level users may access multiple departments
          'Division': divName,
          'Section': `${divName} Section`,
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '2023-06-01',
          'Status*': 'Active',
          'SG*': 10 + index,
          'JG*': `JG-${10 + index}`,
          'Step*': 1,
          'Rate': ''
        });
      });
      break;

    case 'SECTION':
      // Generate samples using user's actual accessible sections
      sectNames.forEach((sectName, index) => {
        sampleData.push({
          'EmployeeID*': `EMP${String(index + 2).padStart(3, '0')}`,
          'EmployeeFullName*': `Sample Employee ${index + 1}`,
          'DateOfBirth': '1985-03-20',
          'Region*': region || 'REGION_NAME',
          'Department*': 'Department Name', // Generic
          'Division': 'Division Name', // Generic
          'Section': sectName,
          'PositionTitle*': 'Staff',
          'StatusOfAppointment*': 'Permanent',
          'DateOfAppointment*': '2023-06-01',
          'Status*': 'Active',
          'SG*': 10 + index,
          'JG*': `JG-${10 + index}`,
          'Step*': 1,
          'Rate': ''
        });
      });
      break;

    default:
      // Default to showing generic samples
      sampleData.push(
        {
          'EmployeeID*': 'EMP002',
          'EmployeeFullName*': 'Maria Santos',
          'DateOfBirth': '1985-03-20',
          'Region*': region || 'REGION_NAME',
          'Department*': 'IT Department',
          'Division': 'Software Development',
          'Section': 'Frontend Team',
          'PositionTitle*': 'Software Developer',
          'StatusOfAppointment*': 'Contractual',
          'DateOfAppointment*': '2023-06-01',
          'Status*': 'Active',
          'SG*': 15,
          'JG*': 'JG-15',
          'Step*': 3,
          'Rate': ''
        },
        {
          'EmployeeID*': 'COS001',
          'EmployeeFullName*': 'Juan dela Cruz',
          'DateOfBirth': '1990-05-10',
          'Region*': region || 'REGION_NAME',
          'Department*': 'HR Department',
          'Division': 'Recruitment',
          'Section': 'Talent Acquisition',
          'PositionTitle*': 'Consultant',
          'StatusOfAppointment*': 'COS',
          'DateOfAppointment*': '2024-01-15',
          'Status*': 'Active',
          'SG': '',
          'JG': '',
          'Step': '',
          'Rate': '30000'
        }
      );
  }

  // Ensure we have at least one sample
  if (sampleData.length === 0) {
    sampleData.push({
      'EmployeeID*': 'EMP002',
      'EmployeeFullName*': 'Sample Employee',
      'DateOfBirth': '1985-03-20',
      'Region*': region || 'REGION_NAME',
      'Department*': 'Department Name',
      'Division': 'Division Name',
      'Section': 'Section Name',
      'PositionTitle*': 'Staff',
      'StatusOfAppointment*': 'Permanent',
      'DateOfAppointment*': '2023-06-01',
      'Status*': 'Active',
      'SG*': 10,
      'JG*': 'JG-10',
      'Step*': 1,
      'Rate': ''
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
      // Header row with field descriptions
      'EmployeeID*': 'EMP001',
      'EmployeeFullName*': 'Juan Dela Cruz',
      'DateOfBirth': '1990-01-15', // Optional field
      'Region*': region || 'REGION_NAME',
      'Department*': 'Department Name',
      'Division': 'Division Name', // Optional
      'Section': 'Section Name', // Optional
      'PositionTitle*': 'Position Title',
      'StatusOfAppointment*': 'Permanent',
      'DateOfAppointment*': '2024-01-15',
      'Status*': 'Active',
      'SG': 10, // Salary Grade - required for Permanent/Contractual, optional for COS
      'JG': 'JG-10', // Job Grade - required for Permanent/Contractual, optional for COS
      'Step': 1, // Step - required for Permanent/Contractual, optional for COS
      'Rate': '', // Will be auto-computed for Permanent/Contractual, manual entry for COS
    },
    {
      // COS (Contract of Service) example - no SG/JG/Step required
      'EmployeeID*': 'COS001',
      'EmployeeFullName*': 'Maria Santos',
      'DateOfBirth': '1985-03-20',
      'Region*': region || 'REGION_NAME',
      'Department*': 'IT Department',
      'Division': 'Software Development',
      'Section': 'Frontend Team',
      'PositionTitle*': 'Consultant',
      'StatusOfAppointment*': 'COS',
      'DateOfAppointment*': '2024-06-01',
      'Status*': 'Active',
      'SG': '', // Not required for COS
      'JG': '', // Not required for COS
      'Step': '', // Not required for COS
      'Rate': '25000', // Manual rate entry for COS
    },
    // Add filtered sample data based on access level
    ...generateFilteredSampleData(region, scope, accessibleDepartments, accessibleDivisions, accessibleSections)
  ];

  // Create workbook and worksheet
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(templateData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 15 }, // EmployeeID*
    { wch: 20 }, // EmployeeFullName*
    { wch: 12 }, // DateOfBirth
    { wch: 15 }, // Region*
    { wch: 18 }, // Department*
    { wch: 15 }, // Division
    { wch: 15 }, // Section
    { wch: 20 }, // PositionTitle*
    { wch: 18 }, // StatusOfAppointment*
    { wch: 18 }, // DateOfAppointment*
    { wch: 10 }, // Status*
    { wch: 8 },  // SG*
    { wch: 10 }, // JG*
    { wch: 8 },  // Step*
    { wch: 12 }  // Rate
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
    { 'Instructions': '- EmployeeID*: Unique identifier for the employee' },
    { 'Instructions': '- EmployeeFullName*: Full name of the employee' },
    { 'Instructions': '- Region*: Must match the currently selected region' },
    { 'Instructions': '- Department*: Department name' },
    { 'Instructions': '- PositionTitle*: Job position title' },
    { 'Instructions': '- StatusOfAppointment*: Employment status (Permanent, Contractual, etc.)' },
    { 'Instructions': '- DateOfAppointment*: Date when employee was appointed' },
    { 'Instructions': '- Status*: Active or Inactive' },
    { 'Instructions': '- SG*: Salary Grade (1-33)' },
    { 'Instructions': '- JG*: Job Grade (will be auto-filled based on SG)' },
    { 'Instructions': '- Step*: Salary step (1-8)' },
    { 'Instructions': '' },
    { 'Instructions': 'OPTIONAL FIELDS:' },
    { 'Instructions': '- DateOfBirth: Employee\'s date of birth (YYYY-MM-DD)' },
    { 'Instructions': '- Division: Division name' },
    { 'Instructions': '- Section: Section name' },
    { 'Instructions': '- Rate: Will be auto-computed based on SG, JG, and Step' },
    { 'Instructions': '' },
    { 'Instructions': 'AUTO-COMPUTATION:' },
    { 'Instructions': '- For Permanent/Contractual: Rate is auto-calculated from SG, JG, Step' },
    { 'Instructions': '- For COS: Rate must be manually entered, SG/JG/Step are optional' },
    { 'Instructions': '- If Rate is provided for Permanent/Contractual, it will be validated' },
    { 'Instructions': '' },
    { 'Instructions': 'SALARY GRADE FIELDS:' },
    { 'Instructions': '- SG, JG, Step: Required for Permanent/Contractual employees' },
    { 'Instructions': '- SG, JG, Step: Optional for COS employees' },
    { 'Instructions': '- COS employees use manual Rate entry instead of auto-computation' },
    { 'Instructions': '' },
    { 'Instructions': 'DATE FORMATS:' },
    { 'Instructions': '- Use YYYY-MM-DD format for dates (e.g., 1990-01-15)' },
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
    ],
    optional: [
      'DateOfBirth',
      'Division',
      'Section',
      'Rate'
    ],
    computed: [
      'Rate' // Will be computed based on SG, JG, Step
    ],
    descriptions: {
      EmployeeID: 'Unique employee identifier',
      EmployeeFullName: 'Full name of the employee',
      DateOfBirth: 'Date of birth (optional)',
      Region: 'Region name (must match active region)',
      Department: 'Department name',
      Division: 'Division name (optional)',
      Section: 'Section name (optional)',
      PositionTitle: 'Job position title',
      StatusOfAppointment: 'Employment appointment status',
      DateOfAppointment: 'Date of appointment',
      Status: 'Employee status (Active/Inactive)',
      SG: 'Salary Grade (1-33)',
      JG: 'Job Grade',
      Step: 'Salary step (1-8)',
      Rate: 'Monthly salary rate (auto-computed)'
    }
  };
};

module.exports = {
  generateEmployeeTemplate,
  getEmployeeFields
};