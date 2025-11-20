require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== FINDING BRD PROPOSAL AND MOOE CONNECTION ===');
    const db = mongoose.connection.db;
    
    const nprCollection = db.collection('newproposalworkflows');
    const nprRecord = await nprCollection.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' });
    
    if (nprRecord) {
      console.log('\nNewProposalWorkflow record:');
      console.log('  _id:', nprRecord._id);
      console.log('  title:', nprRecord.title);
      console.log('  createdBy:', nprRecord.createdBy);
      console.log('  fiscalYear:', nprRecord.fiscalYear);
      
      // Try to find matching MOOE proposal
      const mooeCollection = db.collection('mooeproposals');
      
      console.log('\n=== SEARCHING FOR MOOE MATCH ===');
      
      // Try multiple matching strategies
      const mooe1 = await mooeCollection.findOne({ 
        title: nprRecord.title,
        fiscalYear: nprRecord.fiscalYear 
      });
      
      const mooe2 = await mooeCollection.findOne({
        createdBy: nprRecord.createdBy,
        fiscalYear: nprRecord.fiscalYear
      });
      
      const mooe3 = await mooeCollection.findOne({
        createdBy: nprRecord.createdBy
      });
      
      if (mooe1) {
        console.log('Found by Title + FiscalYear:');
        console.log('  Division:', mooe1.division);
        console.log('  Department:', mooe1.department);
      }
      
      if (mooe2) {
        console.log('Found by CreatedBy + FiscalYear:');
        console.log('  Division:', mooe2.division);
        console.log('  Department:', mooe2.department);
      }
      
      if (mooe3) {
        console.log('Found by CreatedBy:');
        console.log('  Title:', mooe3.title);
        console.log('  Division:', mooe3.division);
        console.log('  Department:', mooe3.department);
        console.log('  isCentralOffice:', mooe3.isCentralOffice);
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
