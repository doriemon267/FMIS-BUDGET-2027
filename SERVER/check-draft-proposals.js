require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING DRAFTPROPOSALS ===');
    const db = mongoose.connection.db;
    
    const nprCollection = db.collection('newproposalworkflows');
    const nprRecord = await nprCollection.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' });
    
    if (nprRecord) {
      console.log('NPR title:', nprRecord.title);
      
      const draftCollection = db.collection('draftproposals');
      const draft = await draftCollection.findOne({ 
        title: nprRecord.title 
      });
      
      if (draft) {
        console.log('\nFound Draft Proposal!');
        console.log('  Division:', draft.division);
        console.log('  Department:', draft.department);
        console.log('  isCentralOffice:', draft.isCentralOffice);
      } else {
        console.log('No draft proposal found');
        
        // List all draft proposals
        console.log('\nAll Draft Proposals:');
        const drafts = await draftCollection.find({}).limit(5).toArray();
        drafts.forEach(d => {
          console.log(`  - ${d.title || d._id}`);
        });
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
