require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');
const Proposal = require('./models/Proposal');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING FOR LEGACY PROPOSAL LINK ===');
    const proposal = await NewProposalWorkflow.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' }).lean();
    
    if (proposal) {
      console.log('workflowRef:', proposal.workflowRef);
      console.log('legacyProposalId:', proposal.legacyProposalId);
      
      // Try to find legacy proposal
      if (proposal.workflowRef) {
        const legacy = await Proposal.findById(proposal.workflowRef).lean();
        if (legacy) {
          console.log('\nLegacy Proposal Found:');
          console.log('  Division:', legacy.division);
          console.log('  Department:', legacy.department);
          console.log('  Region:', legacy.region);
          console.log('  isCentralOffice:', legacy.isCentralOffice);
        } else {
          console.log('workflowRef provided but legacy proposal not found');
        }
      }
      
      // Check if proposal has HierarchicalUserAssignment data
      console.log('\n=== CHECKING USER ASSIGNMENT FOR ORGANIZATIONAL DATA ===');
      const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
      const createdBy = proposal.createdBy;
      console.log('Created by user ID:', createdBy);
      
      const assignment = await HierarchicalUserAssignment.findOne({ userId: createdBy }).lean();
      if (assignment) {
        console.log('User Assignment Found:');
        console.log('  Department:', assignment.department);
        console.log('  Division:', assignment.division);
        console.log('  Region:', assignment.region);
      } else {
        console.log('No user assignment found');
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
