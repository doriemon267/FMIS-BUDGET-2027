const mongoose = require('mongoose');
async function testSetup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
    // Test model imports
    const Department = require('../models/Department');
    const Region = require('../models/Region');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    // Test basic queries
    const deptCount = await Department.countDocuments();
    const regionCount = await Region.countDocuments();
    const mappingCount = await DepartmentDivisionMapping.countDocuments();
    // Test if we can create a simple department
    const testDept = new Department({ 
      Department: 'Test Department - ' + Date.now() 
    });
    await testDept.save();
    // Clean up
    await Department.deleteOne({ _id: testDept._id });
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
if (require.main === module) {
  testSetup();
}