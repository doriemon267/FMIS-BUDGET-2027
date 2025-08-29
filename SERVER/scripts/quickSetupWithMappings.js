const mongoose = require('mongoose');
const { setupDepartmentDivisionMappings } = require('./setupDepartmentDivisionMappings');

/**
 * Updated Quick setup script for Hierarchical RBAC system with dynamic department-division mappings
 * This sets up department-division mappings and creates sample assignments
 */

async function quickSetupHierarchicalRBACWithMappings() {
  try {
    console.log('🚀 Starting Quick Setup for Hierarchical RBAC System with Dynamic Mappings...\n');
    
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget');
      console.log('✅ Connected to MongoDB\n');
    }
    
    // Step 1: Setup Department-Division Mappings
    console.log('📋 Step 1: Setting up Department-Division Mappings...');
    const mappingResult = await setupDepartmentDivisionMappings();
    
    if (mappingResult.success) {
      console.log(`✅ Department-Division mapping setup completed successfully!`);
      console.log(`   - Departments with divisions: ${mappingResult.successCount}`);
      console.log(`   - Total divisions: ${mappingResult.totalDivisions}\n`);
    } else {
      console.log(`❌ Department-Division mapping setup failed: ${mappingResult.error}\n`);
      return;
    }
    
    // Step 2: Create sample regions if they don't exist
    console.log('🌍 Step 2: Ensuring regions exist...');
    const Region = require('../models/Region');
    const regionCount = await Region.countDocuments();
    
    if (regionCount === 0) {
      await Region.insertMany([
        { Region: 'NCR', RegionCode: 'NCR', isActive: true },
        { Region: 'Region IV-A (CALABARZON)', RegionCode: 'R4A', isActive: true },
        { Region: 'Region VII (Central Visayas)', RegionCode: 'R7', isActive: true }
      ]);
      console.log('✅ Sample regions created');
    } else {
      console.log(`✅ Found ${regionCount} existing regions`);
    }
    
    // Step 3: Create sample hierarchical assignments
    console.log('\n👥 Step 3: Creating sample hierarchical assignments...');
    
    const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    
    // Get first region and departments for sample data
    const firstRegion = await Region.findOne({});
    const departmentsWithDivisions = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    
    if (!firstRegion) {
      console.log('❌ No regions found. Cannot create sample assignments.');
      return;
    }
    
    if (departmentsWithDivisions.length === 0) {
      console.log('❌ No departments with divisions found. Cannot create Division level assignments.');
      return;
    }
    
    // Clear existing assignments
    await UserOrganizationalAssignment.deleteMany({});
    console.log('🗑️ Cleared existing assignments');
    
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
        console.log(`   ✅ Created ${assignmentData.accessScope} assignment for ${assignmentData.userName}`);
      } catch (error) {
        console.log(`   ❌ Error creating assignment for ${assignmentData.userName}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Sample assignments created: ${successfulAssignments}/${sampleAssignments.length}`);
    
    // Step 4: Verification
    console.log('\n🔍 Step 4: Verifying setup...');
    const structure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    
    console.log(`\n📈 Setup Verification:`);
    console.log(`   📍 Regions available: ${structure.regions.length}`);
    console.log(`   🏢 Total departments: ${structure.departments.length}`);
    console.log(`   📂 Departments with divisions: ${structure.departments.filter(d => d.hasSubDivisions).length}`);
    console.log(`   📁 Total divisions: ${structure.departments.reduce((sum, dept) => sum + dept.divisions.length, 0)}`);
    
    console.log('\n🏢 Department-Division Structure:');
    structure.departments.filter(d => d.hasSubDivisions).forEach(dept => {
      console.log(`\n   📂 ${dept.name}`);
      dept.divisions.forEach(div => {
        console.log(`      ├── ${div.name} (${div.code})`);
      });
    });
    
    // Display created assignments
    const assignments = await UserOrganizationalAssignment.find({}).populate('regions departments');
    console.log('\n👥 Created Hierarchical Assignments:');
    assignments.forEach(assignment => {
      console.log(`\n   👤 ${assignment.userName} (${assignment.userId})`);
      console.log(`      └── Level: ${assignment.accessScope}`);
      if (assignment.regions.length > 0) {
        console.log(`      └── Region: ${assignment.regions.map(r => r.Region).join(', ')}`);
      }
      if (assignment.departments.length > 0) {
        console.log(`      └── Department: ${assignment.departments.map(d => d.Department).join(', ')}`);
      }
      if (assignment.divisions.length > 0) {
        console.log(`      └── Division: ${assignment.divisions.join(', ')}`);
      }
    });
    
    console.log('\n🎉 Quick Setup for Hierarchical RBAC completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start your frontend application');
    console.log('   2. Navigate to User Assignment Management');
    console.log('   3. Use the "Hierarchical Assignment" tab');
    console.log('   4. Create assignments for Division → Department → Region hierarchy');
    console.log('   5. Note: Division assignments now only show departments that have divisions!');
    
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
      console.log('\n✨ Hierarchical RBAC system with dynamic mappings is ready to use!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}
