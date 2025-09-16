/**
 * Test Script for 6-Step Submission Workflow
 * 
 * Workflow: Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const axios = require('axios');

const API_BASE = 'http://localhost:5005/api';

// Test configuration
const TEST_CONFIG = {
  // You'll need to replace these with actual test user tokens
  DIVISION_USER_TOKEN: 'your_division_user_token_here',
  DEPARTMENT_USER_TOKEN: 'your_department_user_token_here', 
  REGION_USER_TOKEN: 'your_region_user_token_here',
  
  // Test proposal IDs - replace with actual IDs from your database
  TEST_PROPOSAL_IDS: ['proposal_id_1', 'proposal_id_2'],
  
  // Test entity type
  ENTITY: 'personnel'
};

// Utility function to make API calls with token
const apiCall = async (method, endpoint, token, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

// Test functions for each workflow step

/**
 * Step 1→2: Division submits to Department (Draft → Division Submitted)
 */
const testDivisionSubmitToDepartment = async () => {
  console.log('\n🔄 Testing Step 1→2: Division Submit to Department');
  console.log('Expected: Draft → Division Submitted');
  
  const result = await apiCall(
    'POST',
    '/submission-workflow/division/submit-to-department',
    TEST_CONFIG.DIVISION_USER_TOKEN,
    {
      ids: TEST_CONFIG.TEST_PROPOSAL_IDS,
      entity: TEST_CONFIG.ENTITY,
      submissionNote: 'Division submission for testing'
    }
  );
  
  if (result.success) {
    console.log('✅ Division submission successful:', result.data.message);
    console.log(`   Modified ${result.data.modified} records`);
  } else {
    console.log('❌ Division submission failed:', result.error);
  }
  
  return result.success;
};

/**
 * Step 2→3: Department verifies submission (Division Submitted → Department Verified)
 */
const testDepartmentVerifySubmission = async () => {
  console.log('\n🔄 Testing Step 2→3: Department Verify Submission');
  console.log('Expected: Division Submitted → Department Verified');
  
  const result = await apiCall(
    'POST',
    '/submission-workflow/department/verify-submission',
    TEST_CONFIG.DEPARTMENT_USER_TOKEN,
    {
      ids: TEST_CONFIG.TEST_PROPOSAL_IDS,
      entity: TEST_CONFIG.ENTITY,
      verificationNote: 'Department verification complete'
    }
  );
  
  if (result.success) {
    console.log('✅ Department verification successful:', result.data.message);
    console.log(`   Modified ${result.data.modified} records`);
  } else {
    console.log('❌ Department verification failed:', result.error);
  }
  
  return result.success;
};

/**
 * Step 3→4: Department submits to Region (Department Verified → Department Submitted)
 */
const testDepartmentSubmitToRegion = async () => {
  console.log('\n🔄 Testing Step 3→4: Department Submit to Region');
  console.log('Expected: Department Verified → Department Submitted');
  
  const result = await apiCall(
    'POST',
    '/submission-workflow/department/submit-to-region',
    TEST_CONFIG.DEPARTMENT_USER_TOKEN,
    {
      ids: TEST_CONFIG.TEST_PROPOSAL_IDS,
      entity: TEST_CONFIG.ENTITY,
      approvalNote: 'Approved by department, submitting to region'
    }
  );
  
  if (result.success) {
    console.log('✅ Department submission to region successful:', result.data.message);
    console.log(`   Modified ${result.data.modified} records`);
  } else {
    console.log('❌ Department submission to region failed:', result.error);
  }
  
  return result.success;
};

/**
 * Step 4→5: Region approves submission (Department Submitted → Region Approved)
 */
