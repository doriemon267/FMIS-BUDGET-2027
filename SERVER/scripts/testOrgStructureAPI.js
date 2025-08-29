const mongoose = require('mongoose');

async function testOrgStructureDirectly() {
  try {
    console.log('🔄 Testing organization structure directly...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
    console.log('✅ Connected to MongoDB');
    
    // Import models to register them
    const Region = require('../models/Region');
    const Department = require('../models/Department');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    
    // Test the getCompleteOrganizationStructure method
    console.log('\n📋 Testing getCompleteOrganizationStructure...');
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    
    console.log('\n📊 Organization Structure Results:');
    console.log(`Regions: ${structure.regions.length}`);
    console.log(`Departments: ${structure.departments.length}`);
    console.log(`Mappings: ${structure.mappings.length}`);
    
    console.log('\n🏢 Regions:');
    structure.regions.forEach(region => {
      console.log(`  - ${region.name} (${region.id})`);
    });
    
    console.log('\n🏬 Departments:');
    structure.departments.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.id}) - Has divisions: ${dept.hasSubDivisions} - Divisions: ${dept.divisions.length}`);
      if (dept.divisions.length > 0) {
        dept.divisions.forEach(div => {
          console.log(`    └── ${div.name} (${div.code})`);
        });
      }
    });
    
    // Test getDepartmentsWithDivisions
    console.log('\n📂 Testing getDepartmentsWithDivisions...');
    const departmentsWithDivisions = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    console.log(`Departments with divisions: ${departmentsWithDivisions.length}`);
    
    departmentsWithDivisions.forEach(dept => {
      console.log(`\n  📂 ${dept.departmentName}`);
      dept.divisions.forEach(div => {
        console.log(`    ├── ${div.name} (${div.code})`);
      });
    });
    
    // Create the response structure that the API should return
    const apiResponse = {
      hierarchy: 'Division → Department → Region',
      consolidationFlow: {
        'DIVISION': 'Proposals consolidate to Department level',
        'DEPARTMENT': 'Proposals consolidate to Region level',
        'REGION': 'Proposals remain at Region level',
        'FULL': 'Can access all organizational levels',
        'OWN_ONLY': 'Access limited to own records only'
      },
      availableUnits: {
        regions: structure.regions,
        departments: structure.departments,
        departmentsWithDivisions: departmentsWithDivisions,
        allDivisions: structure.departments
          .filter(dept => dept.hasSubDivisions)
          .reduce((divisions, dept) => {
            dept.divisions.forEach(div => {
              divisions.push({
                name: div.name,
                code: div.code,
                departmentId: dept.id,
                departmentName: dept.name
              });
            });
            return divisions;
          }, [])
      },
      mappings: structure.mappings
    };
    
    console.log('\n🚀 API Response Structure:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
    console.log('\n✅ Organization structure test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testOrgStructureDirectly();
}

module.exports = { testOrgStructureDirectly };
