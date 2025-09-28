const xlsx = require('xlsx');

// Create a simple test Excel file with proper formatting
const testData = [
  {
    'EmployeeID': 'EMP001',
    'EmployeeFullName': 'Test Employee (Permanent)',
    'DateOfBirth': '1985-03-20',
    'Region': 'CENTRAL OFFICE',
    'Department': 'IT Department',
    'Division': 'Software Development',
    'Section': 'Frontend Team',
    'PositionTitle': 'Software Developer',
    'StatusOfAppointment': 'Permanent',
    'DateOfAppointment': '2023-06-01',
    'Status': 'Active',
    'SG': 15,
    'JG': 'JG-15',
    'Step': 3,
    'Rate': ''
  },
  {
    'EmployeeID': 'COS001',
    'EmployeeFullName': 'Test Employee (COS)',
    'DateOfBirth': '1990-05-15',
    'Region': 'CENTRAL OFFICE',
    'Department': 'HR Department',
    'Division': 'Recruitment',
    'Section': 'Talent Acquisition',
    'PositionTitle': 'Consultant',
    'StatusOfAppointment': 'COS',
    'DateOfAppointment': '2024-01-15',
    'Status': 'Active',
    'SG': '',
    'JG': '',
    'Step': '',
    'Rate': 25000
  }
];

// Create workbook and worksheet
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(testData);

// Set column widths for better readability
ws['!cols'] = [
  { wch: 12 }, // EmployeeID
  { wch: 25 }, // EmployeeFullName
  { wch: 12 }, // DateOfBirth
  { wch: 15 }, // Region
  { wch: 18 }, // Department
  { wch: 18 }, // Division
  { wch: 18 }, // Section
  { wch: 20 }, // PositionTitle
  { wch: 18 }, // StatusOfAppointment
  { wch: 18 }, // DateOfAppointment
  { wch: 10 }, // Status
  { wch: 8 },  // SG
  { wch: 8 },  // JG
  { wch: 8 },  // Step
  { wch: 10 }  // Rate
];

// Add worksheet to workbook
xlsx.utils.book_append_sheet(wb, ws, 'Employees');

// Save the file
xlsx.writeFile(wb, 'test_employee_upload.xlsx');
console.log('Test Excel file created: test_employee_upload.xlsx');
console.log('Make sure to format these columns as TEXT in Excel:');
console.log('- EmployeeID');
console.log('- EmployeeFullName');
console.log('- All date columns (DateOfBirth, DateOfAppointment)');