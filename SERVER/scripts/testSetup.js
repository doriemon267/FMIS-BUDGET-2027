const mongoose = require('mongoose');

async function testSetup() {
  try {
    console.log('🔄 Testing database setup...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
    console.log('✅ Connected to MongoDB');
    
    // Test model imports
    const Department = require('../models/Department');
    const Region = require('../models/Region');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    
    console.log('✅ Models imported successfully');
    
    // Test basic queries
    const deptCount = await Department.countDocuments();
    const regionCount = await Region.countDocuments();
    const mappingCount = await DepartmentDivisionMapping.countDocuments();
    
    console.log(`📊 Current counts:`);
    console.log(`   Departments: ${deptCount}`);
    console.log(`   Regions: ${regionCount}`);
    console.log(`   Mappings: ${mappingCount}`);
    
    // Test if we can create a simple department
    console.log('\n🧪 Testing department creation...');
    const testDept = new Department({ 
      Department: 'Test Department - ' + Date.now() 
    });
    await testDept.save();
    console.log('✅ Test department created successfully');
    
    // Clean up
    await Department.deleteOne({ _id: testDept._id });
    console.log('✅ Test department cleaned up');
    
    console.log('\n🎉 Database setup test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testSetup();
}
