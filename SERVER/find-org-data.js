require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING ALL COLLECTIONS WITH PROPOSAL DATA ===');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('Available collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    console.log('\n=== SEARCHING FOR RECORDS WITH DIVISION/DEPARTMENT ===');
    
    // Check MOOE collections
    const mooeCollection = db.collection('mooeproposals');
    const mooeCount = await mooeCollection.countDocuments();
    console.log(`\nMOOE Proposals: ${mooeCount} records`);
    
    if (mooeCount > 0) {
      const mooeRecord = await mooeCollection.findOne({});
      console.log('Sample MOOE record:');
      console.log(`  Title: ${mooeRecord.title}`);
      console.log(`  Division: ${mooeRecord.division}`);
      console.log(`  Department: ${mooeRecord.department}`);
      console.log(`  isCentralOffice: ${mooeRecord.isCentralOffice}`);
    }
    
    // Check if there's a mapping between NewProposalWorkflow and MOOE
    console.log('\n=== CHECKING NEWPROPOSALWORKFLOW ===');
    const nprCollection = db.collection('newproposalworkflows');
    const nprRecord = await nprCollection.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' });
    if (nprRecord) {
      console.log('Sample NewProposalWorkflow record fields:');
      Object.keys(nprRecord).forEach(key => {
        if (key.includes('proposal') || key.includes('mooe') || key.includes('link') || key.includes('ref')) {
          console.log(`  ${key}: ${nprRecord[key]}`);
        }
      });
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
