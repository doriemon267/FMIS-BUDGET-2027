const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserAccess() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const UserAssignment = require('./models/HierarchicalUserAssignment');
    const PersonnelService = require('./models/personnelServices');

    console.log('🔍 Checking Department user access to Division proposals...\n');

    // Get Department user details
    const deptUser = await UserAssignment.findOne({
      userId: '751754',
      assignmentLevel: 'DEPARTMENT'
    });

    console.log('👤 Department User Details:');
    console.log(`User ID: ${deptUser.userId}`);
    console.log(`Assignment Level: ${deptUser.assignmentLevel}`);
    console.log(`Region ID: ${deptUser.regionId || 'NULL'}`);
    console.log(`Department ID: ${deptUser.departmentId || 'NULL'}`);
    console.log(`Division: ${deptUser.divisionName || 'NULL'}`);

    // Check what proposals this user should see
    const userRegion = deptUser.regionId?.Region;
    const userDepartment = deptUser.departmentId?.Department;

    console.log(`\n🎯 User should see proposals from:`);
    console.log(`Region: ${userRegion || 'ANY'}`);
    console.log(`Department: ${userDepartment || 'ANY'}`);

    // Check proposals that match user's scope
    let query = { originalLevel: 'DIVISION', status: 'Division Submitted' };
    if (userRegion) query.region = userRegion;
    if (userDepartment) query.department = userDepartment;

    const visibleProposals = await PersonnelService.countDocuments(query);
    console.log(`\n✅ Proposals this user should see: ${visibleProposals}`);

    // Show sample of what they should see
    const sampleProposals = await PersonnelService.find(query)
      .select('_id status region department division')
      .limit(3);

    console.log('\n📋 Sample proposals user should see:');
    sampleProposals.forEach((p, i) => {
      console.log(`${i + 1}. ${p.region} > ${p.department} > ${p.division}`);
      console.log(`   Status: ${p.status}`);
    });

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUserAccess();