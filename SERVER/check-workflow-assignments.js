/**
 * Check current workflow role assignments
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

async function checkAssignments() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const assignments = await HierarchicalUserAssignment.find({ isActive: true });
    
    console.log(`📋 Total Active Assignments: ${assignments.length}\n`);
    console.log('=' .repeat(80));
    
    assignments.forEach((assignment, index) => {
      console.log(`\n${index + 1}. ${assignment.userName} (${assignment.userId})`);
      console.log(`   Email: ${assignment.email || 'N/A'}`);
      console.log(`   Access Scope: ${assignment.accessScope || 'N/A'}`);
      console.log(`   Workflow Roles: [${(assignment.workflowRoles || []).join(', ')}]`);
      console.log(`   Assignment Level: ${assignment.assignmentLevel || 'N/A'}`);
      console.log(`   Region: ${assignment.regionName || 'N/A'}`);
      console.log(`   Office: ${assignment.officeName || 'N/A'}`);
      console.log(`   Division: ${assignment.divisionName || 'N/A'}`);
      console.log(`   Department: ${assignment.departmentName || 'N/A'}`);
      
      // Check for role conflicts
      const roles = assignment.workflowRoles || [];
      const hasCreator = roles.some(r => r.toLowerCase().includes('creator'));
      const hasApprover = roles.some(r => r.toLowerCase().includes('approver'));
      const hasVerifier = roles.some(r => r.toLowerCase().includes('verifier'));
      
      if ((hasCreator && hasApprover) || (hasCreator && hasVerifier)) {
        console.log(`   ⚠️  CONFLICT: Has both CREATOR and APPROVER/VERIFIER roles!`);
      } else if (hasCreator) {
        console.log(`   ✅ PREPARER (Creator)`);
      } else if (hasApprover && !hasVerifier) {
        console.log(`   ✅ BUDGET COORDINATOR (Approver)`);
      } else if (hasVerifier) {
        console.log(`   ✅ BUDGET OFFICER/MANAGER (Verifier)`);
      }
    });
    
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkAssignments().catch(console.error);
