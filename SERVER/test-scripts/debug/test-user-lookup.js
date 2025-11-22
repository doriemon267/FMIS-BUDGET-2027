// Test script to check user lookup functionality
const mongoose = require('mongoose');
require('dotenv').config();

async function testUserLookup() {
  try {
    // Connect to FMIS main database
    const mainConnection = mongoose.createConnection(process.env.FMIS_MAIN_DB_URI || 'mongodb://localhost:27017/fmis_main');

    const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
    const Role = mainConnection.model('roles', new mongoose.Schema({}, { strict: false }), 'roles');

    const userId = '336165';

    console.log(`Testing user lookup for user ID: ${userId}`);

    // Try to find the user
    const userData = await AssignedRole.findOne({
      $or: [
        { user: userId },
        { user: parseInt(userId) }
      ]
    }).lean();

    if (!userData) {
      console.log('❌ User not found in assigned_roles collection');
      return;
    }

    console.log('✅ Found user data:', JSON.stringify(userData, null, 2));

    // Extract roles
    const roleNames = [];
    if (userData.roles && userData.roles.length > 0) {
      console.log('🔍 Processing roles:', userData.roles);

      // First, let's see what roles exist in the roles collection
      console.log('🔍 Checking all roles in collection...');
      const allRoles = await Role.find({}, { name: 1 }).lean();
      console.log('📋 All roles in collection:', allRoles);

      for (const roleItem of userData.roles) {
        console.log(`🔍 Processing role item:`, roleItem, `type:`, typeof roleItem);
        if (roleItem && roleItem._bsontype === 'ObjectId') {
          // It's an ObjectId object
          console.log(`🔍 Looking up ObjectId: ${roleItem}`);
          const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
          console.log(`🔍 Role lookup result:`, roleDoc);
          if (roleDoc && roleDoc.name) {
            roleNames.push(roleDoc.name);
          }
        } else if (typeof roleItem === 'string') {
          if (roleItem.match(/^[0-9a-fA-F]{24}$/)) {
            console.log(`🔍 Looking up string ObjectId: ${roleItem}`);
            const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
            console.log(`🔍 Role lookup result:`, roleDoc);
            if (roleDoc && roleDoc.name) {
              roleNames.push(roleDoc.name);
            }
          } else {
            roleNames.push(roleItem);
          }
        } else if (roleItem && typeof roleItem === 'object' && roleItem.name) {
          roleNames.push(roleItem.name);
        }
      }
    }

    console.log('📋 Extracted role names:', roleNames);

    // Determine budget roles
    let budgetRoles = [];
    let primaryRole = 'BUDGET_PREPARER';

    if (roleNames.includes('SUPER ADMIN') || roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN')) {
      budgetRoles.push('SUPER_ADMIN');
      primaryRole = 'SUPER_ADMIN';
    } else {
      if (roleNames.includes('OVERALL_BUDGET_APPROVER') || roleNames.includes('OVERALL BUDGET APPROVER')) {
        budgetRoles.push('OVERALL_BUDGET_APPROVER');
        primaryRole = 'OVERALL_BUDGET_APPROVER';
      }

      if (roleNames.includes('BUDGET OFFICER') || roleNames.includes('BUDGET_OFFICER')) {
        budgetRoles.push('BUDGET_OFFICER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_OFFICER';
      }

      if (roleNames.includes('BUDGET PLANNING ANALYST') || roleNames.includes('BUDGET_PLANNING_ANALYST')) {
        budgetRoles.push('BUDGET_PLANNING_ANALYST');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_PLANNING_ANALYST';
      }

      if (roleNames.includes('BUDGET APPROVER') || roleNames.includes('BUDGET_APPROVER')) {
        budgetRoles.push('BUDGET_APPROVER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_APPROVER';
      }

      if (roleNames.includes('BUDGET REVIEWER') || roleNames.includes('BUDGET_REVIEWER')) {
        budgetRoles.push('BUDGET_REVIEWER');
        if (primaryRole === 'BUDGET_PREPARER') primaryRole = 'BUDGET_REVIEWER';
      }

      if (roleNames.includes('BUDGET PREPARER') || roleNames.includes('BUDGET_PREPARER')) {
        budgetRoles.push('BUDGET_PREPARER');
      }

      if (budgetRoles.length === 0) {
        budgetRoles.push('BUDGET_PREPARER');
      }
    }

    console.log('📋 Determined budgetRoles:', budgetRoles);
    console.log('📋 Primary role:', primaryRole);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testUserLookup();