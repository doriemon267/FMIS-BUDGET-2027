/**
 * Fix script to add BUDGET REVIEWER role to user 416461
 * Run: node fix-budget-reviewer-for-416461.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('./models/User');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const userId = '416461';

async function addBudgetReviewerRole() {
  try {
    const mongoUrl = process.env.MONGODB_BUDGET_URL || process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error('MONGODB_BUDGET_URL or MONGO_URI not set in .env');
    }
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Check current state
    console.log('🔍 Checking current state for user:', userId);
    const user = await User.findOne({ userId });
    if (user) {
      console.log('📋 User found:', user.name, '(' + user.email + ')');
      console.log('   Current roles in User collection:', user.roles || []);
    } else {
      console.log('⚠️  User not found in User collection (may not be critical)');
    }

    // Step 2: Check HierarchicalUserAssignment
    let assignment = await HierarchicalUserAssignment.findOne({ userId });
    if (assignment) {
      console.log('\n📊 Current HierarchicalUserAssignment:');
      console.log('   assignmentLevel:', assignment.assignmentLevel);
      console.log('   workflowRoles:', assignment.workflowRoles || []);
    } else {
      console.log('\n⚠️  No HierarchicalUserAssignment found - creating one');
    }

    // Step 3: Update HierarchicalUserAssignment
    if (!assignment) {
      console.log('\n❌ HierarchicalUserAssignment not found - cannot fix!');
      process.exit(1);
    }

    // Update existing assignment
    console.log('\n✨ Updating HierarchicalUserAssignment...');
    if (!assignment.workflowRoles) {
      assignment.workflowRoles = [];
    }
    
    if (!assignment.workflowRoles.includes('BUDGET REVIEWER')) {
      assignment.workflowRoles.push('BUDGET REVIEWER');
      console.log('   Adding "BUDGET REVIEWER" to workflowRoles');
    } else {
      console.log('   ✅ "BUDGET REVIEWER" already in workflowRoles');
    }

    // Save the updated assignment
    await assignment.save();
    console.log('✅ HierarchicalUserAssignment saved successfully!\n');

    // Step 4: Verify the update
    const updatedAssignment = await HierarchicalUserAssignment.findOne({ userId });
    console.log('📊 Updated HierarchicalUserAssignment:');
    console.log('   assignmentLevel:', updatedAssignment.assignmentLevel);
    console.log('   workflowRoles:', updatedAssignment.workflowRoles);
    console.log('\n✅ DONE! The "Detailed Records" section should now appear!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

console.log('🔧 Fixing BUDGET REVIEWER role for user 416461\n');
console.log('='.repeat(50) + '\n');

addBudgetReviewerRole();