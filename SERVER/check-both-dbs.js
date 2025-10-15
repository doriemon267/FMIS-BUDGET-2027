require('dotenv').config();
const mongoose = require('mongoose');

async function checkBothDBs() {
  try {
    // Check fmis_budget
    console.log('📦 Checking FMIS_BUDGET database...');
    const budgetUrl = process.env.MONGODB_BUDGET_URL;
    console.log('Connecting to:', budgetUrl);
    
    const budgetConn = await mongoose.createConnection(budgetUrl).asPromise();
    console.log('✅ Connected\n');

    const budgetCollections = await budgetConn.db.listCollections().toArray();
    console.log('Collections in fmis_budget:');
    budgetCollections.forEach(col => console.log('  -', col.name));
    
    // Check hierarchicaluserassignments
    if (budgetCollections.some(c => c.name === 'hierarchicaluserassignments')) {
      console.log('\n📊 hierarchicaluserassignments in fmis_budget:');
      const HUA = budgetConn.model('HUA', new mongoose.Schema({}, { strict: false }), 'hierarchicaluserassignments');
      const count = await HUA.countDocuments();
      console.log('  Total records:', count);
      
      if (count > 0) {
        const samples = await HUA.find().limit(3);
        console.log('\n  Sample records:');
        samples.forEach(s => {
          console.log(`    - ${s.userName} (${s.userId})`);
          console.log(`      Role: ${s.userRole || s.role}`);
          console.log(`      Level: ${s.assignmentLevel}`);
          console.log(`      Workflow Roles: ${(s.workflowRoles || []).join(', ')}`);
        });
      }
    }

    await budgetConn.close();
    
    // Also check fmis_main hierarchical assignments
    console.log('\n\n📦 Checking FMIS_MAIN database...');
    const mainUrl = process.env.MONGODB_MAIN_URL;
    console.log('Connecting to:', mainUrl);
    
    const mainConn = await mongoose.createConnection(mainUrl).asPromise();
    console.log('✅ Connected\n');

    const mainCollections = await mainConn.db.listCollections().toArray();
    
    if (mainCollections.some(c => c.name === 'hierarchicaluserassignments')) {
      console.log('📊 hierarchicaluserassignments in fmis_main:');
      const HUA2 = mainConn.model('HUA2', new mongoose.Schema({}, { strict: false }), 'hierarchicaluserassignments');
      const count2 = await HUA2.countDocuments();
      console.log('  Total records:', count2);
      
      if (count2 > 0) {
        const samples2 = await HUA2.find().limit(5);
        console.log('\n  Sample records:');
        samples2.forEach(s => {
          console.log(`    - ${s.userName} (${s.userId})`);
          console.log(`      Role: ${s.userRole || s.role}`);
          console.log(`      Level: ${s.assignmentLevel}`);
          console.log(`      Workflow Roles: ${(s.workflowRoles || []).join(', ')}`);
          console.log('');
        });
      }
    }

    await mainConn.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBothDBs();
