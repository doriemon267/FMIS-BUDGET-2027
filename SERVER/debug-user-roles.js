/**
 * Debug script to check current user's roles and assignments
 * Run: node debug-user-roles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('./models/User');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const userId = process.env.DEBUG_USER_ID || 'YOUR_USER_ID_HERE';

async function debugUserRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check in users collection
    const user = await User.findById(userId);
    if (user) {
      console.log('📋 USER FOUND:');
      console.log('  Name:', user.name);
      console.log('  Email:', user.email);
      console.log('  Roles:', user.Roles || user.roles || '❌ NO ROLES');
      console.log('');
    } else {
      console.log('❌ User NOT found by ID:', userId);
    }

    // Check hierarchical assignment
    const assignment = await HierarchicalUserAssignment.findOne({ userId });
    if (assignment) {
      console.log('📊 HIERARCHICAL ASSIGNMENT FOUND:');
      console.log('  Assignment Level:', assignment.assignmentLevel);
      console.log('  Workflow Roles:', assignment.workflowRoles);
      console.log('  Region:', assignment.regionId);
      console.log('  Department:', assignment.departmentId);
      console.log('');
    } else {
      console.log('❌ No HierarchicalUserAssignment found\n');
    }

    console.log('---\n');
    console.log('💡 WHAT THIS MEANS:\n');

    if (!user) {
      console.log('❌ User not found - check your userId');
    } else if (!user.Roles && !user.roles) {
      console.log('❌ User has NO ROLES assigned');
      console.log('   Fix: Add "BUDGET REVIEWER" role to user.Roles array');
    } else if (!user.Roles.includes('BUDGET REVIEWER')) {
      console.log('⚠️  User has roles but missing "BUDGET REVIEWER":');
      console.log('   Current roles:', user.Roles);
      console.log('   Fix: Add "BUDGET REVIEWER" to the roles array');
    }

    if (!assignment) {
      console.log('❌ No HierarchicalUserAssignment exists');
      console.log('   The system will use defaults based on user.Roles');
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🔍 Debugging user roles...\n');
console.log('Using User ID:', userId);
console.log('');

if (userId === 'YOUR_USER_ID_HERE') {
  console.log('❌ Please set DEBUG_USER_ID environment variable');
  console.log('   Example: DEBUG_USER_ID=YOUR_ID node debug-user-roles.js');
  process.exit(1);
}

debugUserRoles();