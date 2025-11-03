require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    // Use the correct environment variable from .env
    const dbUrl = process.env.MONGODB_BUDGET_URL;
    console.log('Connecting to budget database...');
    console.log('URL pattern:', dbUrl ? dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@') : 'undefined');

    if (!dbUrl) {
      console.error('❌ MONGODB_BUDGET_URL not found in .env file');
      console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGODB')));
      return;
    }

    await mongoose.connect(dbUrl);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    const count = await HierarchicalUserAssignment.countDocuments({
      workflowRoles: { $in: ['BUDGET PREPARER', 'divisionCreator', 'officeCreator'] }
    });

    console.log('✅ BUDGET PREPARER assignments found:', count);

    if (count > 0) {
      const sample = await HierarchicalUserAssignment.findOne({
        workflowRoles: { $in: ['BUDGET PREPARER', 'divisionCreator', 'officeCreator'] }
      });
      console.log('Sample user:', sample.userName);
      console.log('Roles:', sample.workflowRoles);
      console.log('Assignment level:', sample.assignmentLevel);
    } else {
      console.log('⚠️  No BUDGET PREPARER assignments found. Users may need workflow roles assigned.');
    }

    await mongoose.disconnect();
    console.log('✅ Database check complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();