const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function debugDepartmentUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget-september');

    // Find a Department level user
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    const deptUser = await HierarchicalUserAssignment.findOne({
      assignmentLevel: 'DEPARTMENT',
      isActive: true
    }).limit(1);

    if (!deptUser) {
      console.log('❌ No Department level user found');
      return;
    }

    console.log('👤 Department User Found:', {
      userId: deptUser.userId,
      userName: deptUser.userName,
      assignmentLevel: deptUser.assignmentLevel,
      rolePermissions: deptUser.rolePermissions,
      workflowRoles: deptUser.workflowRoles
    });

    // Check if they have ApproveProposals permission
    const hasApprovePermission = deptUser.rolePermissions?.ApproveProposals === true;
    console.log('🔐 Approve Permission:', hasApprovePermission);

    // Find Division Submitted proposals
    const Proposal = require('./models/Proposal');
    const divisionSubmittedProposals = await Proposal.find({
      status: 'Division Submitted'
    }).limit(3);

    console.log('📄 Division Submitted Proposals:', divisionSubmittedProposals.map(p => ({
      _id: p._id,
      fiscalYear: p.fiscalYear,
      budgetType: p.budgetType,
      status: p.status,
      cobExpenditures: p.cobExpenditures
    })));

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugDepartmentUser();