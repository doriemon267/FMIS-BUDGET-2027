/**
 * 🏢 Hierarchical RBAC Demonstration Script
 * 
 * This script demonstrates the Division → Department → Region hierarchical consolidation system.
 * Run this script to see how user assignments and consolidation work.
 */

const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');
const mongoose = require('mongoose');

// Demo data setup
const DEMO_REGIONS = [
  { Region: 'NCR', RegionCode: 'NCR' },
  { Region: 'Region IV-A', RegionCode: 'R4A' },
  { Region: 'Region VII', RegionCode: 'R7' }
];

const DEMO_DEPARTMENTS = [
  { Department: 'Information Technology Department' },
  { Department: 'Finance Department' },
  { Department: 'Human Resources Department' },
  { Department: 'Operations Department' }
];

const DEMO_DIVISIONS = [
  'Software Development Division',
  'Network Infrastructure Division', 
  'Budget Management Division',
  'Accounting Division',
  'Recruitment Division',
  'Training and Development Division'
];

/**
 * Initialize demo data
 */
async function initializeDemoData() {
  console.log('🔧 Initializing demo data...');

  try {
    // Create regions if they don't exist
    for (const regionData of DEMO_REGIONS) {
      const existingRegion = await Region.findOne({ Region: regionData.Region });
      if (!existingRegion) {
        await Region.create(regionData);
        console.log(`✅ Created region: ${regionData.Region}`);
      }
    }

    // Create departments if they don't exist
    for (const deptData of DEMO_DEPARTMENTS) {
      const existingDept = await Department.findOne({ Department: deptData.Department });
      if (!existingDept) {
        await Department.create(deptData);
        console.log(`✅ Created department: ${deptData.Department}`);
      }
    }

    console.log('✅ Demo data initialization complete');
  } catch (error) {
    console.error('❌ Error initializing demo data:', error);
    throw error;
  }
}

/**
 * Create demo user assignments for each hierarchical level
 */
