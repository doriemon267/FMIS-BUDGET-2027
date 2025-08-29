// Quick test to verify the exact assignment data format that works
const testData = {
  userId: 'USER123',
  userName: 'Test User',
  email: 'test@example.com',
  assignmentLevel: 'DIVISION',
  regionId: '67c7fe35b10250a3e86b3d86', // First region ID from debug
  departmentId: '67c7fa8cb10250a3e86b34fd', // First department ID from debug
  divisionName: 'Planning & Programming Division', // Exact division name from debug
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true,
    canEditAllProposals: false,
    canDeleteProposals: false,
    canApproveProposals: false,
    canViewReports: true,
    canManageUsers: false,
    canManageSettings: false
  }
};

console.log('📋 Correct assignment data format:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n✅ This format should work. Make sure frontend sends exactly this structure.');
console.log('\n🔍 Check browser console for "🚀 Submitting assignment data:" log and compare with above format.');
