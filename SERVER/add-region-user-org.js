/**
 * Add Region user to UserOrganizationalAssignment collection
 */
const mongoose = require('mongoose');

async function addRegionUserToOrgAssignment() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get Region info from hierarchical assignment
    const hierarchicalAssignment = await db.collection('hierarchicaluserassignments').findOne({ userId: 416461 });
    console.log('📋 Hierarchical assignment:', {
      userId: hierarchicalAssignment.userId,
      assignmentLevel: hierarchicalAssignment.assignmentLevel,
      regionId: hierarchicalAssignment.regionId
    });
    
    // Check if UserOrganizationalAssignment already exists
    const existing = await db.collection('userorganizationalassignments').findOne({ userId: 416461 });
    if (existing) {
      console.log('❗ UserOrganizationalAssignment already exists');
      console.log('   Access Scope:', existing.accessScope);
      return;
    }
    
    // Create UserOrganizationalAssignment record
    const newAssignment = {
      userId: 416461,
      userName: "Nelson Eloso",
      email: "nelsoneloso@example.com", // placeholder
      assignmentLevel: "REGION",
      accessScope: "REGION", 
      regionId: hierarchicalAssignment.regionId,
      departmentId: null,
      divisionName: null,
      regions: [],
      departments: [],
      divisions: [],
      workflowRoles: [],
      rolePermissions: {
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: true,
        canDeleteProposals: true,
        canApproveProposals: true,
        canViewReports: true,
        canManageUsers: false,
        canManageSettings: false
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('userorganizationalassignments').insertOne(newAssignment);
    console.log('✅ Created UserOrganizationalAssignment:', result.insertedId);
    
    // Verify the creation
    const verification = await db.collection('userorganizationalassignments').findOne({ userId: 416461 });
    console.log('\n🔍 Verification:');
    console.log('   User ID:', verification.userId);
    console.log('   Assignment Level:', verification.assignmentLevel);
    console.log('   Access Scope:', verification.accessScope);
    console.log('   Can Delete:', verification.rolePermissions.canDeleteProposals);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

addRegionUserToOrgAssignment();