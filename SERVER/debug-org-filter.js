require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
const Proposal = require('./models/Proposal');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n===== HIERARCHICAL USER ASSIGNMENT DEBUG =====\n');
    
    // Find Budget Approver user (userId 751754)
    const budgetApprover = await HierarchicalUserAssignment.findOne({ userId: '751754' }).lean();
    console.log('Budget Approver Assignment:');
    console.log(JSON.stringify(budgetApprover, null, 2));
    
    console.log('\n===== PROPOSALS DEBUG =====\n');
    
    // Find all proposals
    const proposals = await Proposal.find().select('_id division department region responsibilityCenter').lean().limit(5);
    console.log('Sample Proposals (first 5):');
    proposals.forEach((p, i) => {
      console.log(`\n[${i+1}] Proposal ID: ${p._id}`);
      console.log(`    Division: ${p.division}`);
      console.log(`    Department: ${p.department}`);
      console.log(`    Region: ${p.region}`);
      console.log(`    ResponsibilityCenter: ${p.responsibilityCenter}`);
    });
    
    // Check what divisions and departments exist
    const divisions = await Proposal.distinct('division');
    const departments = await Proposal.distinct('department');
    const regions = await Proposal.distinct('region');
    
    console.log('\n===== UNIQUE VALUES IN DATABASE =====\n');
    console.log('Divisions:', divisions);
    console.log('Departments:', departments);
    console.log('Regions:', regions);
    
    await mongoose.disconnect();
    console.log('\n✓ Debug complete');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
