// Quick script to check proposal assignment details
require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

async function checkProposalAssignments() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget');

    console.log('=== CHECKING PROPOSAL ASSIGNMENTS ===\n');

    // Get all proposals with relevant fields
    const proposals = await Proposal.find().select('title status currentAssigneeRole pendingWithRoles division department region createdByUserId');

    console.log(`Total Proposals: ${proposals.length}\n`);

    proposals.forEach((p, index) => {
      console.log(`${index + 1}. ${p.title}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Current Assignee Role: ${p.currentAssigneeRole || 'N/A'}`);
      console.log(`   Pending With Roles: ${p.pendingWithRoles ? p.pendingWithRoles.join(', ') : 'N/A'}`);
      console.log(`   Division: ${p.division || 'N/A'}`);
      console.log(`   Department: ${p.department || 'N/A'}`);
      console.log(`   Region: ${p.region || 'N/A'}`);
      console.log(`   Created By: ${p.createdByUserId || 'N/A'}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProposalAssignments();