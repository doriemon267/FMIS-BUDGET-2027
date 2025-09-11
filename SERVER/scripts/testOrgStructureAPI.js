const mongoose = require('mongoose');
async function testOrgStructureDirectly() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
    // Import models to register them
    const Region = require('../models/Region');
    const Department = require('../models/Department');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    // Test the getCompleteOrganizationStructure method
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    structure.regions.forEach(region => {
      `);
    });
    structure.departments.forEach(dept => {
      - Has divisions: ${dept.hasSubDivisions} - Divisions: ${dept.divisions.length}`);
      if (dept.divisions.length > 0) {
        dept.divisions.forEach(div => {
          `);
        });
      }
    });
    // Test getDepartmentsWithDivisions
    const departmentsWithDivisions = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    departmentsWithDivisions.forEach(dept => {
      dept.divisions.forEach(div => {
        `);
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
    );
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