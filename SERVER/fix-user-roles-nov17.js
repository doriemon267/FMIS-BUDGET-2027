/**
 * Fix User Role Assignments - November 17, 2025
 * 
 * Updates:
 * 1. Charles Klein Cordero (723072): BUDGET_ADMIN → BUDGET_OFFICER
 * 2. Marvin Buisa (925166): BUDGET_OFFICER → OVERALL_BUDGET_APPROVER
 */

require('dotenv').config({ path: '.env' });

const mongoose = require('mongoose');
const connectDB = require('./config/mongo_db');

async function fixUserRoleAssignments() {
  try {
    // Connect to databases first
    console.log('🔌 Connecting to databases...');
    await connectDB();
    
    console.log('🔧 Starting user role assignment fixes...\n');

    // Get the HierarchicalUserAssignment model
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    // Fix 1: Charles Klein Cordero (723072)
    console.log('📝 Fix 1: Charles Klein Cordero (723072)');
    console.log('   From: BUDGET_ADMIN → To: BUDGET_OFFICER');

    const charles = await HierarchicalUserAssignment.findOneAndUpdate(
      { userId: '723072' },
      {
        $set: {
          userRole: 'BUDGET_OFFICER',
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (charles) {
      console.log('   ✅ Updated in HierarchicalUserAssignment');
      console.log(`      User Role: ${charles.userRole}`);
      console.log(`      Assignment Level: ${charles.assignmentLevel}`);
    } else {
      console.log('   ⚠️  Not found in HierarchicalUserAssignment');
    }

    // Fix 2: Marvin Buisa (925166)
    console.log('\n📝 Fix 2: Marvin Buisa (925166)');
    console.log('   From: BUDGET_OFFICER → To: OVERALL_BUDGET_APPROVER');

    const marvin = await HierarchicalUserAssignment.findOneAndUpdate(
      { userId: '925166' },
      {
        $set: {
          userRole: 'OVERALL_BUDGET_APPROVER',
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (marvin) {
      console.log('   ✅ Updated in HierarchicalUserAssignment');
      console.log(`      User Role: ${marvin.userRole}`);
      console.log(`      Assignment Level: ${marvin.assignmentLevel}`);
    } else {
      console.log('   ⚠️  Not found in HierarchicalUserAssignment');
    }

    // Verify the changes
    console.log('\n✅ Verification: Fetching updated records...\n');

    const charlesVerify = await HierarchicalUserAssignment.findOne({ userId: '723072' });
    console.log('Charles Klein Cordero (723072):');
    console.log(`   Current Role: ${charlesVerify?.userRole || 'NOT FOUND'}`);
    console.log(`   Assignment Level: ${charlesVerify?.assignmentLevel || 'N/A'}`);

    const marvinVerify = await HierarchicalUserAssignment.findOne({ userId: '925166' });
    console.log('\nMarvin Buisa (925166):');
    console.log(`   Current Role: ${marvinVerify?.userRole || 'NOT FOUND'}`);
    console.log(`   Assignment Level: ${marvinVerify?.assignmentLevel || 'N/A'}`);

    console.log('\n✅ All user role assignment fixes completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing user role assignments:', error);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run the fix
fixUserRoleAssignments();
