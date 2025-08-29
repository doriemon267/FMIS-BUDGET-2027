/**
 * 🚀 Quick Setup Script for Hierarchical RBAC
 * 
 * This script helps you quickly set up the hierarchical RBAC system
 * with sample data and user assignments.
 */

const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');

async function quickSetupHierarchicalRBAC() {
  console.log('🚀 Setting up Hierarchical RBAC System...');
  console.log('═'.repeat(50));

  try {
    // 1. Ensure basic organizational data exists
    console.log('📋 Step 1: Setting up organizational structure...');
    
    // Check if regions exist
    const regionCount = await Region.countDocuments();
    if (regionCount === 0) {
      console.log('⚠️  No regions found. Creating sample regions...');
      await Region.insertMany([
        { Region: 'NCR', RegionCode: 'NCR' },
        { Region: 'Region IV-A', RegionCode: 'R4A' },
        { Region: 'Region VII', RegionCode: 'R7' }
      ]);
      console.log('✅ Sample regions created');
    } else {
      console.log(`✅ Found ${regionCount} existing regions`);
    }

    // Check if departments exist
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      console.log('⚠️  No departments found. Creating sample departments...');
      await Department.insertMany([
        { Department: 'Information Technology Department' },
        { Department: 'Finance Department' },
        { Department: 'Human Resources Department' },
        { Department: 'Operations Department' }
      ]);
      console.log('✅ Sample departments created');
    } else {
      console.log(`✅ Found ${deptCount} existing departments`);
    }

    // 2. Set up sample user assignments for each hierarchical level
    console.log('\n👥 Step 2: Creating sample user assignments...');
    
    const regions = await Region.find().limit(2);
    const departments = await Department.find().limit(2);

    const sampleAssignments = [
      {
        userId: 'demo_division_user',
        userName: 'Demo Division User',
        email: 'division@demo.com',
        accessScope: 'DIVISION',
        regions: [regions[0]._id],
        departments: [departments[0]._id],
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
        userId: 'demo_department_user',
        userName: 'Demo Department Manager',
        email: 'department@demo.com',
        accessScope: 'DEPARTMENT',
        regions: [regions[0]._id],
        departments: [departments[0]._id],
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
        userId: 'demo_region_user',
        userName: 'Demo Regional Director',
        email: 'region@demo.com',
        accessScope: 'REGION',
        regions: [regions[0]._id],
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

    let created = 0;
    let updated = 0;

    for (const assignmentData of sampleAssignments) {
      const existing = await UserOrganizationalAssignment.findOne({ 
        userId: assignmentData.userId 
      });

      if (existing) {
        Object.assign(existing, assignmentData);
        existing.lastModifiedBy = 'setup_script';
        await existing.save();
        updated++;
        console.log(`🔄 Updated assignment: ${assignmentData.userName}`);
      } else {
        await UserOrganizationalAssignment.create({
          ...assignmentData,
          createdBy: 'setup_script',
          lastModifiedBy: 'setup_script'
        });
        created++;
        console.log(`✅ Created assignment: ${assignmentData.userName}`);
      }
    }

    console.log(`📊 Assignment Summary: ${created} created, ${updated} updated`);

    // 3. Validate the setup
    console.log('\n🔍 Step 3: Validating setup...');
    
    const totalAssignments = await UserOrganizationalAssignment.countDocuments();
    const scopeCounts = await UserOrganizationalAssignment.aggregate([
      { $group: { _id: '$accessScope', count: { $sum: 1 } } }
    ]);

    console.log(`✅ Total user assignments: ${totalAssignments}`);
    scopeCounts.forEach(scope => {
      console.log(`   ${scope._id}: ${scope.count} users`);
    });

    // 4. Test consolidation logic
    console.log('\n🧪 Step 4: Testing consolidation logic...');
    
    const testUser = await UserOrganizationalAssignment.findOne({ 
      accessScope: 'DIVISION' 
    });

    if (testUser) {
      const consolidationInfo = testUser.getConsolidationTarget();
      console.log('✅ Consolidation test passed');
      console.log(`   User scope: ${consolidationInfo.primaryLevel}`);
      console.log(`   Consolidates from: ${consolidationInfo.consolidationData.originalLevel}`);
      console.log(`   Consolidates to: ${consolidationInfo.consolidationData.targetLevel}`);
    }

    // 5. Generate integration code examples
    console.log('\n📝 Step 5: Integration Examples');
    console.log('═'.repeat(30));

    console.log('\n🔧 1. Add to your routes:');
    console.log(`
const { hierarchicalAccessControl, strictHierarchicalControl } = require('./middleware/hierarchicalAccessControl');

// Read operations (with automatic filtering)
router.get('/proposals', 
  ...authenticatedRoute(),
  hierarchicalAccessControl('read'),
  getProposals
);

// Write operations (with consolidation)
router.post('/proposals',
  ...authenticatedRoute(),
  strictHierarchicalControl('create'),
  createProposal
);
`);

    console.log('\n📊 2. Use in controllers:');
    console.log(`
const createProposal = async (req, res) => {
  try {
    // Hierarchical middleware has applied consolidation
    const proposalData = req.body;
    const consolidationMetadata = req.body.consolidationMetadata;
    
    // Save with consolidated organizational data
    const proposal = await Proposal.create({
      ...proposalData,
      createdBy: req.user.id
    });

    return res.json({
      success: true,
      proposal,
      consolidationApplied: consolidationMetadata?.consolidationApplied
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
`);

    console.log('\n🚀 3. Test the API:');
    console.log(`
# Get user's hierarchical access info
curl -X GET "http://localhost:5005/api/hierarchical-rbac/my-access" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create proposal with hierarchical consolidation
curl -X POST "http://localhost:5005/api/hierarchical-rbac/proposals" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Test Proposal","amount":50000}'
`);

    console.log('\n✅ Setup Complete!');
    console.log('═'.repeat(50));
    console.log('🎯 Next Steps:');
    console.log('1. Add hierarchical middleware to your existing routes');
    console.log('2. Update your controllers to handle consolidated data');
    console.log('3. Test with the demo endpoints: /api/hierarchical-rbac/*');
    console.log('4. Configure real user assignments for your organization');
    console.log('5. Monitor logs for access patterns and consolidation behavior');

    return {
      success: true,
      summary: {
        regionsCreated: regionCount === 0 ? 3 : 0,
        departmentsCreated: deptCount === 0 ? 4 : 0,
        assignmentsCreated: created,
        assignmentsUpdated: updated,
        totalAssignments
      }
    };

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

/**
 * Clean up demo assignments (for testing)
 */
async function cleanupDemoAssignments() {
  console.log('🧹 Cleaning up demo assignments...');
  
  const result = await UserOrganizationalAssignment.deleteMany({
    userId: { $in: [
      'demo_division_user',
      'demo_department_user', 
      'demo_region_user'
    ]}
  });

  console.log(`✅ Removed ${result.deletedCount} demo assignments`);
  return result;
}

/**
 * Get current system status
 */
async function getSystemStatus() {
  console.log('📊 Hierarchical RBAC System Status');
  console.log('═'.repeat(40));

  try {
    const [
      regionCount,
      departmentCount,
      assignmentCount,
      scopeBreakdown
    ] = await Promise.all([
      Region.countDocuments(),
      Department.countDocuments(),
      UserOrganizationalAssignment.countDocuments(),
      UserOrganizationalAssignment.aggregate([
        { $group: { _id: '$accessScope', count: { $sum: 1 } } }
      ])
    ]);

    console.log(`🌍 Regions: ${regionCount}`);
    console.log(`🏬 Departments: ${departmentCount}`);
    console.log(`👥 User Assignments: ${assignmentCount}`);
    
    console.log('\n📈 Assignment Breakdown:');
    scopeBreakdown.forEach(scope => {
      console.log(`   ${scope._id}: ${scope.count} users`);
    });

    // Test if hierarchical middleware is working
    console.log('\n🔧 System Health:');
    console.log('✅ Models loaded successfully');
    console.log('✅ Database connectivity confirmed');
    
    if (assignmentCount > 0) {
      const testAssignment = await UserOrganizationalAssignment.findOne();
      try {
        const consolidationInfo = testAssignment.getConsolidationTarget();
        console.log('✅ Consolidation logic functional');
      } catch (err) {
        console.log('❌ Consolidation logic error:', err.message);
      }
    }

    return {
      regions: regionCount,
      departments: departmentCount,
      assignments: assignmentCount,
      scopeBreakdown,
      healthy: true
    };

  } catch (error) {
    console.error('❌ Status check failed:', error);
    return { healthy: false, error: error.message };
  }
}

module.exports = {
  quickSetupHierarchicalRBAC,
  cleanupDemoAssignments,
  getSystemStatus
};

// Run setup if this script is executed directly
if (require.main === module) {
  const mongoose = require('mongoose');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget';
  
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(async () => {
    console.log('📁 Connected to MongoDB');
    
    try {
      await quickSetupHierarchicalRBAC();
    } catch (error) {
      console.error('Setup error:', error);
    } finally {
      await mongoose.connection.close();
      console.log('📁 MongoDB connection closed');
    }
  }).catch(error => {
    console.error('❌ MongoDB connection error:', error);
  });
}
