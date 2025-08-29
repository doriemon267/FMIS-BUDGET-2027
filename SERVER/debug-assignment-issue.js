require('dotenv').config();
const mongoose = require('mongoose');

async function debugAssignmentIssue() {
  console.log('🔍 Debugging assignment save issue...');
  
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to database');
    
    // Check what regions and departments are available
    const regions = await mongoose.connection.db.collection('regions').find({}).toArray();
    const departments = await mongoose.connection.db.collection('departments').find({}).toArray();
    const mappings = await mongoose.connection.db.collection('departmentdivisionmappings').find({}).toArray();
    
    console.log('\n📍 Available Regions:');
    regions.slice(0, 3).forEach(r => console.log(`- ${r._id}: ${r.regionName || r.RegionName || 'Unknown'}`));
    
    console.log('\n🏢 Available Departments:');
    departments.slice(0, 3).forEach(d => console.log(`- ${d._id}: ${d.departmentName || d.DepartmentName || 'Unknown'}`));
    
    console.log('\n🗂️ Department-Division Mappings:');
    mappings.forEach(m => {
      const divisionNames = m.divisions.map(div => div.name || div.divisionName || div).join(', ');
      console.log(`- ${m.departmentName}: [${divisionNames}]`);
    });
    
    // Check if there are any existing assignments
    const existingAssignments = await mongoose.connection.db.collection('hierarchicalassignments').find({}).toArray();
    console.log(`\n📊 Existing assignments: ${existingAssignments.length}`);
    
    console.log('\n✨ To fix frontend save issues:');
    console.log('1. Make sure Region ID matches one from above');
    console.log('2. Make sure Department ID matches one from above');
    console.log('3. Make sure Division name exactly matches one from mappings');
    console.log('4. Check browser console for "🚀 Submitting assignment data:" log');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debugAssignmentIssue();
