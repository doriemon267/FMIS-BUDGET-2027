require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');
const FiscalYear = require('./models/FiscalYear');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== ACTIVE FISCAL YEAR ===');
    const activeFY = await FiscalYear.findOne({ isActive: true }).lean();
    if (activeFY) {
      console.log('Active Fiscal Year:', activeFY.fiscalYear);
      console.log('Full record:', JSON.stringify(activeFY, null, 2));
    } else {
      console.log('No active fiscal year found');
    }
    
    console.log('\n=== ALL FISCAL YEARS ===');
    const allFY = await FiscalYear.find().lean();
    allFY.forEach(fy => {
      console.log(`${fy.fiscalYear} - Active: ${fy.isActive}`);
    });
    
    console.log('\n=== PROPOSAL DETAILS ===');
    const proposal = await NewProposalWorkflow.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' }).lean();
    if (proposal) {
      console.log('Proposal Title:', proposal.title || proposal.proposalTitle);
      console.log('Has division field:', 'division' in proposal);
      console.log('Division value:', proposal.division);
      console.log('Has department field:', 'department' in proposal);
      console.log('Department value:', proposal.department);
      console.log('Has isCentralOffice:', 'isCentralOffice' in proposal);
      console.log('isCentralOffice value:', proposal.isCentralOffice);
      
      console.log('\nAll proposal fields:');
      Object.keys(proposal).forEach(key => {
        console.log(`  ${key}:`, proposal[key]);
      });
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
