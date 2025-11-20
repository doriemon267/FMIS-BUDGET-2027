require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== DETAILED PROPOSAL INSPECTION ===');
    const proposal = await NewProposalWorkflow.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' }).lean();
    
    if (proposal) {
      console.log('All proposal fields:');
      Object.keys(proposal).forEach(key => {
        const value = proposal[key];
        if (typeof value === 'object' && value !== null) {
          console.log(`  ${key}: [Object] ${Object.keys(value).join(', ')}`);
        } else {
          console.log(`  ${key}:`, value);
        }
      });
      
      // Check if there's any organizational data embedded
      console.log('\n=== CHECKING ORGANIZATIONAL FIELDS ===');
      console.log('organizationalUnit:', proposal.organizationalUnit);
      console.log('division:', proposal.division);
      console.log('department:', proposal.department);
      console.log('officeCode:', proposal.officeCode);
      console.log('office:', proposal.office);
      
      // Check MOOE or legacy proposal structure
      console.log('\n=== CHECKING IF THIS CAME FROM MOOE ===');
      const MOOE = require('./models/MOOEProposal');
      const mooeProposal = await MOOE.findOne({ 
        createdBy: proposal.createdBy,
        fiscalYear: proposal.fiscalYear 
      }).lean();
      
      if (mooeProposal) {
        console.log('Found MOOE proposal:');
        console.log('  Division:', mooeProposal.division);
        console.log('  Department:', mooeProposal.department);
        console.log('  isCentralOffice:', mooeProposal.isCentralOffice);
      } else {
        console.log('No MOOE proposal found');
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
