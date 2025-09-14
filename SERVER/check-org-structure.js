/**
 * Check regions and departments for proper assignment
 */
const mongoose = require('mongoose');
const Region = require('./models/Region');
const Department = require('./models/Department');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    // Check regions
    const regions = await Region.find({}).lean();
    console.log('\n🌍 Available Regions:');
    regions.forEach((region, i) => {
      console.log(`${i+1}. ID: ${region._id} - Name: ${region.Region || region.regionName || region.name}`);
    });
    
    // Check departments  
    const departments = await Department.find({}).lean();
    console.log('\n🏢 Available Departments:');
    departments.forEach((dept, i) => {
      console.log(`${i+1}. ID: ${dept._id} - Name: ${dept.Department || dept.departmentName || dept.name}`);
    });
    
    // Find the specific IDs from the assignment
    const regionId = '68be0fba37907a9f5551c935';
    const departmentId = '68be0fba37907a9f5551c93f';
    
    const specificRegion = await Region.findById(regionId).lean();
    const specificDepartment = await Department.findById(departmentId).lean();
    
    console.log('\n🎯 Nelson\'s Assignment Details:');
    console.log(`Region: ${specificRegion?.Region || specificRegion?.regionName || 'N/A'}`);
    console.log(`Department: ${specificDepartment?.Department || specificDepartment?.departmentName || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();