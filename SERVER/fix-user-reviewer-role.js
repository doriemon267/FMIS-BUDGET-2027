/**
 * Fix script: Add BUDGET REVIEWER role to user
 * Run: node fix-user-reviewer-role.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const userId = process.env.FIX_USER_ID || 'YOUR_USER_ID_HERE';

async function fixUserReviewerRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      process.exit(1);
    }

    console.log('👤 Found user:', user.email || user.name);
    console.log('   Current roles:', user.Roles || '(none)');

    // Step 2: Add BUDGET REVIEWER role if missing
    if (!user.Roles) {
      user.Roles = [];
    }

    if (!user.Roles.includes('BUDGET REVIEWER')) {
      user.Roles.push('BUDGET REVIEWER');
      await user.save();
      console.log('\n✅ Added "BUDGET REVIEWER" role to user');
    } else {
      console.log('\n✅ User already has "BUDGET REVIEWER" role');
    }

    // Step 3: Check/create hierarchical assignment
    let assignment = await HierarchicalUserAssignment.findOne({ userId });
    
    if (!assignment) {
      console.log('\n📝 Creating HierarchicalUserAssignment...');
      assignment = new HierarchicalUserAssignment({
        userId,
        assignmentLevel: 'DIVISION',
        workflowRoles: ['divisionReviewer'],
        isActive: true
      });
      await assignment.save();
      console.log('✅ Created assignment with divisionReviewer role');
    } else {
      console.log('\n📝 Updating existing HierarchicalUserAssignment...');
      if (!assignment.workflowRoles) {
        assignment.workflowRoles = [];
      }
      if (!assignment.workflowRoles.includes('divisionReviewer')) {
        assignment.workflowRoles.push('divisionReviewer');
        await assignment.save();
        console.log('✅ Added divisionReviewer to workflow roles');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log('  User Roles:', user.Roles);
    console.log('  Workflow Roles:', assignment.workflowRoles);
    console.log('\n💡 Next: Clear browser cache and refresh the page');
    console.log('   The "Detailed Records" section should now appear!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🔧 Fixing Budget Reviewer role...\n');
console.log('User ID:', userId);
console.log('');

if (userId === 'YOUR_USER_ID_HERE') {
  console.log('❌ Please set FIX_USER_ID environment variable');
  console.log('   Example: FIX_USER_ID=YOUR_ID node fix-user-reviewer-role.js');
  process.exit(1);
}

fixUserReviewerRole();