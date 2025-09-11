const mongoose = require('mongoose');
const { setupDepartmentDivisionMappings } = require('./setupDepartmentDivisionMappings');
/**
 * Updated Quick setup script for Hierarchical RBAC system with dynamic department-division mappings
 * This sets up department-division mappings and creates sample assignments
 */
async function quickSetupHierarchicalRBACWithMappings() {
  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
      }
    // Step 1: Setup Department-Division Mappings
    const mappingResult = await setupDepartmentDivisionMappings();
    if (mappingResult.success) {
      } else {
      return;
    }
    // Step 2: Create sample regions if they don't exist
    const Region = require('../models/Region');
    const regionCount = await Region.countDocuments();
    if (regionCount === 0) {
      await Region.insertMany([
        { Region: 'NCR', RegionCode: 'NCR', isActive: true },
        { Region: 'Region IV-A (CALABARZON)', RegionCode: 'R4A', isActive: true },
        { Region: 'Region VII (Central Visayas)', RegionCode: 'R7', isActive: true }
      ]);
      } else {
      }
    // Step 3: Create sample hierarchical assignments
    const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    // Get first region and departments for sample data
    const firstRegion = await Region.findOne({});
    const departmentsWithDivisions = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    if (!firstRegion) {
      return;
    }
    if (departmentsWithDivisions.length === 0) {
      return;
    }
    // Clear existing assignments
    await UserOrganizationalAssignment.deleteMany({});
    const sampleAssignments = [
      // Full Access Admin
      {
        userId: 'admin001',
        userName: 'System Administrator',
        email: 'admin@fmis.gov.ph',
        accessScope: 'FULL',
        regions: [],
        departments: [],
        divisions: [],
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: true,
          canDeleteProposals: true,
          canApproveProposals: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: true
        }
      },
      // Division Level Users
      {
        userId: 'div001',
        userName: 'Planning Division Manager',
        email: 'planning.div@fmis.gov.ph',
        accessScope: 'DIVISION',
        regions: [firstRegion._id],
        departments: [departmentsWithDivisions[0].departmentId],
        divisions: [departmentsWithDivisions[0].divisions[0].name],
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: false,
          canDeleteProposals: false,
          canApproveProposals: false,
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false
        }
      },
      {
        userId: 'div002',
        userName: 'Engineering Division Head',
        email: 'eng.div@fmis.gov.ph',
        accessScope: 'DIVISION',
        regions: [firstRegion._id],
        departments: [departmentsWithDivisions[1]?.departmentId || departmentsWithDivisions[0].departmentId],
        divisions: [departmentsWithDivisions[1]?.divisions[0].name || departmentsWithDivisions[0].divisions[1]?.name || departmentsWithDivisions[0].divisions[0].name],
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: false,
          canDeleteProposals: false,
          canApproveProposals: false,
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false
        }
      },
      // Department Level User
      {
        userId: 'dept001',
        userName: 'Department Head - Operations',
        email: 'ops.dept@fmis.gov.ph',
        accessScope: 'DEPARTMENT',
        regions: [firstRegion._id],
        departments: [departmentsWithDivisions[2]?.departmentId || departmentsWithDivisions[0].departmentId],
        divisions: [],
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: true,
          canDeleteProposals: false,
          canApproveProposals: true,
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false
        }
      },
      // Region Level User  
      {
        userId: 'reg001',
        userName: 'Regional Director',
        email: 'regional.dir@fmis.gov.ph',
        accessScope: 'REGION',
        regions: [firstRegion._id],
        departments: [],
        divisions: [],
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: true,
          canDeleteProposals: true,
          canApproveProposals: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: false
        }
      }
    ];
    let successfulAssignments = 0;
    for (const assignmentData of sampleAssignments) {
      try {
        const assignment = new UserOrganizationalAssignment(assignmentData);
        await assignment.save();
        successfulAssignments++;
        } catch (error) {
        }
    }
    // Step 4: Verification
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    .length}`);
    => sum + dept.divisions.length, 0)}`);
    structure.departments.filter(d => d.hasSubDivisions).forEach(dept => {
      dept.divisions.forEach(div => {
        `);
      });
    });
    // Display created assignments
    const assignments = await UserOrganizationalAssignment.find({}).populate('regions departments');
    assignments.forEach(assignment => {
      `);
      if (assignment.regions.length > 0) {
        .join(', ')}`);
      }
      if (assignment.departments.length > 0) {
        .join(', ')}`);
      }
      if (assignment.divisions.length > 0) {
        }`);
      }
    });
    } catch (error) {
    console.error('❌ Quick setup failed:', error);
    throw error;
  }
}
// Export for use in other scripts
module.exports = {
  quickSetupHierarchicalRBACWithMappings
};
// If run directly, execute setup
if (require.main === module) {
  quickSetupHierarchicalRBACWithMappings()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}