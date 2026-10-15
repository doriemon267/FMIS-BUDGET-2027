// Debug script to check user hierarchical access structure
console.log('🔍 Checking User Hierarchical Access Structure for Responsibility Center Users');

// Sample debug - check what fields are available for responsibility center users
const sampleHierarchical = {
  // From your previous debug, this is what we saw for Office user:
  scope: 'OFFICE',
  accessibleOffices: [{ officeName: 'CORPORATE PLANNING SERVICES' }],
  accessibleResponsibilityCenters: [], // Empty for office users
  
  // But for Responsibility Center users, it might be:
  // scope: 'RESPONSIBILITY_CENTER',
  // accessibleOffices: [{ officeName: 'CORPORATE PLANNING SERVICES' }],
  // accessibleResponsibilityCenters: [{ responsibilityCenterName: 'Some Responsibility Center Name' }],
};

console.log('Expected Responsibility Center structure:', {
  case: 'RESPONSIBILITY_CENTER',
  expected: 'hierarchical.accessibleResponsibilityCenters?.[0]?.responsibilityCenterName',
  alternative1: 'currentUser.responsibilityCenterName',
  alternative2: 'assignment.responsibilityCenterName', 
  alternative3: 'hierarchical.responsibilityCenterName'
});

console.log('\n📋 Need to check:');
console.log('1. What is the actual structure for Responsibility Center users?');
console.log('2. Are we accessing the right field name?');
console.log('3. Is it responsibilityCenterName or just responsibilityCenter?');

console.log('\n🔧 Possible fixes:');
console.log('- Check currentUser.organizationalAssignment structure');  
console.log('- Look for assignment.responsibilityCenterName instead of accessibleResponsibilityCenters');
console.log('- Check if it\'s stored as assignment.responsibilityCenterId.responsibilityCenterName');
console.log('- Verify the field name in the database');

console.log('\n🎯 Other components to check for hardcoded Office:');
console.log('- All Employee Benefits table components');
console.log('- Dialog headers and forms'); 
console.log('- Page headers and titles');
console.log('- Breadcrumb components');
console.log('- Export/report components');