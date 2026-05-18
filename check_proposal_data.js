const mongoose = require('mongoose');
const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');
const Income = require('./SERVER/models/Income');
const CapitalOutlay = require('./SERVER/models/CapitalOutlay');

async function debug() {
  try {
    await mongoose.connect('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin');
    
    console.log('\n=== CHECKING PROPOSALS ===');
    const proposals = await NewProposalWorkflow.find({ title: /MARIIS/i })
      .select('_id title division status fiscalYear budgetType')
      .limit(5);
    
    console.log('Proposals with MARIIS:', JSON.stringify(proposals, null, 2));
    
    if (proposals.length === 0) {
      console.log('No MARIIS proposals found. Checking all recent proposals:');
      const recent = await NewProposalWorkflow.find({})
        .select('_id title division status fiscalYear budgetType createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
      console.log('Recent proposals:', JSON.stringify(recent, null, 2));
    }
    
    // Check specific proposal by ID (if provided)
    const proposalIds = proposals.map(p => p._id);
    
    if (proposalIds.length > 0) {
      console.log('\n=== CHECKING INCOME RECORDS ===');
      for (const propId of proposalIds) {
        console.log(`\nFor proposal ${propId}:`);
        
        // Check linked records
        const linkedIncome = await Income.find({ workflowRef: propId }).count();
        console.log(`  - Linked Income records (workflowRef): ${linkedIncome}`);
        
        // Check by division
        const divisionIncome = await Income.find({ division: /MARIIS|DIVISION 1/i }).count();
        console.log(`  - Income records by division: ${divisionIncome}`);
        
        // Show sample
        const sample = await Income.findOne({ workflowRef: propId }).select('_id workflowRef division amount');
        if (sample) {
          console.log('  - Sample linked record:', sample);
        }
      }
      
      console.log('\n=== CHECKING CAPITAL OUTLAY RECORDS ===');
      for (const propId of proposalIds) {
        console.log(`\nFor proposal ${propId}:`);
        
        // Check linked records
        const linkedCO = await CapitalOutlay.find({ workflowRef: propId }).count();
        console.log(`  - Linked Capital Outlay records (workflowRef): ${linkedCO}`);
        
        // Check by division
        const divisionCO = await CapitalOutlay.find({ division: /MARIIS|DIVISION 1/i }).count();
        console.log(`  - Capital Outlay records by division: ${divisionCO}`);
        
        // Show sample
        const sample = await CapitalOutlay.findOne({ workflowRef: propId }).select('_id workflowRef division amount');
        if (sample) {
          console.log('  - Sample linked record:', sample);
        }
      }
    }
    
    console.log('\n=== CHECKING DATA INTEGRITY ===');
    const totalIncome = await Income.countDocuments();
    const totalCO = await CapitalOutlay.countDocuments();
    console.log(`Total Income records in DB: ${totalIncome}`);
    console.log(`Total Capital Outlay records in DB: ${totalCO}`);
    
    // Check if any records have workflowRef
    const incomeWithRef = await Income.countDocuments({ workflowRef: { $exists: true, $ne: null } });
    const coWithRef = await CapitalOutlay.countDocuments({ workflowRef: { $exists: true, $ne: null } });
    console.log(`Income with workflowRef: ${incomeWithRef}`);
    console.log(`Capital Outlay with workflowRef: ${coWithRef}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debug();
