const mongoose = require('mongoose');
require('dotenv').config();
const DepartmentDivisionMapping = require('../models/OrganizationStructure');
const Department = require('../models/Department');
const Region = require('../models/Region');

/**
 * Setup script to populate department-division mappings
 * This creates the hierarchical structure for departments and their divisions
 */

const departmentDivisionData = [
  {
    departmentName: 'Corporate Planning Services',
    hasSubDivisions: true,
    divisions: [
      { name: 'Planning & Programming Division', code: 'PPD', isActive: true },
      { name: 'Management Information Division', code: 'MID', isActive: true }
    ]
  },
  {
    departmentName: 'Engineering Department',
    hasSubDivisions: true,
    divisions: [
      { name: 'Project Planning Division', code: 'PPD', isActive: true },
      { name: 'Design and Specifications Division', code: 'DSD', isActive: true },
      { name: 'Construction Management Division', code: 'CMD', isActive: true }
    ]
  },
  {
    departmentName: 'Operations Department',
    hasSubDivisions: true,
    divisions: [
      { name: 'System Management Division', code: 'SMD', isActive: true },
      { name: 'Equipment Management Division', code: 'EMD', isActive: true },
      { name: 'Institutional Development Division', code: 'IDD', isActive: true },
      { name: 'Irrigation Engineering Division', code: 'IED', isActive: true }
    ]
  },
  {
    departmentName: 'Financial Management Department',
    hasSubDivisions: true,
    divisions: [
      { name: 'Accounting Division', code: 'AD', isActive: true },
      { name: 'Budget and Revenue Division', code: 'BRD', isActive: true },
      { name: 'Cash Division', code: 'CD', isActive: true }
    ]
  },
  {
    departmentName: 'Administrative Department',
    hasSubDivisions: true,
    divisions: [
      { name: 'Human Resources Division', code: 'HRD', isActive: true },
      { name: 'Procurement and Property Division', code: 'PPD', isActive: true },
      { name: 'General Services Division', code: 'GSD', isActive: true },
      { name: 'Civil Security Division', code: 'CSD', isActive: true },
      { name: 'Medical and Dental Division', code: 'MDD', isActive: true }
    ]
  }
];

async function setupDepartmentDivisionMappings() {
  try {
    console.log('🔄 Setting up department-division mappings...');
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/fmis-budget');
      console.log('✅ Connected to MongoDB');
    }
    
    // Clear existing mappings
    await DepartmentDivisionMapping.deleteMany({});
    console.log('🗑️ Cleared existing department-division mappings');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const deptData of departmentDivisionData) {
      try {
        // Find the department by name
        const department = await Department.findOne({ 
          Department: { $regex: new RegExp(deptData.departmentName, 'i') }
        });
        
        if (!department) {
          console.log(`⚠️ Department not found: ${deptData.departmentName}`);
          
          // Create the department if it doesn't exist
          const newDepartment = new Department({
            Department: deptData.departmentName,
            DepartmentCode: deptData.departmentName.split(' ').map(word => word.charAt(0)).join('').toUpperCase(),
            isActive: true
          });
          
          await newDepartment.save();
          console.log(`✅ Created new department: ${deptData.departmentName}`);
          
          // Create mapping with the new department
          const mapping = new DepartmentDivisionMapping({
            departmentId: newDepartment._id,
            departmentName: deptData.departmentName,
            divisions: deptData.divisions,
            hasSubDivisions: deptData.hasSubDivisions
          });
          
          await mapping.save();
          successCount++;
          console.log(`✅ Created mapping for: ${deptData.departmentName} with ${deptData.divisions.length} divisions`);
        } else {
          // Create mapping with existing department
          const mapping = new DepartmentDivisionMapping({
            departmentId: department._id,
            departmentName: deptData.departmentName,
            divisions: deptData.divisions,
            hasSubDivisions: deptData.hasSubDivisions
          });
          
          await mapping.save();
          successCount++;
          console.log(`✅ Created mapping for: ${deptData.departmentName} with ${deptData.divisions.length} divisions`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error creating mapping for ${deptData.departmentName}:`, error.message);
      }
    }
    
    console.log(`\n📊 Setup Summary:`);
    console.log(`✅ Successful mappings: ${successCount}`);
    console.log(`❌ Failed mappings: ${errorCount}`);
    console.log(`📈 Total divisions created: ${departmentDivisionData.reduce((sum, dept) => sum + dept.divisions.length, 0)}`);
    
    // Verify the setup
    const allMappings = await DepartmentDivisionMapping.find({}).populate('departmentId');
    console.log(`\n🔍 Verification: Found ${allMappings.length} department-division mappings`);
    
    // Display structure
    console.log('\n🏢 Department-Division Structure:');
    for (const mapping of allMappings) {
      console.log(`\n📂 ${mapping.departmentName}`);
      if (mapping.hasSubDivisions && mapping.divisions.length > 0) {
        mapping.divisions.forEach(division => {
          console.log(`   ├── ${division.name} (${division.code})`);
        });
      } else {
        console.log('   └── No divisions');
      }
    }
    
    return {
      success: true,
      successCount,
      errorCount,
      totalDivisions: departmentDivisionData.reduce((sum, dept) => sum + dept.divisions.length, 0)
    };
    
  } catch (error) {
    console.error('❌ Error setting up department-division mappings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getDepartmentsWithDivisions() {
  try {
    const mappings = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    console.log('\n🔍 Departments with Divisions:');
    mappings.forEach(mapping => {
      console.log(`\n📂 ${mapping.departmentName}`);
      mapping.divisions.forEach(division => {
        console.log(`   ├── ${division.name}`);
      });
    });
    return mappings;
  } catch (error) {
    console.error('Error getting departments with divisions:', error);
    return [];
  }
}

async function validateDepartmentDivisionSetup() {
  try {
    console.log('\n🔄 Validating department-division setup...');
    
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    
    console.log(`\n📊 Validation Results:`);
    console.log(`📍 Total Regions: ${structure.regions.length}`);
    console.log(`🏢 Total Departments: ${structure.departments.length}`);
    console.log(`📂 Departments with Divisions: ${structure.departments.filter(d => d.hasSubDivisions).length}`);
    console.log(`📁 Total Divisions: ${structure.departments.reduce((sum, dept) => sum + dept.divisions.length, 0)}`);
    
    // Validate each department-division combination
    let validCombinations = 0;
    let invalidCombinations = 0;
    
    for (const dept of structure.departments) {
      if (dept.hasSubDivisions) {
        for (const division of dept.divisions) {
          const isValid = await DepartmentDivisionMapping.validateDepartmentDivisionCombination(dept.id, division.name);
          if (isValid) {
            validCombinations++;
          } else {
            invalidCombinations++;
            console.log(`⚠️ Invalid combination: ${dept.name} - ${division.name}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Valid combinations: ${validCombinations}`);
    console.log(`❌ Invalid combinations: ${invalidCombinations}`);
    
    return structure;
  } catch (error) {
    console.error('Error validating setup:', error);
    return null;
  }
}

// Export functions for use in other scripts
module.exports = {
  setupDepartmentDivisionMappings,
  getDepartmentsWithDivisions,
  validateDepartmentDivisionSetup,
  departmentDivisionData
};

// If run directly, execute setup
if (require.main === module) {
  setupDepartmentDivisionMappings()
    .then(() => {
      console.log('🎉 Department-division mapping setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}
