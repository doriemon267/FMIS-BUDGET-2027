const mongoose = require('mongoose');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Models
const Region = require('./models/Region');
const Department = require('./models/Department');
const DepartmentDivisionMapping = require('./models/OrganizationStructure');

async function addCentralOfficeMappings() {
  try {
    // Find or create region
    let region = await Region.findOne({ Region: 'CENTRAL OFFICE' });
    if (!region) {
      region = new Region({ Region: 'CENTRAL OFFICE' });
      await region.save();
      console.log('✅ Created region: CENTRAL OFFICE');
    } else {
      console.log('✅ Found existing region: CENTRAL OFFICE');
    }

    // Departments data
    const departmentsData = [
      {
        name: 'PUBLIC AFFAIRS AND STAFF INFORMATION',
        divisions: []
      },
      {
        name: 'LEGAL SERVICES',
        divisions: []
      },
      {
        name: 'INTERNAL AUDIT SERVICES',
        divisions: [
          {
            name: 'ORGANIZATION & MANAGEMENT AUDIT DIVISION',
            sections: []
          },
          {
            name: 'FINANCIAL & OPERATIONS AUDIT DIVISION',
            sections: []
          }
        ]
      }
    ];

    for (const deptData of departmentsData) {
      // Find or create department
      let department = await Department.findOne({ Department: deptData.name.toUpperCase() });
      if (!department) {
        department = new Department({ Department: deptData.name.toUpperCase() });
        await department.save();
        console.log(`✅ Created department: ${deptData.name}`);
      } else {
        console.log(`✅ Found existing department: ${deptData.name}`);
      }

      // Check if mapping already exists
      const existingMapping = await DepartmentDivisionMapping.findOne({
        departmentId: department._id,
        regionId: region._id
      });

      if (existingMapping) {
        console.log(`⚠️  Mapping already exists for ${deptData.name} in CENTRAL OFFICE`);
        continue;
      }

      // Create mapping
      const mapping = new DepartmentDivisionMapping({
        departmentId: department._id,
        departmentName: deptData.name,
        divisions: deptData.divisions.map(div => ({
          name: div.name,
          code: div.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
          sections: div.sections.map(sec => ({
            name: sec,
            code: sec.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
            isActive: true
          })),
          isActive: true
        })),
        hasSubDivisions: deptData.divisions.length > 0,
        regionId: region._id
      });

      await mapping.save();
      console.log(`✅ Added mapping for ${deptData.name}`);
    }

    console.log('🎉 All mappings added successfully!');

  } catch (error) {
    console.error('❌ Error adding mappings:', error);
  }
}

async function main() {
  await connectDB();
  await addCentralOfficeMappings();
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
}

main().catch(console.error);