async function createDemoUserAssignments() {
  console.log('\n🏢 Creating demo user assignments...');

  try {
    // Get created regions and departments
    const ncrRegion = await Region.findOne({ Region: 'NCR' });
    const region4a = await Region.findOne({ Region: 'Region IV-A' });
    const itDepartment = await Department.findOne({ Department: 'Information Technology Department' });
    const financeDepartment = await Department.findOne({ Department: 'Finance Department' });

    // Demo assignments for different hierarchical levels
    const demoAssignments = [
      {
        userId: 'division_user_001',
        userName: 'John Division User',
        email: 'john.division@example.com',
        accessScope: 'DIVISION',
        regions: [ncrRegion._id],
        departments: [itDepartment._id],
        divisions: ['Software Development Division'],
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
        userId: 'department_user_001',
        userName: 'Jane Department Manager',
        email: 'jane.department@example.com',
        accessScope: 'DEPARTMENT',
        regions: [ncrRegion._id],
        departments: [itDepartment._id],
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
      {
        userId: 'region_user_001',
        userName: 'Bob Regional Director',
        email: 'bob.region@example.com',
        accessScope: 'REGION',
        regions: [ncrRegion._id],
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
      },
      {
        userId: 'another_division_user',
        userName: 'Alice Finance Division',
        email: 'alice.finance@example.com',
        accessScope: 'DIVISION',
        regions: [region4a._id],
        departments: [financeDepartment._id],
        divisions: ['Budget Management Division'],
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
      }
    ];

    // Create or update assignments
    for (const assignmentData of demoAssignments) {
      const existingAssignment = await UserOrganizationalAssignment.findOne({ 
        userId: assignmentData.userId 
      });

      if (existingAssignment) {
        Object.assign(existingAssignment, assignmentData);
        await existingAssignment.save();
        console.log(`🔄 Updated assignment for: ${assignmentData.userName}`);
      } else {
        await UserOrganizationalAssignment.create({
          ...assignmentData,
          createdBy: 'demo_admin',
          lastModifiedBy: 'demo_admin'
        });
        console.log(`✅ Created assignment for: ${assignmentData.userName}`);
      }
    }

    console.log('✅ Demo user assignments created successfully');
  } catch (error) {
    console.error('❌ Error creating demo user assignments:', error);
    throw error;
  }
}

/**
 * Demonstrate hierarchical consolidation for each user type
 */
async function demonstrateHierarchicalConsolidation() {
  console.log('\n🎯 Demonstrating hierarchical consolidation...');

  try {
    const userIds = [
      'division_user_001',
      'department_user_001', 
      'region_user_001',
      'another_division_user'
    ];

    for (const userId of userIds) {
      console.log(`\n👤 Testing consolidation for user: ${userId}`);
      
      const assignment = await UserOrganizationalAssignment.findOne({ userId })
        .populate('regions', 'Region RegionCode')
        .populate('departments', 'Department');

      if (!assignment) {
        console.log(`❌ No assignment found for ${userId}`);
        continue;
      }

      console.log(`📋 User: ${assignment.userName}`);
      console.log(`🎯 Access Scope: ${assignment.accessScope}`);
      
      // Get consolidation information
      const consolidationInfo = assignment.getConsolidationTarget();
      console.log(`🔄 Consolidation Info:`, JSON.stringify(consolidationInfo, null, 2));

      // Simulate a proposal submission
      const proposalData = {
        title: `${assignment.accessScope} Level Proposal`,
        description: `Sample proposal from ${assignment.userName}`,
        amount: 50000,
        fiscalYear: '2024'
      };

      console.log(`📝 Original Proposal Data:`, proposalData);

      // Apply consolidation logic
      const consolidatedData = { ...proposalData };
      
      switch (assignment.accessScope) {
        case 'DIVISION':
          consolidatedData.originalLevel = 'DIVISION';
          consolidatedData.originalDivision = assignment.divisions[0];
          consolidatedData.department = assignment.departments[0]?.Department;
          consolidatedData.region = assignment.regions[0]?.Region;
          consolidatedData.consolidatedFrom = 'DIVISION';
          break;

        case 'DEPARTMENT':
          consolidatedData.originalLevel = 'DEPARTMENT';
          consolidatedData.originalDepartment = assignment.departments[0]?.Department;
          consolidatedData.region = assignment.regions[0]?.Region;
          consolidatedData.consolidatedFrom = 'DEPARTMENT';
          break;

        case 'REGION':
          consolidatedData.originalLevel = 'REGION';
          consolidatedData.region = assignment.regions[0]?.Region;
          break;
      }

      console.log(`✅ Consolidated Proposal Data:`, consolidatedData);
      
      // Show where this data would be saved/consolidated
      console.log(`💾 Data will be saved to: ${getConsolidationTarget(assignment.accessScope)}`);
      console.log(`📊 Will appear in ${getReportingLevel(assignment.accessScope)} reports`);
      
      console.log('─'.repeat(60));
    }

  } catch (error) {
    console.error('❌ Error demonstrating consolidation:', error);
    throw error;
  }
}

/**
 * Show hierarchical access patterns
 */
async function demonstrateAccessPatterns() {
  console.log('\n🔐 Demonstrating hierarchical access patterns...');

  try {
    const assignments = await UserOrganizationalAssignment.find({})
      .populate('regions', 'Region')
      .populate('departments', 'Department');

    console.log('\n📊 Access Summary:');
    console.log('═'.repeat(80));

    for (const assignment of assignments) {
      console.log(`\n👤 ${assignment.userName} (${assignment.accessScope})`);
      
      switch (assignment.accessScope) {
        case 'DIVISION':
          console.log(`   🏢 Division: ${assignment.divisions.join(', ')}`);
          console.log(`   🏬 Department: ${assignment.departments.map(d => d.Department).join(', ')}`);
          console.log(`   🌍 Region: ${assignment.regions.map(r => r.Region).join(', ')}`);
          console.log(`   📝 Can create: Division-level proposals → Consolidate to Department`);
          console.log(`   👀 Can view: Own division + consolidated department data`);
          break;

        case 'DEPARTMENT':
          console.log(`   🏬 Department: ${assignment.departments.map(d => d.Department).join(', ')}`);
          console.log(`   🌍 Region: ${assignment.regions.map(r => r.Region).join(', ')}`);
          console.log(`   📝 Can create: Department-level proposals → Consolidate to Region`);
          console.log(`   👀 Can view: Own department + consolidated region data`);
          break;

        case 'REGION':
          console.log(`   🌍 Region: ${assignment.regions.map(r => r.Region).join(', ')}`);
          console.log(`   📝 Can create: Region-level proposals (no consolidation)`);
          console.log(`   👀 Can view: All data within assigned region`);
          break;
      }

      console.log(`   🔑 Permissions:`, Object.entries(assignment.rolePermissions)
        .filter(([key, value]) => value === true)
        .map(([key]) => key)
        .join(', '));
    }

    console.log('\n═'.repeat(80));
  } catch (error) {
    console.error('❌ Error demonstrating access patterns:', error);
    throw error;
  }
}

/**
 * Generate summary report
 */
async function generateSummaryReport() {
  console.log('\n📈 Hierarchical RBAC System Summary');
  console.log('═'.repeat(50));

  try {
    const totalAssignments = await UserOrganizationalAssignment.countDocuments();
    const assignmentsByScope = await UserOrganizationalAssignment.aggregate([
      {
        $group: {
          _id: '$accessScope',
          count: { $sum: 1 },
          users: { $push: '$userName' }
        }
      }
    ]);

    console.log(`\n📊 Total User Assignments: ${totalAssignments}`);
    console.log('\n📋 Breakdown by Access Scope:');

    for (const scope of assignmentsByScope) {
      console.log(`   ${scope._id}: ${scope.count} users`);
      scope.users.forEach(user => console.log(`     - ${user}`));
    }

    console.log('\n🏗️ Hierarchical Structure:');
    console.log('   Division → Department → Region');
    console.log('   │         │           │');
    console.log('   │         │           └─ Regional reports (all data)');
    console.log('   │         └─ Department reports (department + division data)');
    console.log('   └─ Division reports (division data only)');

    console.log('\n🔄 Consolidation Flow:');
    console.log('   1. Division users submit → Data saved to Department level');
    console.log('   2. Department users submit → Data saved to Region level');
    console.log('   3. Region users submit → Data saved to Region level');

    console.log('\n✅ System Benefits:');
    console.log('   • Hierarchical data consolidation');
    console.log('   • Automated organizational rollup');
    console.log('   • Clear access boundaries');
    console.log('   • Simplified regional reporting');
    console.log('   • Audit trail with consolidation metadata');

  } catch (error) {
    console.error('❌ Error generating summary report:', error);
    throw error;
  }
}

/**
 * Helper functions
 */
function getConsolidationTarget(scope) {
  switch (scope) {
    case 'DIVISION':
      return 'Department records (then rolls up to Region)';
    case 'DEPARTMENT':
      return 'Region records (centralized regional data)';
    case 'REGION':
      return 'Region records (direct storage)';
    default:
      return 'Own records only';
  }
}

function getReportingLevel(scope) {
  switch (scope) {
    case 'DIVISION':
      return 'Department and Regional';
    case 'DEPARTMENT':
      return 'Regional';
    case 'REGION':
      return 'Regional';
    default:
      return 'Individual';
  }
}

/**
 * Main demonstration function
 */
async function runHierarchicalRBACDemo() {
  console.log('🏢 Hierarchical RBAC Demonstration');
  console.log('═'.repeat(50));
  console.log('This demo shows Division → Department → Region consolidation');
  
  try {
    await initializeDemoData();
    await createDemoUserAssignments();
    await demonstrateHierarchicalConsolidation();
    await demonstrateAccessPatterns();
    await generateSummaryReport();

    console.log('\n🎉 Hierarchical RBAC demonstration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review the hierarchical middleware implementation');
    console.log('   2. Test with your application routes');
    console.log('   3. Configure user assignments for your organization');
    console.log('   4. Monitor consolidation behavior in production');

  } catch (error) {
    console.error('\n❌ Demo failed with error:', error);
    throw error;
  }
}

/**
 * Cleanup demo data (optional)
 */
async function cleanupDemoData() {
  console.log('\n🧹 Cleaning up demo data...');
  
  try {
    // Remove demo assignments
    const deletedAssignments = await UserOrganizationalAssignment.deleteMany({
      userId: { $in: [
        'division_user_001',
        'department_user_001',
        'region_user_001',
        'another_division_user'
      ]}
    });

    console.log(`✅ Removed ${deletedAssignments.deletedCount} demo assignments`);
    console.log('Note: Regions and Departments were left intact for system use');
    
  } catch (error) {
    console.error('❌ Error cleaning up demo data:', error);
    throw error;
  }
}

// Export functions for use in other scripts or tests
module.exports = {
  runHierarchicalRBACDemo,
  initializeDemoData,
  createDemoUserAssignments,
  demonstrateHierarchicalConsolidation,
  demonstrateAccessPatterns,
  generateSummaryReport,
  cleanupDemoData
};

// Run demo if this script is executed directly
if (require.main === module) {
  // Ensure MongoDB connection
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget';
  
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(async () => {
    console.log('📁 Connected to MongoDB');
    
    try {
      await runHierarchicalRBACDemo();
    } catch (error) {
      console.error('Demo error:', error);
    } finally {
      await mongoose.connection.close();
      console.log('📁 MongoDB connection closed');
    }
  }).catch(error => {
    console.error('❌ MongoDB connection error:', error);
  });
}
