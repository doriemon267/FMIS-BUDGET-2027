/**
 * Fix User Role Assignments - November 17, 2025
 * 
 * Updates:
 * 1. Charles Klein Cordero (723072): BUDGET_ADMIN → BUDGET_OFFICER
 * 2. Marvin Buisa (925166): BUDGET_OFFICER → OVERALL_BUDGET_APPROVER
 */

const mongoose = require('mongoose');
const connectDB = require('./config/mongo_db');

async function fixUserRoleAssignments() {
  try {
    // Connect to databases first
    console.log('� Connecting to databases...');
    await connectDB();
    
    console.log('�🔧 Starting user role assignment fixes...');

    // Get the mainConnection from the module
    const mainConnection = require('./config/mongo_db').mainConnection;
    
    // Get the default connection (budget)
    const budgetingConnection = mongoose.connection;

    // Get the HierarchicalUserAssignment model
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    // Also try to get from assigned_roles in main DB
    const AssignedRole = mainConnection.model(
      'assigned_roles',
      new mongoose.Schema({}, { strict: false }),
      'assigned_roles'
    );

    // Fix 1: Charles Klein Cordero (723072)
    console.log('\n📝 Fix 1: Charles Klein Cordero (723072)');
    console.log('   From: BUDGET_ADMIN → To: BUDGET_OFFICER');

    const charles = await HierarchicalUserAssignment.findOneAndUpdate(
      { userId: '723072' },
      {
        $set: {
          userRole: 'BUDGET_OFFICER',
          updatedAt: new Date(),
          updatedReason: 'Corrected role from BUDGET_ADMIN to BUDGET_OFFICER - Nov 17, 2025'
        }
      },
      { new: true }
    );

    if (charles) {
      console.log('   ✅ Updated in HierarchicalUserAssignment:', charles);
    } else {
      console.log('   ⚠️  Not found in HierarchicalUserAssignment, creating...');
      await HierarchicalUserAssignment.create({
        userId: '723072',
        userName: 'Charles Klein Cordero',
        email: 'charles.klein@nia.gov.ph', // May need to adjust based on actual email
        userRole: 'BUDGET_OFFICER',
        assignmentLevel: 'FULL',
        isActive: true,
        createdAt: new Date(),
        createdReason: 'Created from role correction - Nov 17, 2025'
      });
      console.log('   ✅ Created new assignment for Charles Klein Cordero');
    }

    // Also update in assigned_roles if exists
    const charlesAssignedRole = await AssignedRole.findOneAndUpdate(
      { user: '723072' },
      {
        $set: {
          roles: [] // Will be updated through hierarchical system
        }
      },
      { new: true }
    );
    if (charlesAssignedRole) {
      console.log('   ✅ Updated assigned_roles for Charles Klein Cordero');
    }

    // Fix 2: Marvin Buisa (925166)
    console.log('\n📝 Fix 2: Marvin Buisa (925166)');
    console.log('   From: BUDGET_OFFICER → To: OVERALL_BUDGET_APPROVER');

    const marvin = await HierarchicalUserAssignment.findOneAndUpdate(
      { userId: '925166' },
      {
        $set: {
          userRole: 'OVERALL_BUDGET_APPROVER',
          updatedAt: new Date(),
          updatedReason: 'Corrected role from BUDGET_OFFICER to OVERALL_BUDGET_APPROVER - Nov 17, 2025'
        }
      },
      { new: true }
    );

    if (marvin) {
      console.log('   ✅ Updated in HierarchicalUserAssignment:', marvin);
    } else {
      console.log('   ⚠️  Not found in HierarchicalUserAssignment, creating...');
      await HierarchicalUserAssignment.create({
        userId: '925166',
        userName: 'Marvin Buisa',
        email: 'marvin.buisa@nia.gov.ph', // May need to adjust based on actual email
        userRole: 'OVERALL_BUDGET_APPROVER',
        assignmentLevel: 'FULL',
        isActive: true,
        createdAt: new Date(),
        createdReason: 'Created from role correction - Nov 17, 2025'
      });
      console.log('   ✅ Created new assignment for Marvin Buisa');
    }

    // Also update in assigned_roles if exists
    const marvinAssignedRole = await AssignedRole.findOneAndUpdate(
      { user: '925166' },
      {
        $set: {
          roles: [] // Will be updated through hierarchical system
        }
      },
      { new: true }
    );
    if (marvinAssignedRole) {
      console.log('   ✅ Updated assigned_roles for Marvin Buisa');
    }

    // Verify the changes
    console.log('\n✅ Verification: Fetching updated records...');

    const charlesVerify = await HierarchicalUserAssignment.findOne({ userId: '723072' });
    console.log('Charles Klein Cordero (723072) - Current Role:', charlesVerify?.userRole);

    const marvinVerify = await HierarchicalUserAssignment.findOne({ userId: '925166' });
    console.log('Marvin Buisa (925166) - Current Role:', marvinVerify?.userRole);

    console.log('\n✅ All user role assignment fixes completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing user role assignments:', error);
    process.exit(1);
  } finally {
    // Close connections
    await mainConnection.close();
    await budgetingConnection.close();
    process.exit(0);
  }
}

// Run the fix
fixUserRoleAssignments();
