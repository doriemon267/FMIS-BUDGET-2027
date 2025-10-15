/**
 * Fix User Roles - Correct Assignment
 * 
 * Joshua Demafelez (345220) - BUDGET ANALYST - divisionCreator ✅
 * Andrie Barrameda (751754) - BUDGET OFFICER - officeverifier, officeConsolidator
 * Nelson Eloso (416461) - BUDGET COORDINATOR - divisionapprover
 * Reymund Edra (909549) - BUDGET MANAGER - FULL access (keep as is)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

async function fixUserRoles() {
  try {
    console.log('🔌 Connecting to MongoDB (BUDGET - fmis_budget)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fix Joshua Demafelez - BUDGET ANALYST
    console.log('👤 Fixing Joshua Demafelez (BUDGET ANALYST)...');
    const joshua = await HierarchicalUserAssignment.findOne({ 
      userId: '345220', 
      isActive: true 
    });
    
    if (joshua) {
      const oldRoles = [...joshua.workflowRoles];
      joshua.workflowRoles = ['divisionCreator'];
      await joshua.save();
      console.log(`   Old roles: ${oldRoles.join(', ')}`);
      console.log(`   New roles: ${joshua.workflowRoles.join(', ')}`);
      console.log('   ✅ Updated to BUDGET ANALYST\n');
    } else {
      console.log('   ❌ User not found\n');
    }

    // Fix Andrie Barrameda - BUDGET OFFICER
    console.log('👤 Fixing Andrie Barrameda (BUDGET OFFICER)...');
    const andrie = await HierarchicalUserAssignment.findOne({ 
      userId: '751754', 
      isActive: true 
    });
    
    if (andrie) {
      const oldRoles = [...andrie.workflowRoles];
      andrie.workflowRoles = ['officeConsolidator', 'officeFinalVerifier'];
      await andrie.save();
      console.log(`   Old roles: ${oldRoles.join(', ')}`);
      console.log(`   New roles: ${andrie.workflowRoles.join(', ')}`);
      console.log('   ✅ Updated to BUDGET OFFICER\n');
    } else {
      console.log('   ❌ User not found\n');
    }

    // Fix Nelson Eloso - BUDGET COORDINATOR
    console.log('👤 Fixing Nelson Eloso (BUDGET COORDINATOR)...');
    const nelson = await HierarchicalUserAssignment.findOne({ 
      userId: '416461', 
      isActive: true 
    });
    
    if (nelson) {
      const oldRoles = [...nelson.workflowRoles];
      nelson.workflowRoles = ['divisionApprover'];
      await nelson.save();
      console.log(`   Old roles: ${oldRoles.join(', ')}`);
      console.log(`   New roles: ${nelson.workflowRoles.join(', ')}`);
      console.log('   ✅ Updated to BUDGET COORDINATOR\n');
    } else {
      console.log('   ❌ User not found\n');
    }

    console.log('✅ All user roles fixed successfully!');
    console.log('\n📋 Final Role Summary:');
    console.log('==========================================');
    console.log('Joshua Demafelez - BUDGET ANALYST (divisionCreator)');
    console.log('Andrie Barrameda - BUDGET OFFICER (officeConsolidator, officeFinalVerifier)');
    console.log('Nelson Eloso - BUDGET COORDINATOR (divisionApprover)');
    console.log('Reymund Edra - BUDGET MANAGER (FULL access)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixUserRoles().catch(console.error);
