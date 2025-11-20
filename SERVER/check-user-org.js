require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING USER 345220 ASSIGNMENT ===');
    const db = mongoose.connection.db;
    
    // Get the proposal
    const nprCollection = db.collection('newproposalworkflows');
    const nprRecord = await nprCollection.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' });
    
    console.log('Proposal created by:', nprRecord.createdBy);
    
    // Check HierarchicalUserAssignment
    const hierCollection = db.collection('hierarchicaluserassignments');
    const hier = await hierCollection.findOne({ userId: nprRecord.createdBy });
    
    if (hier) {
      console.log('\nHierarchical User Assignment found:');
      console.log('  userId:', hier.userId);
      console.log('  department:', hier.department);
      console.log('  division:', hier.division);
      console.log('  region:', hier.region);
      console.log('  office:', hier.office);
      console.log('  isCentralOffice:', hier.isCentralOffice);
    } else {
      console.log('No hierarchical assignment found');
    }
    
    // Check UserOrganizationalAssignment
    const userOrgCollection = db.collection('userorganizationalassignments');
    const userOrg = await userOrgCollection.findOne({ userId: nprRecord.createdBy });
    
    if (userOrg) {
      console.log('\nUser Organizational Assignment found:');
      console.log('  userId:', userOrg.userId);
      console.log('  department:', userOrg.department);
      console.log('  division:', userOrg.division);
      console.log('  region:', userOrg.region);
      console.log('  office:', userOrg.office);
      console.log('  isCentralOffice:', userOrg.isCentralOffice);
    } else {
      console.log('No user organizational assignment found');
    }
    
    // List all user assignments for this user
    console.log('\n=== ALL ASSIGNMENTS FOR USER 345220 ===');
    const allAssignments = await hierCollection.find({ userId: nprRecord.createdBy }).toArray();
    console.log(`Found ${allAssignments.length} assignments`);
    allAssignments.forEach((a, i) => {
      console.log(`\n  Assignment ${i+1}:`);
      console.log(`    department: ${a.department}`);
      console.log(`    division: ${a.division}`);
      console.log(`    region: ${a.region}`);
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
