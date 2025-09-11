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
  );
  try {
    // 1. Ensure basic organizational data exists
    // Check if regions exist
    const regionCount = await Region.countDocuments();
    if (regionCount === 0) {
      await Region.insertMany([
        { Region: 'NCR', RegionCode: 'NCR' },
        { Region: 'Region IV-A', RegionCode: 'R4A' },
        { Region: 'Region VII', RegionCode: 'R7' }
      ]);
      } else {
      }
    // Check if departments exist
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      await Department.insertMany([
        { Department: 'Information Technology Department' },
        { Department: 'Finance Department' },
        { Department: 'Human Resources Department' },
        { Department: 'Operations Department' }
      ]);
      } else {
      }
    // 2. Set up sample user assignments for each hierarchical level
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
        } else {
        await UserOrganizationalAssignment.create({
          ...assignmentData,
          createdBy: 'setup_script',
          lastModifiedBy: 'setup_script'
        });
        created++;
        }
    }
    // 3. Validate the setup
    const totalAssignments = await UserOrganizationalAssignment.countDocuments();
    const scopeCounts = await UserOrganizationalAssignment.aggregate([
      { $group: { _id: '$accessScope', count: { $sum: 1 } } }
    ]);
    scopeCounts.forEach(scope => {
      });
    // 4. Test consolidation logic
    const testUser = await UserOrganizationalAssignment.findOne({ 
      accessScope: 'DIVISION' 
    });
    if (testUser) {
      const consolidationInfo = testUser.getConsolidationTarget();
      }
    // 5. Generate integration code examples
    );
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
    => {
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
    );
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
  const result = await UserOrganizationalAssignment.deleteMany({
    userId: { $in: [
      'demo_division_user',
      'demo_department_user', 
      'demo_region_user'
    ]}
  });
  return result;
}
/**
 * Get current system status
 */
async function getSystemStatus() {
  );
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
    scopeBreakdown.forEach(scope => {
      });
    // Test if hierarchical middleware is working
    if (assignmentCount > 0) {
      const testAssignment = await UserOrganizationalAssignment.findOne();
      try {
        const consolidationInfo = testAssignment.getConsolidationTarget();
        } catch (err) {
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
    try {
      await quickSetupHierarchicalRBAC();
    } catch (error) {
      console.error('Setup error:', error);
    } finally {
      await mongoose.connection.close();
      }
  }).catch(error => {
    console.error('❌ MongoDB connection error:', error);
  });
}