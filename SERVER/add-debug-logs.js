// Debug script to add console logs to the middleware
const fs = require('fs');

console.log('🔧 Adding debug console logs to submissionWorkflowControl middleware...');

// Read the current middleware file
const middlewareFile = 'D:/DREED/FMIS-BUDGET-SEPTEMBER/SERVER/middleware/submissionWorkflowControl.js';
const content = fs.readFileSync(middlewareFile, 'utf8');

// Check if debug logs already exist
if (content.includes('🐛 DEBUG: Region level filtering')) {
  console.log('✅ Debug logs already exist in middleware');
} else {
  // Add debug logs to the REGION case
  const updatedContent = content.replace(
    `case 'REGION':
      // Region users can see:
      // 1. Their own region data (any status)
      // 2. SUBMITTED data from departments within their region
      if (enforceSubmissionWorkflow) {`,
    `case 'REGION':
      // Region users can see:
      // 1. Their own region data (any status)
      // 2. SUBMITTED data from departments within their region
      console.log('🐛 DEBUG: Region level filtering for user:', assignment.userName || 'unknown');
      console.log('🐛 DEBUG: User assignment:', JSON.stringify(assignment, null, 2));
      console.log('🐛 DEBUG: Enforce submission workflow:', enforceSubmissionWorkflow);
      if (enforceSubmissionWorkflow) {`
  );

  const finalContent = updatedContent.replace(
    `submissionFilters = hierarchicalFilters;
      }
      break;`,
    `submissionFilters = hierarchicalFilters;
      }
      console.log('🐛 DEBUG: Final Region filters:', JSON.stringify(submissionFilters, null, 2));
      break;`
  );

  // Write back to file
  fs.writeFileSync(middlewareFile, finalContent, 'utf8');
  console.log('✅ Debug logs added to submissionWorkflowControl middleware');
}

console.log('\n📝 Instructions:');
console.log('1. The middleware now has debug logs for Region level filtering');
console.log('2. Check the server console when a Region user accesses Employee Benefits');
console.log('3. Look for "🐛 DEBUG:" messages to see what filters are being generated');
console.log('4. This will help identify if the issue is in the middleware or elsewhere');

console.log('\n🎯 Next steps to debug the issue:');
console.log('1. Have a Region level user access the overtime page');
console.log('2. Check server console for debug messages');
console.log('3. Verify the user assignment data is correct');
console.log('4. Check if the filters are being applied to the database query');