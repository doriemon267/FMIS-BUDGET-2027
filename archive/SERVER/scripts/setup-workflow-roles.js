const mongoose = require('mongoose');
require('dotenv').config();

async function runSetup() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');

    const { setupDefaultWorkflowRoles } = require('../helpers/workflowRoleManager');
    console.log('🚀 Running setupDefaultWorkflowRoles...');
    const result = await setupDefaultWorkflowRoles();
    console.log('✅ Setup completed:', result);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runSetup();