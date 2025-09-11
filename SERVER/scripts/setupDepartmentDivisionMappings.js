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
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/fmis-budget');
      }
    // Clear existing mappings
    await DepartmentDivisionMapping.deleteMany({});
    let successCount = 0;
    let errorCount = 0;
    for (const deptData of departmentDivisionData) {
      try {
        // Find the department by name
        const department = await Department.findOne({ 
          Department: { $regex: new RegExp(deptData.departmentName, 'i') }
        });
        if (!department) {
          // Create the department if it doesn't exist
          const newDepartment = new Department({
            Department: deptData.departmentName,
            DepartmentCode: deptData.departmentName.split(' ').map(word => word.charAt(0)).join('').toUpperCase(),
            isActive: true
          });
          await newDepartment.save();
          // Create mapping with the new department
          const mapping = new DepartmentDivisionMapping({
            departmentId: newDepartment._id,
            departmentName: deptData.departmentName,
            divisions: deptData.divisions,
            hasSubDivisions: deptData.hasSubDivisions
          });
          await mapping.save();
          successCount++;
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
          }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error creating mapping for ${deptData.departmentName}:`, error.message);
      }
    }
    => sum + dept.divisions.length, 0)}`);
    // Verify the setup
    const allMappings = await DepartmentDivisionMapping.find({}).populate('departmentId');
    // Display structure
    for (const mapping of allMappings) {
      if (mapping.hasSubDivisions && mapping.divisions.length > 0) {
        mapping.divisions.forEach(division => {
          `);
        });
      } else {
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
    mappings.forEach(mapping => {
      mapping.divisions.forEach(division => {
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
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    .length}`);
    => sum + dept.divisions.length, 0)}`);
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
            }
        }
      }
    }
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
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}