const testRegionApproveSubmission = async () => {
  console.log('\n🔄 Testing Step 4→5: Region Approve Submission');
  console.log('Expected: Department Submitted → Region Approved');
  
  const result = await apiCall(
    'POST',
    '/submission-workflow/region/approve-submission',
    TEST_CONFIG.REGION_USER_TOKEN,
    {
      ids: TEST_CONFIG.TEST_PROPOSAL_IDS,
      entity: TEST_CONFIG.ENTITY,
      regionApprovalNote: 'Approved by region'
    }
  );
  
  if (result.success) {
    console.log('✅ Region approval successful:', result.data.message);
    console.log(`   Modified ${result.data.modified} records`);
  } else {
    console.log('❌ Region approval failed:', result.error);
  }
  
  return result.success;
};

/**
 * Step 5→6: Region finalizes submission (Region Approved → Finalized)
 */
const testRegionFinalizeSubmission = async () => {
  console.log('\n🔄 Testing Step 5→6: Region Finalize Submission');
  console.log('Expected: Region Approved → Finalized');
  
  const result = await apiCall(
    'POST',
    '/submission-workflow/region/finalize-submission',
    TEST_CONFIG.REGION_USER_TOKEN,
    {
      ids: TEST_CONFIG.TEST_PROPOSAL_IDS,
      entity: TEST_CONFIG.ENTITY,
      finalizationNote: 'Final approval - workflow complete'
    }
  );
  
  if (result.success) {
    console.log('✅ Region finalization successful:', result.data.message);
    console.log(`   Modified ${result.data.modified} records`);
  } else {
    console.log('❌ Region finalization failed:', result.error);
  }
  
  return result.success;
};

/**
 * Test pending workflows at each level
 */
const testPendingWorkflows = async () => {
  console.log('\n📋 Testing Pending Workflow Retrievals');
  
  // Test department pending verification
  const pendingVerification = await apiCall(
    'GET',
    `/submission-workflow/department/pending-verification?entity=${TEST_CONFIG.ENTITY}`,
    TEST_CONFIG.DEPARTMENT_USER_TOKEN
  );
  
  if (pendingVerification.success) {
    console.log(`✅ Department pending verification: ${pendingVerification.data.pendingCount} items`);
  } else {
    console.log('❌ Failed to get department pending verification');
  }
  
  // Test department ready to submit
  const readyToSubmit = await apiCall(
    'GET',
    `/submission-workflow/department/ready-to-submit?entity=${TEST_CONFIG.ENTITY}`,
    TEST_CONFIG.DEPARTMENT_USER_TOKEN
  );
  
  if (readyToSubmit.success) {
    console.log(`✅ Department ready to submit: ${readyToSubmit.data.readyCount} items`);
  } else {
    console.log('❌ Failed to get department ready to submit');
  }
  
  // Test region pending approval
  const pendingApproval = await apiCall(
    'GET',
    `/submission-workflow/region/pending-approval?entity=${TEST_CONFIG.ENTITY}`,
    TEST_CONFIG.REGION_USER_TOKEN
  );
  
  if (pendingApproval.success) {
    console.log(`✅ Region pending approval: ${pendingApproval.data.pendingCount} items`);
  } else {
    console.log('❌ Failed to get region pending approval');
  }
  
  // Test region ready to finalize
  const readyToFinalize = await apiCall(
    'GET',
    `/submission-workflow/region/ready-to-finalize?entity=${TEST_CONFIG.ENTITY}`,
    TEST_CONFIG.REGION_USER_TOKEN
  );
  
  if (readyToFinalize.success) {
    console.log(`✅ Region ready to finalize: ${readyToFinalize.data.readyCount} items`);
  } else {
    console.log('❌ Failed to get region ready to finalize');
  }
};

/**
 * Get workflow status summary
 */
const testWorkflowStatusSummary = async () => {
  console.log('\n📊 Testing Workflow Status Summary');
  
  const summary = await apiCall(
    'GET',
    `/submission-workflow/submission-status-summary?entity=${TEST_CONFIG.ENTITY}`,
    TEST_CONFIG.DIVISION_USER_TOKEN // Any valid token should work
  );
  
  if (summary.success) {
    console.log('✅ Workflow status summary retrieved:');
    console.log('   Status counts:', summary.data.statusCounts);
    console.log('   Workflow counts:', summary.data.workflowCounts);
    console.log('   User level:', summary.data.userLevel);
  } else {
    console.log('❌ Failed to get workflow status summary');
  }
};

