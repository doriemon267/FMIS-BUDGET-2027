// Debug script to check user hierarchical access structure
console.log('🔍 Checking User Hierarchical Access Structure for Division Users');

// Sample debug - check what fields are available for division users
const sampleHierarchical = {
  // From your previous debug, this is what we saw for Department user:
  scope: 'DEPARTMENT',
  accessibleRegions: [{ regionName: 'CENTRAL OFFICE' }],
  accessibleDepartments: [{ departmentName: 'CORPORATE PLANNING SERVICES' }],
  accessibleDivisions: [], // Empty for department users
  
  // But for Division users, it might be:
  // scope: 'DIVISION',
  // accessibleRegions: [{ regionName: 'CENTRAL OFFICE' }],
  // accessibleDepartments: [{ departmentName: 'CORPORATE PLANNING SERVICES' }],
  // accessibleDivisions: [{ divisionName: 'Some Division Name' }],
};

console.log('Expected Division structure:', {
  case: 'DIVISION',
  expected: 'hierarchical.accessibleDivisions?.[0]?.divisionName',
  alternative1: 'currentUser.divisionName',
  alternative2: 'assignment.divisionName', 
  alternative3: 'hierarchical.divisionName'
});

console.log('\n📋 Need to check:');
console.log('1. What is the actual structure for Division users?');
console.log('2. Are we accessing the right field name?');
console.log('3. Is it divisionName or just division?');

console.log('\n🔧 Possible fixes:');
console.log('- Check currentUser.organizationalAssignment structure');  
console.log('- Look for assignment.divisionName instead of accessibleDivisions');
console.log('- Check if it\'s stored as assignment.divisionId.divisionName');
console.log('- Verify the field name in the database');

console.log('\n🎯 Other components to check for hardcoded Region:');
console.log('- All Employee Benefits table components');
console.log('- Dialog headers and forms'); 
console.log('- Page headers and titles');
console.log('- Breadcrumb components');
console.log('- Export/report components');