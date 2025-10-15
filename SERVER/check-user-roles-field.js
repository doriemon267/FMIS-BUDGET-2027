/**
 * Check if users have userRole field in database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

async function checkUserRoles() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const assignments = await HierarchicalUserAssignment.find({ isActive: true });
    
    console.log('📋 Current User Role Assignments:\n');
    console.log('================================================================================\n');
    
    assignments.forEach((assignment, index) => {
      console.log(`${index + 1}. ${assignment.userName} (${assignment.userId})`);
      console.log(`   Email: ${assignment.email}`);
      console.log(`   User Role: ${assignment.userRole || 'NOT SET ❌'}`);
      console.log(`   Assignment Level: ${assignment.assignmentLevel}`);
      console.log(`   Access Scope: ${assignment.accessScope}`);
      console.log(`   Workflow Roles: [${assignment.workflowRoles.join(', ')}]`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

checkUserRoles().catch(console.error);
