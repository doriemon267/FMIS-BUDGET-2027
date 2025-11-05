/**
 * Search for user 416461 in different formats
 * Run: node find-user-416461.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function findUser() {
  try {
    const mongoUrl = process.env.MONGODB_BUDGET_URL || process.env.MONGO_URI;
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB\n');

    // Try different formats
    const candidates = ['416461', 416461, '416461', Number(416461)];
    
    console.log('🔍 Searching for user with ID "416461" in different formats...\n');

    for (const candidate of candidates) {
      const user = await User.findOne({ userId: candidate });
      if (user) {
        console.log('✅ FOUND user with userId:', candidate);
        console.log('   ID type:', typeof candidate);
        console.log('   Name:', user.name);
        console.log('   Email:', user.email);
        console.log('   Roles:', user.roles);
        console.log('');
      }
    }

    // Also search by other fields
    console.log('🔍 Searching in HierarchicalUserAssignment...\n');
    const assignmentsByString = await HierarchicalUserAssignment.findOne({ userId: '416461' });
    const assignmentsByNumber = await HierarchicalUserAssignment.findOne({ userId: 416461 });

    if (assignmentsByString) {
      console.log('✅ FOUND HierarchicalUserAssignment with userId "416461" (string)');
      console.log('   Workflow Roles:', assignmentsByString.workflowRoles);
      console.log('');
    }
    if (assignmentsByNumber) {
      console.log('✅ FOUND HierarchicalUserAssignment with userId 416461 (number)');
      console.log('   Workflow Roles:', assignmentsByNumber.workflowRoles);
      console.log('');
    }

    // Get sample users to see format
    console.log('📋 Sample users in database:');
    const sampleUsers = await User.find().limit(5);
    sampleUsers.forEach(u => {
      console.log(`   - ${u.name} (userId: "${u.userId}" [${typeof u.userId}])`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findUser();