/**
 * Run complete workflow test
 */
const runCompleteWorkflowTest = async () => {
  console.log('🚀 Starting Complete 6-Step Workflow Test');
  console.log('=' .repeat(60));
  
  console.log('\n📝 Test Configuration:');
  console.log(`   Entity: ${TEST_CONFIG.ENTITY}`);
  console.log(`   Proposal IDs: ${TEST_CONFIG.TEST_PROPOSAL_IDS.join(', ')}`);
  console.log(`   API Base: ${API_BASE}`);
  
  // Check if tokens are configured
  if (TEST_CONFIG.DIVISION_USER_TOKEN === 'your_division_user_token_here') {
    console.log('\n⚠️  WARNING: Please configure actual user tokens in TEST_CONFIG');
    console.log('   You need to get tokens for Division, Department, and Region users');
    return;
  }
  
  // Step-by-step workflow test
  let success = true;
  
  success = await testDivisionSubmitToDepartment() && success;
  success = await testDepartmentVerifySubmission() && success;
  success = await testDepartmentSubmitToRegion() && success;
  success = await testRegionApproveSubmission() && success;
  success = await testRegionFinalizeSubmission() && success;
  
  // Test pending workflows
  await testPendingWorkflows();
  
  // Test status summary
  await testWorkflowStatusSummary();
  
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('🎉 Complete 6-Step Workflow Test PASSED!');
    console.log('   All workflow transitions executed successfully');
  } else {
    console.log('❌ Workflow Test FAILED');
    console.log('   Some steps encountered errors - check logs above');
  }
};

/**
 * Quick API endpoint test (without actual workflow execution)
 */
const testEndpointsOnly = async () => {
  console.log('🔧 Testing API Endpoints (Configuration Check)');
  console.log('=' .repeat(50));
  
  const endpoints = [
    'POST /submission-workflow/division/submit-to-department',
    'POST /submission-workflow/department/verify-submission',
    'POST /submission-workflow/department/submit-to-region',
    'POST /submission-workflow/region/approve-submission',
    'POST /submission-workflow/region/finalize-submission',
    'GET  /submission-workflow/department/pending-verification',
    'GET  /submission-workflow/department/ready-to-submit',
    'GET  /submission-workflow/region/pending-approval',
    'GET  /submission-workflow/region/ready-to-finalize'
  ];
  
  console.log('\n📋 Available Workflow Endpoints:');
  endpoints.forEach(endpoint => {
    console.log(`   ✓ ${endpoint}`);
  });
  
  console.log('\n🎯 Expected Workflow Sequence:');
  console.log('   1. Draft → Division Submitted (Division submits to Department)');
  console.log('   2. Division Submitted → Department Verified (Department verifies)');
  console.log('   3. Department Verified → Department Submitted (Department submits to Region)');
  console.log('   4. Department Submitted → Region Approved (Region approves)');
  console.log('   5. Region Approved → Finalized (Region finalizes)');
  
  console.log('\n💡 To run actual workflow test:');
  console.log('   1. Configure user tokens in TEST_CONFIG');
  console.log('   2. Update TEST_PROPOSAL_IDS with actual proposal IDs');
  console.log('   3. Run: node test-6-step-workflow.js');
};

// Main execution
if (require.main === module) {
  // Check if this is being run directly
  const args = process.argv.slice(2);
  
  if (args.includes('--endpoints-only')) {
    testEndpointsOnly();
  } else {
    runCompleteWorkflowTest();
  }
}

module.exports = {
  testDivisionSubmitToDepartment,
  testDepartmentVerifySubmission,
  testDepartmentSubmitToRegion,
  testRegionApproveSubmission,
  testRegionFinalizeSubmission,
  testPendingWorkflows,
  testWorkflowStatusSummary,
  runCompleteWorkflowTest,
  testEndpointsOnly
};