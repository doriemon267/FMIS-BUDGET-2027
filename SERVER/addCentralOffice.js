require('dotenv').config();
const mongoose = require('mongoose');
require('./config/mongo_db')();

async function addCentralOffice() {
  try {
    const Region = require('./models/Region');
    const Department = require('./models/Department');
    const DepartmentDivisionMapping = require('./models/OrganizationStructure');

    console.log('Adding Central Office data...');

    // Create Central Office region
    let centralOfficeRegion = await Region.findOne({ Region: 'CENTRAL OFFICE' });
    if (!centralOfficeRegion) {
      centralOfficeRegion = new Region({ Region: 'CENTRAL OFFICE' });
      await centralOfficeRegion.save();
      console.log('✅ Created Central Office region');
    }

    // Define Central Office departments and divisions
    const centralOfficeData = [
      {
        department: 'ADMINISTRATIVE DEPARTMENT',
        divisions: [
          'HUMAN RESOURCES DIVISION',
          'PROCUREMENT AND PROPERTY DIVISION',
          'GENERAL SERVICES DIVISION',
          'CIVIL SECURITY DIVISION',
          'MEDICAL AND DENTAL DIVISION'
        ]
      },
      {
        department: 'FINANCIAL MANAGEMENT DEPARTMENT',
        divisions: [
          'ACCOUNTING DIVISION',
          'BUDGET AND REVENUE DIVISION',
          'CASH DIVISION'
        ]
      },
      {
        department: 'OPERATIONS DEPARTMENT',
        divisions: [
          'SYSTEM MANAGEMENT DIVISION',
          'EQUIPMENT MANAGEMENT DIVISION',
          'INSTITUTIONAL DEVELOPMENT DIVISION',
          'IRRIGATION ENGINEERING DIVISION'
        ]
      },
      {
        department: 'ENGINEERING DEPARTMENT',
        divisions: [
          'PROJECT PLANNING DIVISION',
          'DESIGN AND SPECIFICATIONS DIVISION',
          'CONSTRUCTION MANAGEMENT DIVISION'
        ]
      },
      {
        department: 'CORPORATE PLANNING SERVICES',
        divisions: [
          'PLANNING & PROGRAMMING DIVISION',
          'MANAGEMENT INFORMATION DIVISION',
          'MANAGEMENT SERVICES DIVISION'
        ]
      }
    ];

    for (const deptData of centralOfficeData) {
      // Find or create department
      let department = await Department.findOne({ Department: deptData.department });
      if (!department) {
        department = new Department({ Department: deptData.department });
        await department.save();
      }

      // Create mapping
      const existingMapping = await DepartmentDivisionMapping.findOne({
        departmentId: department._id,
        regionId: centralOfficeRegion._id
      });

      if (!existingMapping) {
        const mapping = new DepartmentDivisionMapping({
          departmentId: department._id,
          departmentName: deptData.department,
          divisions: deptData.divisions.map(name => ({ name, code: name.toUpperCase().replace(/\s+/g, '_') })),
          hasSubDivisions: deptData.divisions.length > 0,
          regionId: centralOfficeRegion._id
        });
        await mapping.save();
        console.log(`✅ Created mapping for ${deptData.department} with ${deptData.divisions.length} divisions`);
      }
    }

    console.log('🎉 Central Office data added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding Central Office data:', error);
    process.exit(1);
  }
}

addCentralOffice();
