// Quick script to check proposals in database
require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

async function checkProposals() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    
    console.log('=== CHECKING PROPOSALS IN DATABASE ===\n');
    
    // Count total proposals
    const total = await Proposal.countDocuments();
    console.log(`Total Proposals: ${total}\n`);
    
    // Count by status
    const statuses = await Proposal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('Proposals by Status:');
    statuses.forEach(s => {
      console.log(`  ${s._id || '(no status)'}: ${s.count}`);
    });
    
    console.log('\n=== Statuses BUDGET_OFFICER can see ===');
    const officerStatuses = [
      'Division Submitted',
      'DIVISION SUBMITTED',
      'Department Verified',
      'DEPARTMENT VERIFIED',
      'Department Submitted',
      'DEPARTMENT SUBMITTED',
      'Office',
      'Office Verified',
      'OFFICE VERIFIED',
      'Office Submitted',
      'OFFICE SUBMITTED',
      'Office Approved',
      'OFFICE APPROVED',
      'Region Approved',
      'REGION APPROVED',
      'Finalized',
      'Approved',
      'Submitted'
    ];
    
    const officerVisibleCount = await Proposal.countDocuments({
      status: { $in: officerStatuses }
    });
    
    console.log(`BUDGET_OFFICER should see: ${officerVisibleCount} proposals`);
    console.log('(Plus their own proposals regardless of status)\n');
    
    // Show sample proposals
    const samples = await Proposal.find().limit(10).select('title status createdByUserId division department region fiscalYear');
    console.log('Sample Proposals:');
    samples.forEach(p => {
      console.log(`  - ${p.title} | Status: ${p.status} | Division: ${p.division} | CreatedBy: ${p.createdByUserId}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProposals();