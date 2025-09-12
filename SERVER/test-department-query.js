const mongoose = require('mongoose');
const PersonnelServices = require('./models/personnelServices');

// Connect to MongoDB - use your actual database server
mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testDepartmentQuery() {
  try {
    console.log('🧪 Testing department-level query simulation...');
    
    // Simulate the query that should be executed for department users
    const departmentQuery = {
      $and: [
        { region: "CENTRAL OFFICE" },
        { department: "CORPORATE PLANNING SERVICES" },
        {
          $or: [
            // 1. Department-level data (no division)
            {
              $and: [
                { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
              ]
            },
            // 2. Division data that has been SUBMITTED only
            {
              $and: [
                { division: { $exists: true, $ne: null, $ne: "" } },
                { status: { $in: ["Submitted", "Approved", "Completed"] } }
              ]
            }
          ]
        }
      ]
    };
    
    console.log('📋 Department query:', JSON.stringify(departmentQuery, null, 2));
    
    const departmentResults = await PersonnelServices.find(departmentQuery);
    console.log(`\n🏢 Department query results: ${departmentResults.length} records`);
    
    if (departmentResults.length > 0) {
      departmentResults.forEach((record, index) => {
        console.log(`\nDepartment Result ${index + 1}:`);
        console.log('- Employee Name:', record.employeeName);
        console.log('- Division:', record.division);
        console.log('- Status:', record.status);
        console.log('- Process By:', record.processBy);
      });
    }
    
    // Now test division query
    const divisionQuery = {
      $and: [
        { region: "CENTRAL OFFICE" },
        { department: "CORPORATE PLANNING SERVICES" },
        { division: "MANAGEMENT INFORMATION DIVISION" }
      ]
    };
    
    console.log('\n📋 Division query:', JSON.stringify(divisionQuery, null, 2));
    
    const divisionResults = await PersonnelServices.find(divisionQuery);
    console.log(`\n🏛️ Division query results: ${divisionResults.length} records`);
    
    if (divisionResults.length > 0) {
      divisionResults.forEach((record, index) => {
        console.log(`\nDivision Result ${index + 1}:`);
        console.log('- Employee Name:', record.employeeName);
        console.log('- Division:', record.division);
        console.log('- Status:', record.status);
        console.log('- Process By:', record.processBy);
      });
    }
    
    // Test what the current data looks like
    console.log('\n🔍 All current data status:');
    const allData = await PersonnelServices.find({});
    allData.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log('- Division:', record.division);
      console.log('- Status:', record.status);
      console.log('- Status Type:', typeof record.status);
      console.log('- Status === "Not Submitted"?', record.status === "Not Submitted");
      console.log('- Status in ["Submitted"]?', ["Submitted", "Approved", "Completed"].includes(record.status));
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testDepartmentQuery();
