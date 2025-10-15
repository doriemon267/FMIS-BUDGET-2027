require('dotenv').config();
const mongoose = require('mongoose');

async function checkBudgetUsers() {
  try {
    const budgetUrl = process.env.MONGODB_BUDGET_URL;
    console.log('Connecting to:', budgetUrl);
    
    await mongoose.connect(budgetUrl);
    console.log('✅ Connected\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const count = await User.countDocuments();
    console.log('📊 Users in fmis_budget:');
    console.log('  Total users:', count);
    
    if (count > 0) {
      const samples = await User.find().limit(10);
      console.log('\n  Sample users:');
      samples.forEach(u => {
        console.log(`\n    ${u.userName || u.username} (${u.userId || u._id})`);
        console.log(`      Email: ${u.email || '—'}`);
        console.log(`      Role: ${u.role || u.userRole || u.primaryRole || '—'}`);
        console.log(`      Budget Roles: ${(u.budgetRoles || []).join(', ') || '—'}`);
        console.log(`      Level: ${u.assignmentLevel || u.accessScope || '—'}`);
        console.log(`      Region: ${u.region || '—'}`);
        console.log(`      Office: ${u.office || '—'}`);
        console.log(`      Division: ${u.division || '—'}`);
        console.log(`      Active: ${u.isActive !== false}`);
      });
      
      console.log('\n\n  Field structure of first user:');
      const first = samples[0].toObject();
      console.log('  ', Object.keys(first));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkBudgetUsers();
