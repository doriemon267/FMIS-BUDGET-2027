// Debug the actual user data structure for Division users
console.log('🔍 Debug User Data Structure');

// Add this temporarily to one of the components to see what data is available
const debugUserData = (currentUser, assignmentLevel) => {
  console.log('Current User:', currentUser);
  console.log('Assignment Level:', assignmentLevel);
  
  if (currentUser?.hierarchicalAccess) {
    console.log('Hierarchical Access:', currentUser.hierarchicalAccess);
    console.log('Accessible Divisions:', currentUser.hierarchicalAccess.accessibleDivisions);
  }
  
  // Check all possible division fields
  console.log('Possible division fields:');
  console.log('- currentUser.divisionName:', currentUser?.divisionName);
  console.log('- currentUser.division:', currentUser?.division);
  console.log('- currentUser.divisionId:', currentUser?.divisionId);
  console.log('- currentUser.organizationalAssignment:', currentUser?.organizationalAssignment);
  
  if (currentUser?.organizationalAssignment) {
    console.log('Organizational Assignment Details:');
    console.log('- divisions:', currentUser.organizationalAssignment.divisions);
    console.log('- divisionName:', currentUser.organizationalAssignment.divisionName);
  }
};

// This should be added to the getHierarchicalDisplay function temporarily
export { debugUserData };